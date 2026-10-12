// Content script: the in-page Baton panel. Capture → (copy | save | continue in another AI | send to relay).

import { buildBundle } from '../../src/core/build.ts';
import type { BatonBundle } from '../../src/core/schema.ts';
import { base64ToBytes, bytesToBase64, slugify } from '../../src/core/util.ts';
import { zip, type FileMap } from '../../src/core/zip.ts';
import { renderBundleFiles } from '../../src/render/files.ts';
import { renderRecord, type RelayRecord } from '../../src/relay/checkpoint.ts';
import { parsePickup, seal, sealedPlaintext, unseal } from '../../src/relay/seal.ts';
import { ADAPTERS, adapterFor, domTurns, type Adapter, type Net } from './adapters.ts';
import { attachFiles, fillComposer } from './inject.ts';

declare const chrome: any;
/** The public Baton server, set at build time (scripts/build-extension.mjs, BATON_RELAY_URL). Options can override it. */
declare const __BATON_RELAY__: string;
const DEFAULT_RELAY = typeof __BATON_RELAY__ === 'string' ? __BATON_RELAY__ : '';

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
  inline?: string; // file contents to paste when the target page refuses attachments
}

/** File contents as one paste-able block, budgeted so the message stays sendable. */
function inlineFiles(files: { name: string; text: string }[], budget = 24000): string {
  const out: string[] = [];
  for (const f of files) {
    const block = `--- ${f.name} ---\n${f.text}`;
    if (block.length > budget) break;
    budget -= block.length;
    out.push(block);
  }
  return out.length ? `\n\nFILES (inline, because attaching was not possible here):\n${out.join('\n\n')}` : '';
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

// ───────── debug log (for "Copy debug report"; never includes conversation text) ─────────
const VERSION = '0.4.0';
const debugLog: string[] = [];
function log(m: string): void {
  debugLog.push(`${new Date().toISOString().slice(11, 19)} ${m}`);
  if (debugLog.length > 80) debugLog.shift();
}
const scrub = (p: string) => p.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\/[0-9a-f]{12,}/gi, '/:id').replace(/BTN-[0-9A-Z-]+/g, 'BTN-…');

