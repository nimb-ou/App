// Baton relay hub: one small zero-dependency HTTP server that embeds Baton in web AIs.
//
//   POST /mcp[/<secret>]          MCP over Streamable HTTP (JSON responses): baton_checkpoint, baton_pickup, baton_get_file
//   POST /api/handoffs            upload a captured bundle {bundle} or an end-to-end sealed one {sealed, title}
//   GET  /api/handoffs/<code>     record as JSON (sealed payloads stay opaque)
//   POST /api/handoffs/<code>/checkpoints   append a checkpoint (same fields as the MCP tool)
//   GET  /h/<code>                human viewer (sealed: decrypts in the browser with the #key)
//   GET  /h/<code>.zip            bundle as a zip
//   GET  /healthz
//
// Env: PORT, BATON_STORE, BATON_PUBLIC_URL, BATON_RELAY_TOKEN (bearer for REST writes),
//      BATON_MCP_SECRET (serve MCP only at /mcp/<secret>), BATON_TTL_DAYS, BATON_MAX_BYTES.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { BatonBundle } from '../core/schema.ts';
import { VERSION } from '../core/schema.ts';
import { escapeHtml } from '../core/util.ts';
import { zip } from '../core/zip.ts';
import { handleRpc, type McpSession } from '../mcp/protocol.ts';
import { renderRecord, type SealedPayload } from './checkpoint.ts';
import { CODE_RE, normaliseCode, RelayStore } from './store.ts';
import { RELAY_INSTRUCTIONS, relayTools } from './tools.ts';

export interface RelayServerOptions {
  port?: number;
  host?: string;
  store?: RelayStore;
  publicUrl?: string;
  token?: string;
  mcpSecret?: string;
  rateLimitPerMinute?: number;
  log?: (msg: string) => void;
}

