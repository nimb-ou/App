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
import { aiBrief, continueUrl } from './linkpage.ts';
import { BOOKMARKLET_VERSION, bookmarkletSource, captureToIngest, ingestToBundle, isCapture, pasteToBundle, receivePage, type IngestBody } from './ingest.ts';
import { FAVICON_SVG, SITE_CSP, webManifest } from '../site/brand.ts';
import { handoffPage } from '../site/handoff.ts';
import { homePage } from '../site/home.ts';
import { tryPage } from '../site/try.ts';
import { messagePage, privacyPage } from '../site/pages.ts';
import { ICON512_PNG_B64, ICON_PNG_B64, OG_PNG_B64 } from '../site/assets.gen.ts';
import { base64ToBytes } from '../core/util.ts';
import type { RelayRecord } from './checkpoint.ts';
import { buildBundle } from '../core/build.ts';
import { parseChatGPTShareHtml } from '../parsers/chatgpt.ts';
import { renderBundleFiles } from '../render/files.ts';
import type { FileMap } from '../core/zip.ts';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

/** Accepts /https://chatgpt.com/share/<id>, /https:/chatgpt.com/… (merged slashes), /chatgpt.com/share/<id>, /share/<id>, plus .md/.zip//full. */
export function shareIdFrom(pathname: string): { id: string; mode: string } | undefined {
  const m = decodeURIComponent(pathname).match(/^\/(?:https?:\/{1,2})?(?:(?:www\.)?chatgpt\.com|chat\.openai\.com)?\/?share\/([0-9a-f]{8}-[0-9a-f-]{20,})(\.zip|\.md|\/full)?\/?$/i);
  return m ? { id: m[1].toLowerCase(), mode: m[2] ?? '' } : undefined;
}

