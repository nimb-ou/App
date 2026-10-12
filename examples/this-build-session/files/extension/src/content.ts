// Content script: the in-page Baton panel. Capture → (copy | save | continue in another AI | send to relay).

import { buildBundle } from '../../src/core/build.ts';
import type { BatonBundle } from '../../src/core/schema.ts';
import { base64ToBytes, bytesToBase64, slugify } from '../../src/core/util.ts';
import { zip, type FileMap } from '../../src/core/zip.ts';
import { renderBundleFiles } from '../../src/render/files.ts';
import { sealedPlaintext } from '../../src/relay/client.ts';
import { seal } from '../../src/relay/seal.ts';
import { ADAPTERS, adapterFor, type Adapter, type Net } from './adapters.ts';
import { attachFiles, fillComposer } from './inject.ts';

declare const chrome: any;

interface Settings {
  relay?: string;
  token?: string;
  seal: boolean;
  redact: boolean;
}

interface Pending {
  id: string;
  createdAt: number;
  title: string;
  prompt: string;
  files: { name: string; type: string; base64: string }[];
}

const doc = document;
const testSite = doc.documentElement.dataset.batonTestSite; // only honoured by the test build's host matches
const adapter: Adapter = adapterFor(new URL(location.href), testSite);
const streams: { url: string; at: string; body: string }[] = [];
let streamBytes = 0;
let last: { bundle: BatonBundle; files: FileMap } | undefined;

// ───────── live stream tap (from tap.ts in the main world) ─────────
window.addEventListener('message', (e) => {
  if (e.source !== window || e.data?.source !== 'baton-tap') return;
  if (streamBytes > 5 * 1024 * 1024) return;
  streams.push({ url: e.data.url, at: e.data.at, body: e.data.body });
  streamBytes += e.data.body.length;
  updateTapCount();
});

// ───────── network for adapters ─────────
const net: Net = {
  async json(url, init) {
    const res = await fetch(url, { credentials: 'include', headers: init?.headers });
    if (!res.ok) throw new Error(`${new URL(url, location.href).pathname}: HTTP ${res.status}`);
    return res.json();
  },
  async binary(url) {
    const r = await chrome.runtime.sendMessage({ type: 'baton:binary', url });
    if (!r?.ok) throw new Error(r?.error ?? 'download failed');
    return r;
  },
};

async function settings(): Promise<Settings> {
  const s = (await chrome.storage.sync.get(['relay', 'token', 'seal', 'redact'])) as Partial<Settings>;
  return { relay: s.relay || undefined, token: s.token || undefined, seal: s.seal !== false, redact: s.redact !== false };
}

// ───────── capture ─────────
async function capture(): Promise<void> {
  setStatus(`Capturing from ${adapter.label}…`);
  busy(true);
  try {
    const s = await settings();
    const res = await adapter.capture({ url: new URL(location.href), net, doc });
    if (streams.length) {
      res.parsed.capturedFiles = [
        ...(res.parsed.capturedFiles ?? []),
        ...streams.map((st, i) => ({ path: `live-streams/${String(i + 1).padStart(3, '0')}.txt`, content: `# ${st.url}\n# ${st.at}\n${st.body}`, note: 'raw response stream observed in the page while it was generated' })),
      ];
    }
    const { bundle, extraFiles } = buildBundle(res.parsed, { redact: s.redact });
    const files = renderBundleFiles(bundle, { extraFiles });
    last = { bundle, files };
    renderResult(bundle, res.captured, res.failed.length);
    setStatus(`Captured "${bundle.title}".`, 'ok');
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), 'err');
  } finally {
    busy(false);
  }
}

// ───────── actions ─────────
async function copyPrompt(): Promise<void> {
  if (!last) return;
  try {
    await navigator.clipboard.writeText(String(last.files['PROMPT.md']));
    setStatus('Paste-ready prompt copied.', 'ok');
  } catch {
    setStatus('Clipboard blocked: use Save instead.', 'err');
  }
}

function zipBytes(): Uint8Array {
  const prefixed: FileMap = {};
  for (const [k, v] of Object.entries(last!.files)) prefixed[`${slugify(last!.bundle.title)}/${k}`] = v;
  return zip(prefixed);
}

