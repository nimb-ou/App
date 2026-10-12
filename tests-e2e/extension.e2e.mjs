// End-to-end: load the real extension (test build) into Chromium, against a local mock of ChatGPT + Claude.
// Proves: in-page capture gets tool outputs and sandbox files a share link drops; stream tap; tab-to-tab
// injection into another AI's composer (text + files); zip download.
// Run: npm run build:extension:test && node tests-e2e/extension.e2e.mjs
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const root = new URL('..', import.meta.url).pathname;
const extPath = join(root, 'extension/dist-test');

const CONV = 'c0ffee00-1111-2222-3333-444455556666';
const CONV2 = 'deadbeef-1111-2222-3333-444455556666';
const PDF = Buffer.from('%PDF-1.4\n% Baton test pdf\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const now = 1791727918;
const msg = (id, parent, role, content, extra = {}) => ({ id, parent, children: [], message: { id, author: { role, ...(extra.name ? { name: extra.name } : {}) }, create_time: now + Number(id.slice(1)), content, recipient: extra.recipient ?? 'all', metadata: extra.metadata ?? {} } });
const nodes = [
  { id: 'root', parent: null, children: [], message: null },
  msg('m1', 'root', 'user', { content_type: 'text', parts: ['Simulate the stumping model and give me a PDF report'] }),
  msg('m2', 'm1', 'assistant', { content_type: 'code', language: 'unknown', text: "bash -lc cat > /mnt/data/app.py <<'PY'\nprint('lab')\nPY\npython /mnt/data/app.py" }, { recipient: 'container.exec' }),
  msg('m3', 'm2', 'tool', { content_type: 'execution_output', text: 'h*=4.29 cm  T=319 ms  P=70.24%' }, { name: 'container.exec' }),
  msg('m4', 'm3', 'assistant', { content_type: 'text', parts: ['Done. [Report](sandbox:/mnt/data/report.pdf) and [app](sandbox:/mnt/data/app.py).'] }),
];
const mapping = {};
nodes.forEach((n, i) => {
  mapping[n.id] = n;
  if (i > 0) mapping[nodes[i - 1].id].children = [n.id];
});
const conversation = { title: 'Stumping lab (live)', create_time: now, update_time: now + 60, mapping, current_node: 'm4', conversation_id: CONV };

const page = (site, body) => `<!doctype html><html data-baton-test-site="${site}"><head><meta charset="utf-8"><title>${site} mock</title></head><body>${body}</body></html>`;
let port = 0;
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (code, type, body) => (res.writeHead(code, { 'content-type': type }), res.end(body));
  if (u.pathname === `/c/${CONV}`) return send(200, 'text/html', page('chatgpt', `<div id="prompt-textarea" contenteditable="true"></div><script>fetch('/__baton_test_stream').then(r=>r.text())</script>`));
  if (u.pathname === '/__baton_test_stream') return send(200, 'text/event-stream', 'data: {"partial":"streamed tool output 4.29 cm"}\n\n');
  if (u.pathname === '/api/auth/session') return send(200, 'application/json', JSON.stringify({ accessToken: 'tok' }));
  if (u.pathname === `/backend-api/conversation/${CONV}`) {
    if (req.headers.authorization !== 'Bearer tok') return send(401, 'application/json', '{}');
    return send(200, 'application/json', JSON.stringify(conversation));
  }
  if (u.pathname === `/backend-api/conversation/${CONV}/interpreter/download`) {
    const p = u.searchParams.get('sandbox_path');
    return send(200, 'application/json', JSON.stringify({ download_url: `http://127.0.0.1:${port}/files/${p.split('/').pop()}` }));
  }
  if (u.pathname === '/files/report.pdf') return send(200, 'application/pdf', PDF);
  if (u.pathname === '/files/app.py') return send(200, 'text/x-python', "print('lab')\n");
  if (u.pathname === `/c/${CONV2}`)
    return send(200, 'text/html', page('chatgpt', `<main><div data-message-author-role="user"><div>Plan a launch</div></div><div data-message-author-role="assistant"><div><p>Step 1: pick a date.</p><pre><code>launch --date 2026-11-01</code></pre></div></div></main><div id="prompt-textarea" contenteditable="true"></div>`));
  if (u.pathname === `/backend-api/conversation/${CONV2}`) return send(500, 'application/json', '{"detail":"internal"}');
  if (u.pathname === '/gemini-app')
    return send(200, 'text/html', page('gemini', `<user-query><div class="query-text">earlier question</div></user-query><model-response><message-content>earlier answer</message-content></model-response><rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea>`));
  if (u.pathname === '/claude-new')
    return send(200, 'text/html', page('claude', `<input type="file" data-testid="file-upload" multiple><div class="ProseMirror" contenteditable="true"></div><ul id="got"></ul>
<script>history.replaceState(null,'','/claude-new/chat-rewritten');document.querySelector('input').addEventListener('change',e=>{for(const f of e.target.files){const li=document.createElement('li');li.textContent=f.name+':'+f.size;document.getElementById('got').appendChild(li)}})</script>`));
  send(404, 'text/plain', 'nope');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
port = server.address().port;

const userDir = mkdtempSync(join(tmpdir(), 'baton-ext-'));
const ctx = await chromium.launchPersistentContext(userDir, {
  headless: true,
  channel: 'chromium', // new headless mode: required for extensions
  args: [`--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
  acceptDownloads: true,
});
let failed = false;
try {
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker', { timeout: 10000 });
  await sw.evaluate((url) => chrome.storage.local.set({ 'baton:targets': { claude: url } }), `http://127.0.0.1:${port}/claude-new`);

  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/c/${CONV}`);
  await p.locator('baton-panel #fab').click();
  await p.waitForTimeout(300); // let the stream tap report
  await p.locator('baton-panel #cap').click();
  await p.locator('baton-panel #stats').waitFor({ state: 'visible', timeout: 10000 });
  const stats = await p.locator('baton-panel #stats').innerText();
  const cmp = await p.locator('baton-panel #cmp').innerText();
  console.log('captured stats:', stats.replace(/\n/g, ' · '));
  console.log('vs share link :', cmp);
  assert.match(stats, /1\s+tool outputs/);
  assert.match(cmp, /Captured here: 1 outputs, 2 files/);
  assert.match(await p.locator('baton-panel #tap').innerText(), /1 live response stream/);

  // Save .zip and check the captured PDF bytes are inside, exact.
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('baton-panel #save').click()]);
  const zipPath = await dl.path();
  const { unzipStored } = await import(join(root, 'src/core/zip.ts'));
  const files = unzipStored(new Uint8Array(readFileSync(zipPath)));
  const pdfName = Object.keys(files).find((k) => k.endsWith('files/report.pdf'));
  assert.ok(pdfName, 'zip contains files/report.pdf');
  assert.deepEqual(Buffer.from(files[pdfName]), PDF);
  const bundle = JSON.parse(new TextDecoder().decode(files[Object.keys(files).find((k) => k.endsWith('bundle.json'))]));
  assert.equal(bundle.events.find((e) => e.kind === 'tool_result').text, 'h*=4.29 cm  T=319 ms  P=70.24%');
  assert.ok(Object.keys(files).some((k) => k.includes('files/live-streams/001.txt')));
  console.log('zip           :', Object.keys(files).length, 'entries; report.pdf exact; tool output present; live stream kept');

  // Continue in Claude: new tab, composer filled, files attached.
  const [claudeTab] = await Promise.all([ctx.waitForEvent('page'), p.locator('baton-panel #targets button', { hasText: 'Claude' }).click()]);
  await claudeTab.waitForFunction(() => document.documentElement.dataset.batonReceived, null, { timeout: 15000 });
  const received = await claudeTab.evaluate(() => document.documentElement.dataset.batonReceived);
  const composer = await claudeTab.locator('.ProseMirror').innerText();
  const got = await claudeTab.locator('#got').innerText();
  console.log('claude tab    :', received, '| composer starts:', JSON.stringify(composer.slice(0, 60)), '| files:', got.replace(/\n/g, ', '));
  assert.equal(received, 'ok:input');
  assert.match(composer, /I'm continuing a piece of work I started in ChatGPT/);
  assert.match(got, /HANDOFF\.md:\d+/);
  assert.match(got, /app\.py:13/);
  assert.equal(await sw.evaluate(async () => Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith('baton:pending:')).length), 0, 'pending handoff consumed');
  // DOM fallback: ChatGPT's data API fails, the rendered page is captured instead.
  const p2 = await ctx.newPage();
  await p2.goto(`http://127.0.0.1:${port}/c/${CONV2}`);
  await p2.locator('baton-panel #fab').click();
  await p2.locator('baton-panel #cap').click();
  await p2.locator('baton-panel #stats').waitFor({ state: 'visible', timeout: 10000 });
  assert.match(await p2.locator('baton-panel #stats').innerText(), /1\s+prompts/);
  const [dl2] = await Promise.all([p2.waitForEvent('download'), p2.locator('baton-panel #save').click()]);
  const files2 = unzipStored(new Uint8Array(readFileSync(await dl2.path())));
  const b2 = JSON.parse(new TextDecoder().decode(files2[Object.keys(files2).find((k) => k.endsWith('bundle.json'))]));
  assert.ok(b2.loss.some((l) => l.category === 'dom-capture' && /HTTP 500/.test(l.detail)), 'records why it fell back');
  assert.match(b2.events[1].text, /launch --date 2026-11-01/);
  console.log('dom fallback  : API 500 → captured', b2.events.length, 'turns from the page, reason recorded');

  // Debug report contains no conversation text.
  await p2.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${port}` });
  await p2.locator('baton-panel #dbg').click();
  const report = await p2.evaluate(() => navigator.clipboard.readText());
  assert.match(report, /adapter chatgpt/);
  assert.match(report, /backend-api\/conversation\/:id → 500/);
  assert.ok(!report.includes('Plan a launch') && !report.includes('deadbeef'), 'no conversation text or ids');
  console.log('debug report  :', report.split('\n')[0]);

  // Pickup by code from a relay into Gemini (no file input there → files inlined into the message).
  const { startRelay } = await import(join(root, 'src/relay/server.ts'));
  const { RelayStore } = await import(join(root, 'src/relay/store.ts'));
  const relay = await startRelay({ port: 0, host: '127.0.0.1', store: new RelayStore({ dir: join(userDir, 'relay') }), log: () => {} });
  const cp = await fetch(`${relay.url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'baton_checkpoint', arguments: { title: 'From Claude', state: 'Pricing drafted', files: [{ path: 'pricing.md', content: '# Pricing\nPro $12' }] } } }) }).then((r) => r.json());
  const code = cp.result.content[0].text.match(/BTN-[0-9A-Z-]{14}/)[0];
  const g = await ctx.newPage();
  await g.goto(`http://127.0.0.1:${port}/gemini-app`);
  await g.locator('baton-panel #fab').click();
  await g.locator('baton-panel #code').fill(`${relay.url}/h/${code}`);
  await g.locator('baton-panel #pick').click();
  await g.waitForFunction(() => document.documentElement.dataset.batonReceived, null, { timeout: 15000 });
  const gtext = await g.locator('.ql-editor').innerText();
  assert.equal(await g.evaluate(() => document.documentElement.dataset.batonReceived), 'ok:paste');
  assert.match(gtext, /Pricing drafted/);
  assert.match(gtext, /--- pricing\.md ---\n# Pricing/);
  console.log('gemini pickup :', 'code', code.slice(0, 8) + '…', '→ composer filled; attach via paste');
  await relay.close();

  console.log('\nEXTENSION E2E: PASS');
} catch (err) {
  failed = true;
  console.error('\nEXTENSION E2E: FAIL\n', err);
} finally {
  await ctx.close();
  server.close();
  rmSync(userDir, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