export interface RelayHandlerOptions {
  store: AsyncRelayStore;
  publicUrl?: string;
  token?: string; // bearer required for REST uploads
  mcpSecret?: string; // serve MCP only at /mcp/<secret>
  rateLimitPerMinute?: number;
  log?: (msg: string) => void;
  demo?: BatonBundle; // permanent example served at /demo
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const ownerCookieName = (code: string) => `bo_${code.replace(/-/g, '')}`;

/** A fresh delete key for a new handoff: the hash goes in the record, the key in the creator's cookie. */
async function newOwner(): Promise<{ key: string; hash: string }> {
  const key = hex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  return { key, hash: await sha256Hex(key) };
}

function readCookie(req: Request, name: string): string | undefined {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([0-9a-f]{32})`));
  return m?.[1];
}

async function isOwner(req: Request, rec: RelayRecord): Promise<boolean> {
  const key = readCookie(req, ownerCookieName(rec.code));
  return !!(key && rec.owner && (await sha256Hex(key)) === rec.owner);
}

const SITE_HEADERS = {
  'content-security-policy': SITE_CSP,
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'cross-origin-opener-policy': 'same-origin-allow-popups',
};
const OG_PATH = '/og.png';

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
  const demoFacts = o.demo ? { stats: o.demo.stats, title: o.demo.title, lostToolOutputs: o.demo.loss.find((l) => l.category === 'tool-outputs')?.count ?? 0 } : undefined;

  const res = (status: number, body: BodyInit | null, type = 'application/json', extra: Record<string, string> = {}) =>
    new Response(body, { status, headers: { 'content-type': type, 'x-content-type-options': 'nosniff', ...CORS, ...extra } });
  const json = (status: number, v: unknown, extra: Record<string, string> = {}) => res(status, JSON.stringify(v), 'application/json', extra);
  const authorized = (req: Request) => !o.token || req.headers.get('authorization') === `Bearer ${o.token}`;

  /** One bundle, four views: link page (default), full transcript viewer, plain Markdown for AIs, zip. */
  const serveBundle = (bundle: BatonBundle, files: FileMap, selfUrl: string, mode: string, url: URL, zipName: string, page: { code: string; expiresAt?: string; owner?: boolean; base: string }): Response => {
    if (mode === '.zip') {
      const prefixed: Record<string, string | Uint8Array> = {};
      for (const [k, v] of Object.entries(files)) prefixed[`${zipName}/${k}`] = v;
      return res(200, zip(prefixed) as BodyInit, 'application/zip', { 'content-disposition': `attachment; filename="${zipName}.baton.zip"` });
    }
    if (mode === '.md' || url.searchParams.get('format') === 'md') return res(200, aiBrief(bundle, files), 'text/markdown; charset=utf-8', { 'cache-control': 'no-store' });
    if (mode === '/full') return res(200, String(files['index.html']), 'text/html; charset=utf-8', { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:", 'referrer-policy': 'no-referrer' });
    const to = url.searchParams.get('to');
    const banner = to === 'gemini' ? 'gemini' : url.searchParams.has('new') ? 'new' : undefined;
    const html = handoffPage({ bundle, files, selfUrl, code: page.code, expiresAt: page.expiresAt, owner: page.owner, banner, update: url.searchParams.has('upd'), ogImage: page.base + OG_PATH });
    return res(200, html, 'text/html; charset=utf-8', { ...SITE_HEADERS, 'cache-control': 'no-store' });
  };

  /** Store a new handoff created in this browser, with a delete key for its creator. */
  const createOwned = async (bundle: BatonBundle, from: string) => {
    const own = await newOwner();
    const rec = await store.create({ title: bundle.title, from, bundle, owner: own.hash });
    const maxAge = Math.max(60, Math.round((Date.parse(rec.expiresAt) - Date.now()) / 1000));
    const cookie = `${ownerCookieName(rec.code)}=${own.key}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
    return { rec, cookie };
  };
  const htmlError = (status: number, title: string, text: string) => res(status, messagePage(title, text), 'text/html; charset=utf-8', { ...SITE_HEADERS, 'cache-control': 'no-store' });

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
      if (req.method === 'GET' && url.pathname === '/favicon.svg') return res(200, FAVICON_SVG, 'image/svg+xml', { 'cache-control': 'public, max-age=86400' });
      if (req.method === 'GET' && (url.pathname === '/favicon.ico' || url.pathname === '/icon.png' || url.pathname === '/apple-touch-icon.png')) return res(200, base64ToBytes(ICON_PNG_B64) as BodyInit, 'image/png', { 'cache-control': 'public, max-age=86400' });
      if (req.method === 'GET' && url.pathname === '/icon-512.png') return res(200, base64ToBytes(ICON512_PNG_B64) as BodyInit, 'image/png', { 'cache-control': 'public, max-age=86400' });
      if (req.method === 'GET' && url.pathname === '/manifest.webmanifest') return res(200, JSON.stringify(webManifest()), 'application/manifest+json', { 'cache-control': 'public, max-age=86400' });
      if (req.method === 'GET' && url.pathname === OG_PATH) return res(200, base64ToBytes(OG_PNG_B64) as BodyInit, 'image/png', { 'cache-control': 'public, max-age=86400' });
      if (req.method === 'GET' && url.pathname === '/privacy') return res(200, privacyPage(Math.round(store.ttlMs / 86400000)), 'text/html; charset=utf-8', SITE_HEADERS);
      if (req.method === 'GET' && url.pathname === '/try') return res(200, tryPage(o.demo, bookmarkletSource(base)), 'text/html; charset=utf-8', { ...SITE_HEADERS, 'cache-control': 'no-store' });
      if (req.method === 'GET' && url.pathname === '/robots.txt') return res(200, 'User-agent: *\nDisallow: /h/\nDisallow: /api/\n', 'text/plain');
      const demo = url.pathname.match(/^\/demo(\.zip|\.md|\/full)?\/?$/);
      if (demo && req.method === 'GET') {
        if (!o.demo) return htmlError(404, 'No demo here', 'This Baton server has no demo handoff configured.');
        return serveBundle(o.demo, renderBundleFiles(o.demo), `${base}/demo`, demo[1] ?? '', url, 'baton-demo', { code: 'demo', base });
      }

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
        const { owner: _owner, ...pub } = rec;
        return json(200, pub);
      }

      // ── Viewer: /h/<code>  (link page) · /h/<code>/full · /h/<code>.md · /h/<code>.zip ──
      const del = url.pathname.match(/^\/h\/([^/.]+)\/delete$/);
      if (del && req.method === 'POST') {
        const rec = await store.get(decodeURIComponent(del[1]));
        if (!rec) return htmlError(404, 'Already gone', 'This handoff was deleted or has expired.');
        if (!(await isOwner(req, rec))) return htmlError(403, 'Not yours to delete', 'Only the browser that created this handoff can delete it. It will expire on its own.');
        await store.remove(rec.code);
        log(`delete ${rec.code}`);
        return new Response(null, { status: 303, headers: { location: `${base}/?deleted=1`, 'set-cookie': `${ownerCookieName(rec.code)}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`, 'cache-control': 'no-store' } });
      }
      const view = url.pathname.match(/^\/h\/([^/.]+)(\.zip|\.md|\/full)?\/?$/);
      if (view && req.method === 'GET') {
        const rec = await store.get(decodeURIComponent(view[1]));
        if (!rec) return htmlError(404, 'This link has expired', 'Handoffs delete themselves after a few days, or their creator deleted this one. Ask for a fresh link.');
        if (rec.sealed && !rec.bundle) {
          if (view[2]) return json(400, { error: 'Sealed handoffs are decrypted in the browser; open /h/<code>#<key>' });
          return res(200, sealedPage(rec.code, rec.title), 'text/html; charset=utf-8', { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
        }
        const { bundle, files } = renderRecord(rec);
        return serveBundle(bundle, files, `${base}/h/${rec.code}`, view[2] ?? '', url, rec.code, { code: rec.code, expiresAt: rec.expiresAt, owner: await isOwner(req, rec), base });
      }

      // ── Baton Link: /<chatgpt share url>  (prefix any share link with this site) ──
      const share = shareIdFrom(url.pathname);
      if (share && req.method === 'GET') {
        const { mode, id } = share;
        const cacheKey = `s:${id}`;
        let bundle: BatonBundle | undefined;
        const cached = url.searchParams.has('refresh') ? null : await store.kv.get(cacheKey);
        if (cached) bundle = JSON.parse(cached) as BatonBundle;
        else {
          const shareUrl = `https://chatgpt.com/share/${id}`;
          const up = await fetch(shareUrl, { headers: { 'user-agent': BROWSER_UA, accept: 'text/html', 'accept-language': 'en-US,en;q=0.9' }, redirect: 'follow' });
          const html = await up.text();
          if (!up.ok || !html.includes('streamController.enqueue')) {
            log(`share fetch ${id.slice(0, 8)}… → ${up.status}`);
            return htmlError(502, 'ChatGPT blocked the server', `ChatGPT answered HTTP ${up.status} when Baton's server asked for this share link. It blocks servers, not people: open the link yourself and click the Baton bookmark, or select all, copy, and paste it on the Baton home page.`);
          }
          bundle = buildBundle(parseChatGPTShareHtml(html, shareUrl)).bundle;
          await store.kv.put(cacheKey, JSON.stringify(bundle), { expirationTtl: 6 * 3600 });
        }
        const files = renderBundleFiles(bundle);
        return serveBundle(bundle, files, `${base}/https://chatgpt.com/share/${id}`, mode, url, id.slice(0, 8), { code: id.slice(0, 8), base });
      }

      // ── Bookmarklet capture: popup page + upload endpoint ──
      if (url.pathname === '/receive' && req.method === 'GET') return res(200, receivePage(), 'text/html; charset=utf-8', { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
      if (url.pathname === '/api/ingest' && req.method === 'POST') {
        if (!authorized(req)) return json(401, { error: 'Bearer token required' });
        const text = await req.text();
        if (text.length > store.maxBytes) return json(413, { error: 'Conversation too large for this relay' });
        const body = JSON.parse(text) as unknown;
        const to = isCapture(body) ? body.to : undefined;
        const bundle = ingestToBundle(isCapture(body) ? captureToIngest(body) : (body as IngestBody));
        const { rec, cookie } = await createOwned(bundle, 'bookmarklet');
        log(`ingest ${rec.code} (${bundle.source.tool}) → ${to ?? 'link'}`);
        const link = `${base}/h/${rec.code}`;
        return json(201, { code: rec.code, url: link, next: continueUrl(to, link, bundle), title: bundle.title, stats: bundle.stats }, { 'set-cookie': cookie });
      }
      // Paste box on the home page: pasted chat text, or an export / share-page file.
      if (url.pathname === '/api/paste' && req.method === 'POST') {
        const text = await req.text();
        if (text.length > store.maxBytes) return json(413, { error: 'That is too large for this server. Paste a single conversation.' });
        const body = JSON.parse(text) as { text?: string; filename?: string; to?: string };
        const bundle = pasteToBundle(String(body.text ?? ''), String(body.filename ?? ''));
        const { rec, cookie } = await createOwned(bundle, 'paste');
        log(`paste ${rec.code} (${bundle.source.tool}) → ${body.to ?? 'link'}`);
        const link = `${base}/h/${rec.code}`;
        return json(201, { code: rec.code, url: link, next: continueUrl(body.to, link, bundle) }, { 'set-cookie': cookie });
      }
      // Form POST from the bookmarklet (works under COOP: same-origin, e.g. claude.ai). Answers with a redirect.
      if (url.pathname === '/api/ingest-form' && req.method === 'POST') {
        const fail = (status: number, msg: string) => htmlError(status, 'Baton could not save this chat', `${msg} Nothing was saved. Try again on an open chat, or paste it on the Baton home page.`);
        if (o.token) return fail(401, 'This server requires a token, so the bookmark cannot upload to it.');
        const text = await req.text();
        if (text.length > store.maxBytes * 1.5) return fail(413, 'This conversation is too large for this server.');
        try {
          const d = JSON.parse(new URLSearchParams(text).get('d') ?? 'null') as unknown;
          if (!isCapture(d)) return fail(400, 'Nothing was captured.');
          const bundle = ingestToBundle(captureToIngest(d));
          const { rec, cookie } = await createOwned(bundle, 'bookmarklet');
          log(`ingest-form ${rec.code} (${bundle.source.tool}) → ${d.to ?? 'link'}`);
          const stale = (d.v ?? 1) < BOOKMARKLET_VERSION; // an old bookmark: offer the new one on the link page
          const location = continueUrl(d.to, `${base}/h/${rec.code}`, bundle) + (stale && !d.to ? '&upd=1' : '');
          return new Response(null, { status: 303, headers: { location, 'set-cookie': cookie, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
        } catch (err) {
          return fail(400, err instanceof Error ? err.message : String(err));
        }
      }

      // ── Paste box target: /go?u=<share link | code> ──
      if (url.pathname === '/go' && req.method === 'GET') {
        const u = (url.searchParams.get('u') ?? '').trim();
        const sid = u.match(/(?:chatgpt\.com|chat\.openai\.com)\/share\/([0-9a-f-]{20,})/i)?.[1];
        if (sid) return Response.redirect(`${base}/https://chatgpt.com/share/${sid}`, 302);
        const code = normaliseCode(u.replace(/^.*\/h\//, '').split('#')[0]);
        if (CODE_RE.test(code)) return Response.redirect(`${base}/h/${code}${u.includes('#') ? '#' + u.split('#')[1] : ''}`, 302);
        return htmlError(400, 'Not recognised', 'Paste a Baton link or code (BTN-…), or a ChatGPT share link.');
      }

      // Never reveal a secret MCP path on the public home page.
      if (url.pathname === '/' && req.method === 'GET') {
        const html = homePage({ base, bookmarklet: bookmarkletSource(base), mcpDisplay: o.mcpSecret ? '/mcp/<your secret>' : mcpPath, demo: demoFacts, ogImage: base + OG_PATH });
        return res(200, html, 'text/html; charset=utf-8', { ...SITE_HEADERS, 'cache-control': 'public, max-age=300' });
      }
      if (req.method === 'GET' && (req.headers.get('accept') ?? '').includes('text/html')) return htmlError(404, 'Nothing here', 'That page does not exist.');
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
