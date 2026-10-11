// Baton relay as a standard fetch handler (Request → Response). Runs unchanged on Node (via server.ts),
// Cloudflare Workers (worker/index.ts) and Deno. No Node APIs in this file.
//
//   POST /mcp[/<secret>]          MCP over Streamable HTTP (JSON responses): baton_checkpoint, baton_pickup, baton_get_file
//   POST /api/handoffs            upload a captured bundle {bundle} or an end-to-end sealed one {sealed, title}
//   GET  /api/handoffs/<code>     record as JSON (sealed payloads stay opaque)
//   POST /api/handoffs/<code>/checkpoints   append a checkpoint
//   GET  /h/<code>  ·  /h/<code>.zip         viewer / bundle zip (sealed: decrypted in the browser with the #key)
//   GET  /healthz  ·  GET /

import type { BatonBundle } from '../core/schema.ts';
import { VERSION } from '../core/schema.ts';
import { escapeHtml } from '../core/util.ts';
import { zip } from '../core/zip.ts';
import { handleRpc, type McpSession } from '../mcp/protocol.ts';
import { renderRecord, type SealedPayload } from './checkpoint.ts';
import { CODE_RE, normaliseCode, type AsyncRelayStore } from './kvstore.ts';
import { RELAY_INSTRUCTIONS, relayTools } from './tools.ts';

export interface RelayHandlerOptions {
  store: AsyncRelayStore;
  publicUrl?: string;
  token?: string; // bearer required for REST uploads
  mcpSecret?: string; // serve MCP only at /mcp/<secret>
  rateLimitPerMinute?: number;
  log?: (msg: string) => void;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-session-id, mcp-protocol-version, last-event-id',
  'access-control-expose-headers': 'mcp-session-id',
};