function saveZip(): void {
  if (!last) return;
  const a = doc.createElement('a');
  a.href = URL.createObjectURL(new Blob([zipBytes() as BlobPart], { type: 'application/zip' }));
  a.download = `${slugify(last.bundle.title)}.baton.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/** Tab-to-tab: stash the handoff locally, open the target AI, and let its content script insert it. */
async function continueIn(target: Adapter): Promise<void> {
  if (!last) return;
  const id = Math.random().toString(36).slice(2, 10);
  const textFiles = last.bundle.artifacts.filter((a) => a.content !== undefined && a.encoding !== 'base64' && (a.bytes ?? 0) < 200000).slice(0, 8);
  const files: Pending['files'] = [{ name: 'HANDOFF.md', type: 'text/markdown', base64: bytesToBase64(new TextEncoder().encode(String(last.files['HANDOFF.md']))) }];
  if (target.id === 'chatgpt') files.push({ name: `${slugify(last.bundle.title)}.baton.zip`, type: 'application/zip', base64: bytesToBase64(zipBytes()) });
  else for (const a of textFiles) files.push({ name: a.path.split('/').pop() || a.path, type: 'text/plain', base64: bytesToBase64(new TextEncoder().encode(a.content!)) });
  const pending: Pending = { id, createdAt: Date.now(), title: last.bundle.title, prompt: String(last.files['PROMPT.md']), files };
  await chrome.storage.local.set({ [`baton:pending:${id}`]: pending });
  const targets = ((await chrome.storage.local.get('baton:targets'))['baton:targets'] ?? {}) as Record<string, string>;
  const base = targets[target.id] ?? target.newChatUrl!;
  await chrome.runtime.sendMessage({ type: 'baton:open', url: `${base}#baton=${id}` });
  setStatus(`Opened ${target.label}. The handoff is being inserted there. Review it, then press send.`, 'ok');
}

async function sendToRelay(): Promise<void> {
  if (!last) return;
  const s = await settings();
  if (!s.relay) return setStatus('Set a relay URL in the Baton options first.', 'err');
  busy(true);
  try {
    let body: Record<string, unknown> = { bundle: last.bundle, from: `extension:${adapter.id}` };
    let key: string | undefined;
    if (s.seal) {
      const sealed = await seal(sealedPlaintext(last.bundle, last.files));
      body = { sealed: sealed.sealed, title: last.bundle.title, from: `extension:${adapter.id}` };
      key = sealed.key;
    }
    const r = await chrome.runtime.sendMessage({ type: 'baton:relay', relay: s.relay, token: s.token, body });
    if (!r?.ok) throw new Error(r?.error ?? 'relay error');
    const link = `${String(r.url).startsWith('http') ? r.url : s.relay.replace(/\/$/, '') + r.url}${key ? `#${key}` : ''}`;
    showLink(link, r.code);
    setStatus(key ? 'Sent end-to-end encrypted: only someone with the full link can open it.' : `Sent. Pickup code ${r.code}.`, 'ok');
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), 'err');
  } finally {
    busy(false);
  }
}

// ───────── receiving side ─────────
async function receivePending(): Promise<void> {
  const m = location.hash.match(/baton=([a-z0-9]+)/);
  if (!m) return;
  const key = `baton:pending:${m[1]}`;
  const p = ((await chrome.storage.local.get(key))[key] ?? undefined) as Pending | undefined;
  history.replaceState(null, '', location.pathname + location.search);
  if (!p) return;
  openPanel();
  setStatus(`Inserting handoff "${p.title}"…`);
  const files = p.files.map((f) => new File([base64ToBytes(f.base64) as BlobPart], f.name, { type: f.type }));
  const how = await attachFiles(doc, adapter.composer, files);
  const filled = await fillComposer(doc, adapter.composer, p.prompt);
  await chrome.storage.local.remove(key);
  setStatus(filled ? `Handoff inserted${how !== 'none' ? ` with ${files.length} file(s)` : ''}. Review it, then press send.` : 'Could not find the message box. Use "Copy prompt" from the source tab instead.', filled ? 'ok' : 'err');
  doc.documentElement.dataset.batonReceived = filled ? `ok:${how}` : 'fail';
}