export function createRelayServer(o: RelayServerOptions = {}) {
  const store = o.store ?? new RelayStore();
  const publicUrl = o.publicUrl ?? process.env.BATON_PUBLIC_URL;
  const token = o.token ?? process.env.BATON_RELAY_TOKEN;
  const mcpSecret = o.mcpSecret ?? process.env.BATON_MCP_SECRET;
  const mcpPath = mcpSecret ? `/mcp/${mcpSecret}` : '/mcp';
  const tools = relayTools(store, { publicUrl });
  const info = { name: 'baton-relay', version: VERSION, instructions: RELAY_INSTRUCTIONS };
  const sessions = new Map<string, McpSession>();
  const hits = new Map<string, { n: number; t: number }>();
  const limit = o.rateLimitPerMinute ?? 120;
  const log = o.log ?? (() => {});

  const send = (res: ServerResponse, status: number, body: string | Uint8Array, type = 'application/json', extra: Record<string, string> = {}) => {
    res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, mcp-session-id, mcp-protocol-version', 'access-control-expose-headers': 'mcp-session-id', 'x-content-type-options': 'nosniff', ...extra });
    res.end(body);
  };
  const json = (res: ServerResponse, status: number, v: unknown, extra: Record<string, string> = {}) => send(res, status, JSON.stringify(v), 'application/json', extra);

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > store.maxBytes + 1024 * 1024) {
          reject(new Error('Request too large'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  const authorized = (req: IncomingMessage) => !token || req.headers.authorization === `Bearer ${token}`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://relay.local');
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.t > 60000) hits.set(ip, { n: 1, t: now });
    else if (++h.n > limit) return json(res, 429, { error: 'Too many requests' });

    try {
      if (req.method === 'OPTIONS') return send(res, 204, '');
      if (url.pathname === '/healthz') return json(res, 200, { ok: true, version: VERSION });

      // ── MCP (Streamable HTTP, JSON response mode) ──
      if (url.pathname === mcpPath) {
        if (req.method === 'GET') return json(res, 405, { error: 'This server does not offer an SSE stream; POST JSON-RPC instead.' }, { allow: 'POST, DELETE' });
        if (req.method === 'DELETE') {
          sessions.delete(String(req.headers['mcp-session-id'] ?? ''));
          return send(res, 200, '');
        }
        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
        const body = JSON.parse(await readBody(req)) as Record<string, unknown> | Record<string, unknown>[];
        let sid = String(req.headers['mcp-session-id'] ?? '');
        let session = sessions.get(sid);
        const msgs = Array.isArray(body) ? body : [body];
        if (!session) {
          session = { clientName: String(req.headers['x-baton-client'] ?? req.headers['user-agent'] ?? 'mcp-client').slice(0, 60) };
          if (msgs.some((m) => m.method === 'initialize')) {
            sid = randomUUID();
            sessions.set(sid, session);
          }
        }
        const out = (await Promise.all(msgs.map((m) => handleRpc(m, tools, info, session!)))).filter(Boolean);
        const headers: Record<string, string> = sid && sessions.has(sid) ? { 'mcp-session-id': sid } : {};
        if (!out.length) return send(res, 202, '', 'application/json', headers);
        log(`mcp ${msgs.map((m) => (m.method === 'tools/call' ? `tools/call:${(m.params as { name?: string })?.name}` : m.method)).join(',')} from ${session.clientName}`);
        return json(res, 200, Array.isArray(body) ? out : out[0], headers);
      }

      // ── REST ──
      if (url.pathname === '/api/handoffs' && req.method === 'POST') {
        if (!authorized(req)) return json(res, 401, { error: 'Bearer token required' });
        const b = JSON.parse(await readBody(req)) as { bundle?: BatonBundle; sealed?: SealedPayload; title?: string; from?: string };
        if (!b.bundle && !b.sealed) return json(res, 400, { error: 'Send {bundle} or {sealed}' });
        if (b.bundle && b.bundle.schema !== 'baton.bundle/v1') return json(res, 400, { error: 'Unsupported bundle schema' });
        const rec = store.create({ title: b.title ?? b.bundle?.title, from: b.from ?? 'api', bundle: b.bundle, sealed: b.sealed });
        log(`upload ${rec.code} ${b.sealed ? '(sealed)' : ''}`);
        return json(res, 201, { code: rec.code, expiresAt: rec.expiresAt, url: publicUrl ? `${publicUrl.replace(/\/$/, '')}/h/${rec.code}` : `/h/${rec.code}` });
      }
      const api = url.pathname.match(/^\/api\/handoffs\/([^/]+)(\/checkpoints)?$/);
      if (api) {
        const code = normaliseCode(decodeURIComponent(api[1]));
        if (!CODE_RE.test(code)) return json(res, 400, { error: 'Invalid code' });
        if (api[2] && req.method === 'POST') {
          if (!authorized(req)) return json(res, 401, { error: 'Bearer token required' });
          const cp = JSON.parse(await readBody(req)) as Record<string, unknown>;
          const tool = tools.find((t) => t.name === 'baton_checkpoint')!;
          const text = await tool.run({ ...cp, handoff: code }, { clientName: String(cp.from ?? 'api') });
          return json(res, 200, { ok: true, message: text });
        }
        const rec = store.get(code);
        if (!rec) return json(res, 404, { error: 'Not found or expired' });
        return json(res, 200, rec);
      }

      // ── Viewer ──
      const view = url.pathname.match(/^\/h\/([^/.]+)(\.zip)?$/);
      if (view && req.method === 'GET') {
        const rec = store.get(decodeURIComponent(view[1]));
        if (!rec) return send(res, 404, page('Not found', '<p>This handoff does not exist or has expired.</p>'), 'text/html; charset=utf-8');
        if (rec.sealed && !rec.bundle) {
          if (view[2]) return json(res, 400, { error: 'Sealed handoffs are decrypted in the browser; open /h/<code>#<key>' });
          return send(res, 200, sealedPage(rec.code, rec.title), 'text/html; charset=utf-8', { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
        }
        const { files } = renderRecord(rec);
        if (view[2]) {
          const prefixed: Record<string, string | Uint8Array> = {};
          for (const [k, v] of Object.entries(files)) prefixed[`${rec.code}/${k}`] = v;
          return send(res, 200, zip(prefixed), 'application/zip', { 'content-disposition': `attachment; filename="${rec.code}.baton.zip"` });
        }
        return send(res, 200, String(files['index.html']), 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:", 'referrer-policy': 'no-referrer' });
      }

      if (url.pathname === '/' && req.method === 'GET') {
        const base = publicUrl ?? `http://${req.headers.host}`;
        return send(res, 200, page('Baton relay', landing(base, mcpPath)), 'text/html; charset=utf-8');
      }
      return json(res, 404, { error: 'Not found' });
    } catch (err) {
      return json(res, 400, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  const timer = setInterval(() => store.purgeExpired(), 3600000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return { server, store, mcpPath };
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>:root{--bg:#f3f5f4;--fg:#14201b;--mu:#5b6b64;--ac:#2343c9;--line:#d7dfdb}@media (prefers-color-scheme:dark){:root{--bg:#0f1513;--fg:#e4ebe7;--mu:#9aaba3;--ac:#8ea4ff;--line:#2a3632}}
body{background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:32px 16px}h1{font-size:34px;margin:0 0 8px}code,pre{font:13px ui-monospace,monospace}pre{background:color-mix(in srgb,var(--fg) 6%,transparent);padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap}a{color:var(--ac)}.mu{color:var(--mu)}button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid var(--fg);background:none;color:var(--fg);cursor:pointer}</style></head><body>${body}</body></html>`;
}

function landing(base: string, mcpPath: string): string {
  const mcp = base.replace(/\/$/, '') + mcpPath;
  return `<h1>Baton relay</h1><p class="mu">Hands AI work from one assistant to another, with prompts, files, tool outputs and decisions, from inside the assistants.</p>
<h2>Add it to an AI</h2>
<p><b>MCP server URL:</b></p><pre>${escapeHtml(mcp)}</pre>
<ul><li><b>ChatGPT</b>: Settings → Apps &amp; Connectors → Advanced → Developer mode → Create, paste the URL, authentication "No authentication".</li>
<li><b>Claude</b> (web/desktop): Settings → Connectors → Add custom connector → paste the URL.</li>
<li><b>Claude Code</b>: <code>claude mcp add --transport http baton ${escapeHtml(mcp)}</code></li>
<li><b>Cursor / Codex / Gemini CLI</b>: add an HTTP MCP server with this URL.</li></ul>
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

export function startRelay(o: RelayServerOptions = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const { server, mcpPath } = createRelayServer(o);
  const port = o.port ?? Number(process.env.PORT ?? 8787);
  return new Promise((resolve) => {
    server.listen(port, o.host ?? '0.0.0.0', () => {
      const addr = server.address();
      const actual = typeof addr === 'object' && addr ? addr.port : port;
      const url = `http://localhost:${actual}`;
      (o.log ?? console.error)(`Baton relay ${VERSION} listening on ${url} · MCP at ${url}${mcpPath}`);
      resolve({ url, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