export function createRelayHandler(o: RelayHandlerOptions): (req: Request) => Promise<Response> {
  const { store } = o;
  const mcpPath = o.mcpSecret ? `/mcp/${o.mcpSecret}` : '/mcp';
  const info = { name: 'baton-relay', version: VERSION, instructions: RELAY_INSTRUCTIONS };
  const sessions = new Map<string, McpSession>();
  const hits = new Map<string, { n: number; t: number }>();
  const limit = o.rateLimitPerMinute ?? 120;
  const log = o.log ?? (() => {});

  const res = (status: number, body: BodyInit | null, type = 'application/json', extra: Record<string, string> = {}) =>
    new Response(body, { status, headers: { 'content-type': type, 'x-content-type-options': 'nosniff', ...CORS, ...extra } });
  const json = (status: number, v: unknown, extra: Record<string, string> = {}) => res(status, JSON.stringify(v), 'application/json', extra);
  const authorized = (req: Request) => !o.token || req.headers.get('authorization') === `Bearer ${o.token}`;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const base = (o.publicUrl ?? url.origin).replace(/\/$/, '');
    const tools = relayTools(store, { publicUrl: base });
    const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.t > 60000) hits.set(ip, { n: 1, t: now });
    else if (++h.n > limit) return json(429, { error: 'Too many requests' });

    try {
      if (req.method === 'OPTIONS') return res(204, null);
      if (url.pathname === '/healthz') return json(200, { ok: true, version: VERSION });

      // ── MCP (Streamable HTTP, JSON response mode) ──
      if (url.pathname === mcpPath || url.pathname === mcpPath + '/') {
        if (req.method === 'GET') return json(405, { error: 'No SSE stream here; POST JSON-RPC instead.' }, { allow: 'POST, DELETE' });
        if (req.method === 'DELETE') {
          sessions.delete(req.headers.get('mcp-session-id') ?? '');
          return res(200, null);
        }
        if (req.method !== 'POST') return json(405, { error: 'POST only' });
        const body = (await req.json()) as Record<string, unknown> | Record<string, unknown>[];
        const msgs = Array.isArray(body) ? body : [body];
        let sid = req.headers.get('mcp-session-id') ?? '';
        let session = sessions.get(sid);
        if (!session) {
          session = { clientName: (req.headers.get('x-baton-client') ?? req.headers.get('user-agent') ?? 'mcp-client').slice(0, 60) };
          if (msgs.some((m) => m.method === 'initialize')) {
            sid = crypto.randomUUID();
            sessions.set(sid, session);
            if (sessions.size > 5000) sessions.delete(sessions.keys().next().value!);
          }
        }
        const out = (await Promise.all(msgs.map((m) => handleRpc(m, tools, info, session!)))).filter(Boolean);
        const headers: Record<string, string> = sid && sessions.has(sid) ? { 'mcp-session-id': sid } : {};
        log(`mcp ${msgs.map((m) => (m.method === 'tools/call' ? `tools/call:${(m.params as { name?: string })?.name}` : m.method)).join(',')} from ${session.clientName}`);
        if (!out.length) return res(202, null, 'application/json', headers);
        return json(200, Array.isArray(body) ? out : out[0], headers);
      }

      // ── REST ──
      if (url.pathname === '/api/handoffs' && req.method === 'POST') {
        if (!authorized(req)) return json(401, { error: 'Bearer token required' });
        const text = await req.text();
        if (text.length > store.maxBytes + 1048576) return json(413, { error: 'Too large' });
        const b = JSON.parse(text) as { bundle?: BatonBundle; sealed?: SealedPayload; title?: string; from?: string };
        if (!b.bundle && !b.sealed) return json(400, { error: 'Send {bundle} or {sealed}' });
        if (b.bundle && b.bundle.schema !== 'baton.bundle/v1') return json(400, { error: 'Unsupported bundle schema' });
        const rec = await store.create({ title: b.title ?? b.bundle?.title, from: b.from ?? 'api', bundle: b.bundle, sealed: b.sealed });
        log(`upload ${rec.code}${b.sealed ? ' (sealed)' : ''}`);
        return json(201, { code: rec.code, expiresAt: rec.expiresAt, url: `${base}/h/${rec.code}` });
      }
      const api = url.pathname.match(/^\/api\/handoffs\/([^/]+)(\/checkpoints)?$/);
      if (api) {
        const code = normaliseCode(decodeURIComponent(api[1]));
        if (!CODE_RE.test(code)) return json(400, { error: 'Invalid code' });
        if (api[2] && req.method === 'POST') {
          if (!authorized(req)) return json(401, { error: 'Bearer token required' });
          const cp = (await req.json()) as Record<string, unknown>;
          const text = await tools.find((t) => t.name === 'baton_checkpoint')!.run({ ...cp, handoff: code }, { clientName: String(cp.from ?? 'api') });
          return json(200, { ok: true, message: text });
        }
        const rec = await store.get(code);
        if (!rec) return json(404, { error: 'Not found or expired' });
        return json(200, rec);
      }

      // ── Viewer ──
      const view = url.pathname.match(/^\/h\/([^/.]+)(\.zip)?$/);
      if (view && req.method === 'GET') {
        const rec = await store.get(decodeURIComponent(view[1]));
        if (!rec) return res(404, page('Not found', '<p>This handoff does not exist or has expired.</p>'), 'text/html; charset=utf-8');
        if (rec.sealed && !rec.bundle) {
          if (view[2]) return json(400, { error: 'Sealed handoffs are decrypted in the browser; open /h/<code>#<key>' });
          return res(200, sealedPage(rec.code, rec.title), 'text/html; charset=utf-8', { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
        }
        const { files } = renderRecord(rec);
        if (view[2]) {
          const prefixed: Record<string, string | Uint8Array> = {};
          for (const [k, v] of Object.entries(files)) prefixed[`${rec.code}/${k}`] = v;
          return res(200, zip(prefixed) as BodyInit, 'application/zip', { 'content-disposition': `attachment; filename="${rec.code}.baton.zip"` });
        }
        return res(200, String(files['index.html']), 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:", 'referrer-policy': 'no-referrer' });
      }

      // Never reveal a secret MCP path on the public home page.
      if (url.pathname === '/' && req.method === 'GET') return res(200, page('Baton relay', landing(base, o.mcpSecret ? '/mcp/<your secret>' : mcpPath)), 'text/html; charset=utf-8');
      return json(404, { error: 'Not found' });
    } catch (err) {
      return json(400, { error: err instanceof Error ? err.message : String(err) });
    }
  };
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>:root{--bg:#f3f5f4;--fg:#14201b;--mu:#5b6b64;--ac:#2343c9}@media (prefers-color-scheme:dark){:root{--bg:#0f1513;--fg:#e4ebe7;--mu:#9aaba3;--ac:#8ea4ff}}
body{background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:32px 16px}h1{font-size:34px;margin:0 0 8px}code,pre{font:13px ui-monospace,monospace}pre{background:color-mix(in srgb,var(--fg) 6%,transparent);padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap}a{color:var(--ac)}.mu{color:var(--mu)}button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid var(--fg);background:none;color:var(--fg);cursor:pointer}</style></head><body>${body}</body></html>`;
}

function landing(base: string, mcpPath: string): string {
  const mcp = base + mcpPath;
  return `<h1>Baton relay</h1><p class="mu">Hands AI work from one assistant to another (prompts, files, tool outputs and decisions) from inside the assistants.</p>
<h2>Add it to an AI</h2><p><b>MCP server URL:</b></p><pre>${escapeHtml(mcp)}</pre>
<ul><li><b>ChatGPT</b>: Settings → Apps &amp; Connectors → Advanced settings → turn on Developer mode → Create. Paste the URL, choose "No authentication".</li>
<li><b>Claude</b> (web/desktop): Settings → Connectors → Add custom connector → paste the URL.</li>
<li><b>Claude Code</b>: <code>claude mcp add --transport http baton ${escapeHtml(mcp)}</code></li>
<li><b>Cursor / Codex / Gemini CLI</b>: add an HTTP MCP server with this URL.</li>
<li><b>Baton browser extension</b>: Options → Relay URL: <code>${escapeHtml(base)}</code></li></ul>
<h2>Use it</h2><p>In any AI: <i>"baton: hand this off"</i> → you get a code like <code>BTN-7F3K-9QXA-2M4P</code>. In another AI: <i>"baton pickup BTN-7F3K-9QXA-2M4P"</i>. Or open <code>${escapeHtml(base)}/h/&lt;code&gt;</code>.</p>`;
}

function sealedPage(code: string, title: string): string {
  return page(
    `Baton · ${title}`,
    `<h1>${escapeHtml(title)}</h1><p class="mu">End-to-end encrypted handoff <code>${escapeHtml(code)}</code>. It is decrypted here in your browser. The server never had the key.</p>
<div id="out"><p>Decrypting…</p></div>
<script>(async()=>{const out=document.getElementById('out');const key=location.hash.slice(1);if(!key){out.innerHTML='<p>This link is missing its #key part. Ask the sender for the full link.</p>';return}
try{const r=await fetch('/api/handoffs/${code}');const rec=await r.json();const b=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const kb=b(key.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((key.length+3)%4));
const k=await crypto.subtle.importKey('raw',kb,'AES-GCM',false,['decrypt']);const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b(rec.sealed.iv)},k,b(rec.sealed.data));
const p=JSON.parse(new TextDecoder().decode(pt));const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
out.innerHTML='<p><button id="cp">Copy paste-ready prompt</button> <button id="dl">Download bundle (.zip)</button></p><h2>HANDOFF.md</h2><pre>'+esc(p.handoff)+'</pre>';
document.getElementById('cp').onclick=()=>navigator.clipboard.writeText(p.prompt);
document.getElementById('dl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([b(p.zip)],{type:'application/zip'}));a.download='${code}.baton.zip';a.click()};
}catch(e){out.innerHTML='<p>Could not decrypt this handoff (wrong key or damaged data).</p>'}})();</script>`,
  );
}
