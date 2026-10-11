import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { verifyBundle } from '../src/core/integrity.ts';
import { convert } from '../src/pipeline.ts';
import { pickup, sendBundle } from '../src/relay/client.ts';
import { renderRecord } from '../src/relay/checkpoint.ts';
import { parsePickup, seal, unseal } from '../src/relay/seal.ts';
import { startRelay } from '../src/relay/server.ts';
import { CODE_RE, newCode, normaliseCode, RelayStore } from '../src/relay/store.ts';
import { AsyncRelayStore, MemoryKV } from '../src/relay/kvstore.ts';
import { createRelayHandler } from '../src/relay/handler.ts';
import { relayTools } from '../src/relay/tools.ts';

const tmp = mkdtempSync(join(tmpdir(), 'baton-relay-'));
after(() => rmSync(tmp, { recursive: true, force: true }));

describe('codes and sealing', () => {
  it('generates and normalises capability codes', () => {
    const c = newCode();
    assert.match(c, CODE_RE);
    assert.equal(normaliseCode(c.toLowerCase().replace(/-/g, ' ')), c);
    assert.equal(normaliseCode('btn-0oil-0000-0000'), 'BTN-0011-0000-0000');
  });
  it('seals and unseals; rejects a wrong key', async () => {
    const { sealed, key } = await seal(new TextEncoder().encode('secret work'));
    assert.equal(new TextDecoder().decode(await unseal(sealed, key)), 'secret work');
    await assert.rejects(unseal(sealed, 'A'.repeat(43)), /Could not decrypt/);
  });
  it('parses pickup links', () => {
    assert.deepEqual(parsePickup('https://r.example/h/BTN-AAAA-BBBB-CCCC#k3y'), { base: 'https://r.example', code: 'BTN-AAAA-BBBB-CCCC', key: 'k3y' });
    assert.deepEqual(parsePickup('btn-aaaa-bbbb-cccc'), { code: 'BTN-AAAA-BBBB-CCCC', key: undefined });
  });
});

