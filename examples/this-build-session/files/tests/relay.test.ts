import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
    const rec = store.get(code)!;
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