// ───────── panel UI (shadow DOM, so page CSS cannot interfere) ─────────
const host = doc.createElement('baton-panel');
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `<style>
:host{all:initial}
.fab{position:fixed;right:18px;bottom:88px;z-index:2147483646;font:700 13px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;background:#14201b;color:#fff;border:0;border-radius:6px;padding:10px 12px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.p{position:fixed;right:18px;bottom:134px;z-index:2147483647;width:340px;max-width:calc(100vw - 36px);max-height:70vh;overflow:auto;background:#fff;color:#14201b;border:1px solid #14201b;border-radius:8px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)}
@media (prefers-color-scheme:dark){.p{background:#161e1b;color:#e4ebe7;border-color:#9aaba3}.fab{background:#e4ebe7;color:#0f1513}.st{color:#9aaba3}button.b{background:#161e1b;color:#e4ebe7;border-color:#9aaba3}}
.h{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #d7dfdb;font-weight:800;letter-spacing:.08em;text-transform:uppercase;font-size:12px}
.c{padding:10px 12px;display:grid;gap:8px}
button.b{font:600 13px system-ui,sans-serif;padding:7px 10px;border-radius:5px;border:1px solid #14201b;background:#fff;color:#14201b;cursor:pointer}
button.pri{background:#2343c9;border-color:#2343c9;color:#fff}
button:disabled{opacity:.5;cursor:default}
.row{display:flex;flex-wrap:wrap;gap:6px}
.st{font-size:13px;color:#5b6b64;min-height:1.2em}.st.ok{color:#1f7a4d}.st.err{color:#b4271c}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:13px;font-variant-numeric:tabular-nums}
.stats b{font-size:16px}
.cmp{font-size:12px;color:#1f7a4d}
.link{font:12px ui-monospace,monospace;word-break:break-all;background:rgba(127,127,127,.12);padding:6px;border-radius:4px}
.x{background:none;border:0;font-size:18px;cursor:pointer;color:inherit}
</style>
<button class="fab" id="fab" title="Baton: carry this work to another AI">Baton</button>
<div class="p" id="panel" hidden>
  <div class="h"><span>Baton · ${adapter.label}</span><button class="x" id="close" aria-label="Close">×</button></div>
  <div class="c">
    <button class="b pri" id="cap">Capture this conversation</button>
    <div class="stats" id="stats" hidden></div>
    <div class="cmp" id="cmp" hidden></div>
    <div id="acts" hidden>
      <div class="row"><button class="b" id="copy">Copy prompt</button><button class="b" id="save">Save .zip</button><button class="b" id="send">Send to relay</button></div>
      <div style="margin-top:8px;font-size:12px;font-weight:700">Continue in</div>
      <div class="row" id="targets"></div>
    </div>
    <div class="link" id="link" hidden></div>
    <div class="st" id="st" role="status">${streams.length ? '' : 'Ready.'}</div>
    <div class="st" id="tap"></div>
  </div>
</div>`;
const $ = (id: string) => root.getElementById(id) as HTMLElement;

function openPanel() {
  $('panel').hidden = false;
}
function setStatus(msg: string, kind: '' | 'ok' | 'err' = '') {
  const el = $('st');
  el.textContent = msg;
  el.className = `st ${kind}`;
}
function busy(b: boolean) {
  root.querySelectorAll('button.b').forEach((x) => ((x as HTMLButtonElement).disabled = b));
}
function updateTapCount() {
  $('tap').textContent = streams.length ? `${streams.length} live response stream(s) observed in this tab` : '';
}
function showLink(link: string, code: string) {
  const el = $('link');
  el.hidden = false;
  el.textContent = `${code}\n${link}`;
  navigator.clipboard?.writeText(link).catch(() => {});
}
function renderResult(b: BatonBundle, captured: number, failed: number) {
  const s = b.stats;
  const outputs = b.events.filter((e) => e.kind === 'tool_result' && !e.redactedBySource).length;
  $('stats').hidden = false;
  $('stats').innerHTML = [
    ['prompts', s.userMessages],
    ['tool outputs', outputs],
    ['files', s.artifacts.recovered + s.artifacts.attached],
    ['files lost', s.artifacts.lost + failed],
  ]
    .map(([k, v]) => `<div><b>${v}</b> ${k}</div>`)
    .join('');
  if (adapter.id === 'chatgpt') {
    $('cmp').hidden = false;
    $('cmp').textContent = `A share link of this chat would keep 0 tool outputs and 0 files. Captured here: ${outputs} outputs, ${captured} files.`;
  }
  $('acts').hidden = false;
  $('targets').innerHTML = '';
  for (const t of ADAPTERS.filter((a) => a.id !== adapter.id)) {
    const btn = doc.createElement('button');
    btn.className = 'b';
    btn.textContent = t.label;
    btn.onclick = () => continueIn(t);
    $('targets').appendChild(btn);
  }
}

$('fab').onclick = () => ($('panel').hidden = !$('panel').hidden);
$('close').onclick = () => ($('panel').hidden = true);
$('cap').onclick = capture;
$('copy').onclick = copyPrompt;
$('save').onclick = saveZip;
$('send').onclick = sendToRelay;
chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === 'baton:toggle') $('panel').hidden = !$('panel').hidden;
});

(doc.body ?? doc.documentElement).appendChild(host);
receivePending();