describe('model checkpoints (MCP tools over the store)', () => {
  const store = new RelayStore({ dir: join(tmp, 'tools') });
  const tools = Object.fromEntries(relayTools(store, { allowList: true }).map((t) => [t.name, t]));
  let code = '';

  it('creates a handoff with files, tool outputs and recalled prompts', async () => {
    const out = await tools.baton_checkpoint.run(
      {
        title: 'Lab',
        goal: 'Build the lab',
        state: 'App written',
        user_prompts: ['Build it', 'Build it'],
        files: [{ path: '/mnt/data/pkg/app.py', content: 'print(1)\n' }, { path: '/mnt/data/fig.png', content: 'iVBORw0KGgo=', encoding: 'base64' }],
        tool_outputs: [{ tool: 'python', output: 'P=70.24%' }],
      },
      { clientName: 'ChatGPT' },
    );
    code = out.match(/BTN-[0-9A-Z-]{14}/)![0];
    assert.match(out, /2 file\(s\), 1 tool output/);
  });
  it('appends checkpoints from another AI and renders one bundle', async () => {
    await tools.baton_checkpoint.run({ handoff: code, state: 'Tests added', files: [{ path: '/mnt/data/pkg/app.py', content: 'print(2)\n' }] }, { clientName: 'claude-ai' });
    const rec = (await store.get(code))!;
    assert.deepEqual(rec.from, ['ChatGPT', 'claude-ai']);
    const { bundle, files } = renderRecord(rec);
    assert.equal(bundle.source.kind, 'baton-relay');
    assert.equal(bundle.events.filter((e) => e.kind === 'message' && e.role === 'user').length, 1, 'duplicate recalled prompts merged');
    const app = bundle.artifacts.find((a) => a.path === 'pkg/app.py')!;
    assert.equal(app.content, 'print(2)\n');
    assert.equal(app.status, 'recovered');
    const png = bundle.artifacts.find((a) => a.path === 'fig.png')!;
    assert.equal(png.encoding, 'base64');
    assert.ok(files['files/fig.png'] instanceof Uint8Array);
    assert.ok(verifyBundle(bundle).ok);
    assert.ok(bundle.loss.some((l) => l.category === 'model-reported'));
  });
  it('picks up and serves single files', async () => {
    const text = await tools.baton_pickup.run({ code: code.toLowerCase() }, { clientName: 'cursor' });
    assert.match(text, /# Handoff: Lab/);
    assert.match(text, /--- files\/pkg\/app\.py ---\nprint\(2\)/);
    assert.equal(await tools.baton_get_file.run({ code, path: 'files/pkg/app.py' }, { clientName: 'x' }), 'print(2)\n');
    assert.match(await tools.baton_list.run({}, { clientName: 'x' }), new RegExp(code));
    await assert.rejects(tools.baton_pickup.run({ code: 'BTN-0000-0000-0000' }, { clientName: 'x' }), /No handoff/);
  });
});

describe('relay HTTP server', () => {
  let url = '';
  let close: () => Promise<void>;
  before(async () => {
    const s = await startRelay({ port: 0, host: '127.0.0.1', store: new RelayStore({ dir: join(tmp, 'http') }), log: () => {} });
    url = s.url;
    close = s.close;
  });
  after(() => close());

  const rpc = async (body: unknown, sid?: string) => {
    const r = await fetch(`${url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify(body) });
    return { r, body: r.status === 202 ? null : ((await r.json()) as { result: { content: { text: string }[]; tools: { name: string }[] } }) };
  };

  it('speaks MCP Streamable HTTP with sessions', async () => {
    const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'ChatGPT' } } });
    const sid = init.r.headers.get('mcp-session-id')!;
    assert.ok(sid);
    assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid)).r.status, 202);
    const tools = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, sid);
    assert.deepEqual(tools.body!.result.tools.map((t) => t.name), ['baton_checkpoint', 'baton_pickup', 'baton_get_file']);
    const cp = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'baton_checkpoint', arguments: { state: 'x', title: 'T' } } }, sid);
    const code = cp.body!.result.content[0].text.match(/BTN-[0-9A-Z-]{14}/)![0];
    const rec = (await (await fetch(`${url}/api/handoffs/${code}`)).json()) as { from: string[] };
    assert.deepEqual(rec.from, ['ChatGPT']);
    const page = await fetch(`${url}/h/${code}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    assert.equal((await fetch(`${url}/mcp`)).status, 405);
  });
  it('round-trips captured and sealed bundles through the CLI client', async () => {
    const [r] = convert(JSON.stringify([{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }]), 'm.json', { now: '2026-01-01T00:00:00Z' });
    const plain = await sendBundle(r.bundle, r.files, { relay: url });
    const back = await pickup(plain.code, { relay: url });
    assert.match(String(back.files['HANDOFF.md']), /# Handoff:/);
    const sealed = await sendBundle(r.bundle, r.files, { relay: url, sealed: true });
    assert.ok(sealed.link.includes('#'));
    const rec = (await (await fetch(`${url}/api/handoffs/${sealed.code}`)).json()) as Record<string, unknown>;
    assert.equal(rec.bundle, undefined, 'server never sees the plaintext bundle');
    const opened = await pickup(sealed.link);
    assert.equal(JSON.parse(String(opened.files['bundle.json'])).integrity.root, r.bundle.integrity.root);
    await assert.rejects(pickup(sealed.code, { relay: url }), /end-to-end encrypted/);
  });
  it('enforces the bearer token for REST writes when configured', async () => {
    const s = await startRelay({ port: 0, host: '127.0.0.1', store: new RelayStore({ dir: join(tmp, 'tok') }), token: 'hunter2', log: () => {} });
    const res = await fetch(`${s.url}/api/handoffs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"bundle":{}}' });
    assert.equal(res.status, 401);
    await s.close();
  });
});

describe('portable fetch handler (Workers/Deno path) over an in-memory KV', () => {
  it('serves MCP and REST without Node APIs', async () => {
    const kv = new MemoryKV();
    const handle = createRelayHandler({ store: new AsyncRelayStore(kv, { ttlDays: 1 }), publicUrl: 'https://relay.example' });
    const post = (path: string, body: unknown, sid?: string) => handle(new Request(`https://relay.example${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(sid ? { 'mcp-session-id': sid } : {}) }, body: JSON.stringify(body) }));
    const init = await post('/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name: 'claude-ai' } } });
    const sid = init.headers.get('mcp-session-id')!;
    const cp = await (await post('/mcp', { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'baton_checkpoint', arguments: { state: 'kv works', files: [{ path: 'a.txt', content: 'A' }] } } }, sid)).json() as { result: { content: { text: string }[] } };
    assert.match(cp.result.content[0].text, /Viewer: https:\/\/relay\.example\/h\/BTN-/);
    const code = cp.result.content[0].text.match(/BTN-[0-9A-Z-]{14}/)![0];
    assert.ok([...kv.map.keys()].includes(`h:${code}`));
    const view = await handle(new Request(`https://relay.example/h/${code}`));
    assert.equal(view.status, 200);
    assert.match(await view.text(), /kv works/);
    assert.equal((await handle(new Request('https://relay.example/healthz'))).status, 200);
    const secretHandle = createRelayHandler({ store: new AsyncRelayStore(new MemoryKV()), mcpSecret: 's3cr3t-path' });
    assert.ok(!(await (await secretHandle(new Request('https://r.example/'))).text()).includes('s3cr3t-path'), 'home page hides the secret');
    assert.equal((await secretHandle(new Request('https://r.example/mcp', { method: 'POST', body: '{}' }))).status, 404);
    assert.equal((await handle(new Request('https://relay.example/h/BTN-0000-0000-0000'))).status, 404);
  });
});

describe('Baton Link share-URL parsing', () => {
  it('accepts every way a share link can be prefixed', async () => {
    const { shareIdFrom } = await import('../src/relay/handler.ts');
    const id = '6acbc222-2500-83ee-b38c-dcfe2b46e388';
    for (const p of [`/https://chatgpt.com/share/${id}`, `/https:/chatgpt.com/share/${id}`, `/chatgpt.com/share/${id}`, `/share/${id}`, `/https://chat.openai.com/share/${id}`, `/https%3A%2F%2Fchatgpt.com%2Fshare%2F${id}`]) {
      assert.deepEqual(shareIdFrom(p), { id, mode: '' }, p);
    }
    assert.deepEqual(shareIdFrom(`/share/${id}.md`), { id, mode: '.md' });
    assert.deepEqual(shareIdFrom(`/share/${id}/full`), { id, mode: '/full' });
    assert.equal(shareIdFrom('/https://evil.example/share/x'), undefined);
  });
  it('builds an AI brief with instructions and inline files', async () => {
    const { aiBrief } = await import('../src/relay/linkpage.ts');
    const [r] = convert(JSON.stringify([{ role: 'user', content: 'make a.txt' }, { role: 'assistant', content: 'done' }]), 'x.json', { now: '2026-01-01T00:00:00Z' });
    const md = aiBrief(r.bundle, r.files);
    assert.match(md, /^# Baton handoff: /);
    assert.match(md, /To the AI reading this/);
  });
});

describe('Bookmarklet capture (form POST and JSON ingest)', () => {
  const base = 'https://relay.example';
  const make = () => createRelayHandler({ store: new AsyncRelayStore(new MemoryKV(), { ttlDays: 1 }), publicUrl: base });
  const capture = { url: 'https://gemini.google.com/app/abc', title: 'Stumping sim - Google Gemini', messages: [{ role: 'user', content: 'Build a stumping simulator' }, { role: 'assistant', content: 'Here is the plan:\n\n1. Physics' }] };

  it('the bookmarklet is valid JavaScript and only talks to this relay', async () => {
    const { bookmarkletSource } = await import('../src/relay/ingest.ts');
    const src = bookmarkletSource(base);
    assert.ok(src.startsWith('javascript:'));
    const code = decodeURIComponent(src.slice('javascript:'.length));
    assert.doesNotThrow(() => new Function(code));
    const hosts = new Set([...code.matchAll(/https?:\/\/[a-z0-9.-]+/gi)].map((m) => m[0]).filter((h) => h !== 'http://www.w3.org')); // SVG namespace, not a request
    assert.deepEqual([...hosts], [base]);
    assert.match(code, /Nothing is sent until you choose/);
    assert.match(code, /cloneNode\(true\)/, 'reads clones, never edits the live page');
  });

  it('form POST stores the chat and redirects to the Baton Link', async () => {
    const handle = make();
    const r = await handle(new Request(`${base}/api/ingest-form`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ d: JSON.stringify(capture) }).toString() }));
    assert.equal(r.status, 303);
    const loc = r.headers.get('location')!;
    assert.match(loc, /^https:\/\/relay\.example\/h\/BTN-[0-9A-Z-]+\?new=1$/);
    const html = await (await handle(new Request(loc))).text();
    assert.match(html, /Stumping sim/);
    assert.doesNotMatch(html, /<h1[^>]*>[^<]*Google Gemini/);
    assert.match(html, /data-dest="claude" href="https:\/\/claude\.ai\/new\?q=/);
    assert.match(html, /Your handoff link is ready/);
    const page = loc.replace('?new=1', '');
    const md = await (await handle(new Request(`${page}.md`))).text();
    assert.match(md, /Build a stumping simulator/);
    assert.match(md, /Gemini \(captured in your browser\)/);
  });

  it('JSON ingest accepts a raw capture; errors are readable', async () => {
    const handle = make();
    const ok = await handle(new Request(`${base}/api/ingest`, { method: 'POST', body: JSON.stringify(capture) }));
    assert.equal(ok.status, 201);
    assert.match(((await ok.json()) as { url: string }).url, /\/h\/BTN-/);
    const bad = await handle(new Request(`${base}/api/ingest-form`, { method: 'POST', body: new URLSearchParams({ d: JSON.stringify({ url: 'https://claude.ai/chat/x', error: 'Claude answered 403' }) }).toString() }));
    assert.equal(bad.status, 400);
    assert.match(await bad.text(), /Claude answered 403/);
    const tokenHandle = createRelayHandler({ store: new AsyncRelayStore(new MemoryKV()), token: 't' });
    assert.equal((await tokenHandle(new Request(`${base}/api/ingest-form`, { method: 'POST', body: 'd=%7B%7D' }))).status, 401);
  });
});

describe('Baton site: one-click destinations, paste, delete, pages', () => {
  const base = 'https://relay.example';
  const make = () => createRelayHandler({ store: new AsyncRelayStore(new MemoryKV(), { ttlDays: 7 }), publicUrl: base });
  const capture = { url: 'https://gemini.google.com/app/abc', title: 'Trip plan - Google Gemini', messages: [{ role: 'user', content: 'Plan 3 days in Lisbon' }, { role: 'assistant', content: 'Day 1: Alfama' }] };
  const form = (d: unknown) => new Request(`${base}/api/ingest-form`, { method: 'POST', body: new URLSearchParams({ d: JSON.stringify(d) }).toString() });

  it('choosing Claude or ChatGPT redirects straight into that AI with the prompt filled in', async () => {
    const handle = make();
    const claude = await handle(form({ ...capture, to: 'claude' }));
    assert.equal(claude.status, 303);
    const loc = claude.headers.get('location')!;
    assert.match(loc, /^https:\/\/claude\.ai\/new\?q=/);
    assert.match(decodeURIComponent(loc), /https:\/\/relay\.example\/h\/BTN-[0-9A-Z-]{14}/);
    assert.match((await handle(form({ ...capture, to: 'chatgpt' }))).headers.get('location')!, /^https:\/\/chatgpt\.com\/\?q=/);
    assert.match((await handle(form({ ...capture, to: 'gemini' }))).headers.get('location')!, /\/h\/BTN-[0-9A-Z-]+\?to=gemini$/);
  });

  it('only the creating browser can delete a handoff', async () => {
    const handle = make();
    const r = await handle(form(capture));
    const cookie = r.headers.get('set-cookie')!;
    assert.match(cookie, /^bo_[0-9A-Z]{15}=[0-9a-f]{32}; Max-Age=\d+; Path=\/; Secure; HttpOnly; SameSite=Lax$/);
    const page = r.headers.get('location')!.replace('?new=1', '');
    const code = page.split('/h/')[1];
    const pair = cookie.split(';')[0];
    assert.match(await (await handle(new Request(page, { headers: { cookie: pair } }))).text(), /Delete it now/);
    assert.doesNotMatch(await (await handle(new Request(page))).text(), /Delete it now/);
    assert.equal((await handle(new Request(`${base}/h/${code}/delete`, { method: 'POST', headers: { cookie: `${pair.split('=')[0]}=${'0'.repeat(32)}` } }))).status, 403);
    const del = await handle(new Request(`${base}/h/${code}/delete`, { method: 'POST', headers: { cookie: pair } }));
    assert.equal(del.status, 303);
    assert.equal((await handle(new Request(page))).status, 404);
    const api = await (await handle(form(capture))).headers.get('location')!;
    const rec = (await (await handle(new Request(`${base}/api/handoffs/${api.split('/h/')[1].replace('?new=1', '')}`))).json()) as Record<string, unknown>;
    assert.ok(!('owner' in rec), 'the owner hash is never exposed');
  });

  it('paste API turns copied chat text into a handoff', async () => {
    const handle = make();
    const text = readFileSync(new URL('../fixtures/pasted/gemini-select-all.txt', import.meta.url), 'utf8');
    const r = await handle(new Request(`${base}/api/paste`, { method: 'POST', body: JSON.stringify({ text, to: 'link' }) }));
    assert.equal(r.status, 201);
    const j = (await r.json()) as { url: string; next: string };
    assert.equal(j.next, `${j.url}?new=1`);
    const md = await (await handle(new Request(`${j.url}.md`))).text();
    assert.match(md, /Gemini \(pasted\)/);
    assert.match(md, /three bullet points on how to practise wicketkeeping/);
    const bad = await handle(new Request(`${base}/api/paste`, { method: 'POST', body: JSON.stringify({ text: '   ' }) }));
    assert.equal(bad.status, 400);
  });

  it('serves the home page, privacy, demo, icons and branded 404s', async () => {
    const [r] = convert(JSON.stringify([{ role: 'user', content: 'demo prompt' }, { role: 'assistant', content: 'demo reply' }]), 'x.json', { now: '2026-01-01T00:00:00Z' });
    const handle = createRelayHandler({ store: new AsyncRelayStore(new MemoryKV()), publicUrl: base, demo: r.bundle });
    const home = await handle(new Request(`${base}/`));
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-security-policy')!, /default-src 'none'/);
    const html = await home.text();
    assert.match(html, /Move any AI chat to/);
    assert.match(html, /class="bm only-fine" href="javascript:/);
    assert.match(html, /id="pf"/);
    assert.match(await (await handle(new Request(`${base}/privacy`))).text(), /What happens to your chat/);
    assert.match(await (await handle(new Request(`${base}/demo`))).text(), /demo prompt/);
    assert.match(await (await handle(new Request(`${base}/demo.md`))).text(), /# Baton handoff/);
    assert.equal((await handle(new Request(`${base}/favicon.svg`))).headers.get('content-type'), 'image/svg+xml');
    const png = new Uint8Array(await (await handle(new Request(`${base}/og.png`))).arrayBuffer());
    assert.deepEqual([...png.slice(1, 4)], [0x50, 0x4e, 0x47]);
    const nf = await handle(new Request(`${base}/h/BTN-0000-0000-0000`));
    assert.equal(nf.status, 404);
    assert.match(await nf.text(), /This link has expired/);
  });
});