// ───────── network for adapters ─────────
const net: Net = {
  async json(url, init) {
    const res = await fetch(url, { credentials: 'include', headers: init?.headers });
    log(`GET ${scrub(new URL(url, location.href).pathname)} → ${res.status}`);
    if (!res.ok) throw new Error(`${scrub(new URL(url, location.href).pathname)}: HTTP ${res.status}`);
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
  return { relay: s.relay || DEFAULT_RELAY || undefined, token: s.token || undefined, seal: s.seal === true, redact: s.redact !== false };
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
    log(`capture failed: ${err instanceof Error ? err.message : String(err)}`);
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
  // Work files first; raw stream logs are kept in the zip but are not worth an attachment slot.
  const textFiles = last.bundle.artifacts.filter((a) => a.content !== undefined && a.encoding !== 'base64' && (a.bytes ?? 0) < 200000 && !a.path.startsWith('live-streams/')).slice(0, 8);
  const files: Pending['files'] = [{ name: 'HANDOFF.md', type: 'text/markdown', base64: bytesToBase64(new TextEncoder().encode(String(last.files['HANDOFF.md']))) }];
  if (target.id === 'chatgpt') files.push({ name: `${slugify(last.bundle.title)}.baton.zip`, type: 'application/zip', base64: bytesToBase64(zipBytes()) });
  else for (const a of textFiles) files.push({ name: a.path.split('/').pop() || a.path, type: 'text/plain', base64: bytesToBase64(new TextEncoder().encode(a.content!)) });
  const inline = inlineFiles(textFiles.map((a) => ({ name: a.path, text: a.content! })));
  const pending: Pending = { id, createdAt: Date.now(), title: last.bundle.title, prompt: String(last.files['PROMPT.md']), files, inline };
  await chrome.storage.local.set({ [`baton:pending:${id}`]: pending });
  const targets = ((await chrome.storage.local.get('baton:targets'))['baton:targets'] ?? {}) as Record<string, string>;
  const base = targets[target.id] ?? target.newChatUrl!;
  await chrome.runtime.sendMessage({ type: 'baton:open', url: `${base}#baton=${id}`, pending: id });
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

/** Pick up a handoff by code or link (from any AI's baton_checkpoint, the CLI, or another browser) and insert it here. */
async function pickupHere(): Promise<void> {
  const input = (root.getElementById('code') as HTMLInputElement).value.trim();
  if (!input) return setStatus('Paste a pickup code (BTN-…) or link first.', 'err');
  const s = await settings();
  const p = parsePickup(input);
  const relay = p.base ?? s.relay;
  if (!relay) return setStatus('This code needs a relay: set the relay URL in Baton options, or paste the full https://…/h/BTN-… link.', 'err');
  busy(true);
  try {
    const r = await chrome.runtime.sendMessage({ type: 'baton:get', url: `${relay.replace(/\/$/, '')}/api/handoffs/${encodeURIComponent(p.code)}` });
    log(`pickup ${p.code ? 'BTN-…' : ''} → ${r?.status}`);
    if (!r?.ok) throw new Error(r?.status === 404 ? 'No handoff with that code (expired or mistyped).' : `Relay answered ${r?.status ?? 'nothing'}.`);
    const rec = JSON.parse(r.text) as RelayRecord;
    let pending: Pending;
    if (rec.sealed && !rec.bundle) {
      if (!p.key) throw new Error('This handoff is encrypted: paste the full link including the #key part.');
      const payload = JSON.parse(new TextDecoder().decode(await unseal(rec.sealed, p.key))) as { title: string; handoff: string; prompt: string };
      pending = { id: rec.code, createdAt: Date.now(), title: payload.title, prompt: payload.prompt, files: [{ name: 'HANDOFF.md', type: 'text/markdown', base64: bytesToBase64(new TextEncoder().encode(payload.handoff)) }] };
    } else {
      const { bundle, files } = renderRecord(rec);
      const texts = bundle.artifacts.filter((a) => a.content !== undefined && a.encoding !== 'base64' && (a.bytes ?? 0) < 200000).slice(0, 8);
      pending = {
        id: rec.code,
        createdAt: Date.now(),
        title: bundle.title,
        prompt: String(files['PROMPT.md']),
        files: [
          { name: 'HANDOFF.md', type: 'text/markdown', base64: bytesToBase64(new TextEncoder().encode(String(files['HANDOFF.md']))) },
          ...texts.map((a) => ({ name: a.path.split('/').pop() || a.path, type: 'text/plain', base64: bytesToBase64(new TextEncoder().encode(a.content!)) })),
        ],
        inline: inlineFiles(texts.map((a) => ({ name: a.path, text: a.content! }))),
      };
    }
    await insertHandoff(pending);
  } catch (err) {
    log(`pickup failed: ${err instanceof Error ? err.message : String(err)}`);
    setStatus(err instanceof Error ? err.message : String(err), 'err');
  } finally {
    busy(false);
  }
}

/** Diagnostics a user can paste back to the developer. Contains no conversation text, codes or ids. */
async function copyDebugReport(): Promise<void> {
  const s = await settings();
  const specs: Record<string, [string, string]> = {
    chatgpt: ['[data-message-author-role="user"]', '[data-message-author-role="assistant"]'],
    claude: ['[data-testid="user-message"]', '.font-claude-response, .font-claude-message'],
    gemini: ['user-query', 'model-response'],
  };
  const sel = specs[adapter.id];
  const composerFound = adapter.composer.input.map((q) => `${q}=${doc.querySelectorAll(q).length}`).join(' ');
  const fileInputs = (adapter.composer.file ?? []).map((q) => `${q}=${doc.querySelectorAll(q).length}`).join(' ');
  const report = [
    `Baton extension ${VERSION} · adapter ${adapter.id} · ${location.host}${scrub(location.pathname)}`,
    `browser: ${navigator.userAgent.match(/(Chrome|Edg|Brave|Firefox)\/[\d.]+/g)?.join(' ') ?? navigator.userAgent.slice(0, 80)}`,
    `conversation id in URL: ${adapter.conversationId(new URL(location.href)) ? 'yes' : 'no'}`,
    sel ? `DOM turns: user=${doc.querySelectorAll(sel[0]).length} assistant=${doc.querySelectorAll(sel[1]).length} (parsed ${domTurns(doc, { user: sel[0], assistant: sel[1] }).length})` : 'DOM turns: n/a',
    `composer: ${composerFound} · file inputs: ${fileInputs || 'n/a'}`,
    `live streams observed: ${streams.length}`,
    `relay configured: ${s.relay ? 'yes' : 'no'} · seal: ${s.seal} · redact: ${s.redact}`,
    last ? `last capture: ${last.bundle.stats.userMessages} prompts, ${last.bundle.stats.toolResults} tool results, files ${JSON.stringify(last.bundle.stats.artifacts)}, loss ${last.bundle.loss.map((l) => `${l.category}:${l.count}`).join(',')}` : 'last capture: none',
    '--- log ---',
    ...debugLog,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(report);
    setStatus('Debug report copied (no conversation text included). Paste it to whoever is helping you.', 'ok');
  } catch {
    const el = $('link');
    el.hidden = false;
    el.textContent = report;
    setStatus('Clipboard blocked: the report is shown below; select and copy it.', 'err');
  }
}

// ───────── receiving side ─────────
async function receivePending(): Promise<void> {
  const fromHash = location.hash.match(/baton=([a-z0-9]+)/)?.[1];
  if (fromHash) history.replaceState(null, '', location.pathname + location.search);
  const claimed = ((await chrome.runtime.sendMessage({ type: 'baton:claim' }).catch(() => undefined)) as { id?: string } | undefined)?.id;
  const id = fromHash ?? claimed;
  if (!id) return;
  const key = `baton:pending:${id}`;
  const p = ((await chrome.storage.local.get(key))[key] ?? undefined) as Pending | undefined;
  if (!p) return;
  await chrome.storage.local.remove(key);
  await insertHandoff(p);
}

async function insertHandoff(p: Pending): Promise<void> {
  openPanel();
  setStatus(`Inserting handoff "${p.title}"…`);
  const files = p.files.map((f) => new File([base64ToBytes(f.base64) as BlobPart], f.name, { type: f.type }));
  const how = await attachFiles(doc, adapter.composer, files);
  const filled = await fillComposer(doc, adapter.composer, p.prompt + (how === 'input' ? '' : (p.inline ?? '')) /* a synthetic paste may be ignored by the site */);
  log(`insert: attach=${how} filled=${filled}`);
  setStatus(filled ? `Handoff inserted${how !== 'none' ? ` with ${files.length} file(s)` : ''}. Review it, then press send.` : 'Could not find the message box. Use "Copy for any AI" from the source tab instead.', filled ? 'ok' : 'err');
  doc.documentElement.dataset.batonReceived = filled ? `ok:${how}` : 'fail';
}

// ───────── panel UI (shadow DOM, so page CSS cannot interfere) ─────────
const host = doc.createElement('baton-panel');
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `<style>
:host{all:initial}
*{box-sizing:border-box}
.fab{position:fixed;right:18px;bottom:88px;z-index:2147483646;width:46px;height:46px;border-radius:14px;border:0;padding:0;background:#121314;cursor:pointer;display:grid;place-items:center;box-shadow:0 10px 26px -8px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.08);transition:transform .12s}
.fab:hover{transform:translateY(-2px)}.fab svg{width:30px;height:30px}
.p{position:fixed;right:18px;bottom:144px;z-index:2147483647;width:340px;max-width:calc(100vw - 36px);max-height:70vh;overflow:auto;background:#121314;color:#F5F2EA;border-radius:20px;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;box-shadow:0 24px 60px -12px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}
.h{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px 6px;font-weight:800;font-size:16px;letter-spacing:-.01em}
.h .ttl{display:flex;align-items:center;gap:10px}.h svg{width:24px;height:24px}
.c{padding:8px 16px 16px;display:grid;gap:10px}
button.b{font:650 13.5px -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;padding:9px 12px;border-radius:12px;border:1px solid #2A2C2F;background:#1E2022;color:#F5F2EA;cursor:pointer}
button.b:hover,button.b:focus-visible{border-color:#FF5A1F;outline:none}
button.pri{background:#FF5A1F;border-color:#FF5A1F;color:#1C0A02;font-weight:800;padding:12px}
button:disabled{opacity:.5;cursor:default}
.row{display:flex;flex-wrap:wrap;gap:6px}
.lbl{font:700 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#9C988F;margin-top:4px}
.st{font-size:12.5px;color:#9C988F;min-height:1.2em}.st.ok{color:#5FC891}.st.err{color:#F2887E}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:13px;font-variant-numeric:tabular-nums;color:#D2CFC7}
.stats b{font-size:16px;color:#F5F2EA}
.cmp{font-size:12px;color:#5FC891}
.link{font:12px ui-monospace,monospace;word-break:break-all;background:#1E2022;padding:8px;border-radius:10px}
.x{background:none;border:0;font-size:20px;cursor:pointer;color:#9C988F;width:28px;height:28px;border-radius:50%}
input{flex:1;min-width:0;font:13px ui-monospace,monospace;padding:9px 10px;border:1px solid #2A2C2F;border-radius:12px;background:#0E0F10;color:#F5F2EA}
input:focus{outline:none;border-color:#FF5A1F}
</style>
<button class="fab" id="fab" title="Baton: continue this chat in another AI" aria-label="Baton"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="8.6" y="12.9" width="17.4" height="6.6" rx="3.3" transform="rotate(-38 17.3 16.2)" fill="#FF5A1F"/><path d="M6.2 24.6l3.4-2.7M5.6 19.4l2.3-1.8" stroke="#FF5A1F" stroke-width="2.1" stroke-linecap="round" opacity=".55" fill="none"/></svg></button>
<div class="p" id="panel" hidden>
  <div class="h"><span class="ttl"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="8.6" y="12.9" width="17.4" height="6.6" rx="3.3" transform="rotate(-38 17.3 16.2)" fill="#FF5A1F"/><path d="M6.2 24.6l3.4-2.7M5.6 19.4l2.3-1.8" stroke="#FF5A1F" stroke-width="2.1" stroke-linecap="round" opacity=".55" fill="none"/></svg><span>Baton · ${adapter.label}</span></span><button class="x" id="close" aria-label="Close">×</button></div>
  <div class="c">
    <button class="b pri" id="cap">Capture this conversation</button>
    <div class="stats" id="stats" hidden></div>
    <div class="cmp" id="cmp" hidden></div>
    <div id="acts" hidden>
      <div class="row"><button class="b" id="copy">Copy for any AI</button><button class="b" id="send">Get a link</button><button class="b" id="save">Save .zip</button></div>
      <div class="lbl">Continue in</div>
      <div class="row" id="targets"></div>
    </div>
    <div class="lbl">Pick up a handoff here</div>
    <div class="row"><input id="code" placeholder="BTN-… code or link" aria-label="Pickup code or link"><button class="b" id="pick">Insert</button></div>
    <div class="link" id="link" hidden></div>
    <div class="st" id="st" role="status">${streams.length ? '' : 'Ready.'}</div>
    <div class="st" id="tap"></div>
    <div class="row" style="justify-content:space-between"><button class="b" id="dbg" style="font-size:11px">Copy debug report</button><button class="b" id="opts" style="font-size:11px">Options</button></div>
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
  if (adapter.id === 'chatgpt' && !/^\/share\//.test(location.pathname)) {
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
$('pick').onclick = pickupHere;
$('dbg').onclick = copyDebugReport;
$('opts').onclick = () => chrome.runtime.sendMessage({ type: 'baton:options' });
log(`loaded on ${location.host}${scrub(location.pathname)} as ${adapter.id}`);
chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type === 'baton:toggle') $('panel').hidden = !$('panel').hidden;
});

(doc.body ?? doc.documentElement).appendChild(host);
receivePending();
