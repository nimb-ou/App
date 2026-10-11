// Baton web app: client-side only. Parses the dropped/pasted conversation in the browser; nothing is uploaded.

import { listZip, zip } from '../src/core/zip.ts';
import { convert, pickExportMember, type ConvertedBundle } from '../src/pipeline.ts';
import { parseAny } from '../src/parsers/detect.ts';
import { markdownToHtml } from '../src/render/mdlite.ts';
import { fmtBytes } from '../src/render/turns.ts';
import { escapeHtml } from '../src/core/util.ts';

declare const __SAMPLE__: string;
declare const __SAMPLE_URL__: string;

type ClaudeHost = { use?: (name: string) => Promise<unknown> };
type Downloads = { save: (r: { filename: string; data: string | Blob | ArrayBufferView }) => Promise<{ status: string }> };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const state: { text: string; filename: string; url?: string; current?: ConvertedBundle; tab: string; isSample: boolean } = { text: '', filename: '', tab: 'handoff', isSample: false };

// ───────── saving files (artifact viewer capability, or a plain download) ─────────

let downloads: Downloads | null | undefined;
const host = (window as unknown as { claude?: ClaudeHost }).claude;
if (host?.use) {
  host.use('downloads').then((d) => (downloads = d as Downloads | null), () => (downloads = null));
} else downloads = undefined; // standalone page: native downloads work

async function saveFile(filename: string, data: string | Uint8Array): Promise<void> {
  if (host?.use) {
    if (!downloads) return setStatus('Saving files is not available in this view. Use the copy buttons instead.', 'warn');
    try {
      await downloads.save({ filename, data });
      setStatus(`Saved ${filename}.`, 'ok');
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'declined') setStatus(`Could not save ${filename} (${code ?? 'error'}).`, 'warn');
    }
    return;
  }
  const blob = new Blob([data as BlobPart], { type: filename.endsWith('.zip') ? 'application/zip' : 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function copy(text: string, label: string, btn: HTMLElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    flash(btn, 'Copied');
    setStatus(`${label} copied. Paste it into ChatGPT, Claude, Gemini or any agent.`, 'ok');
  } catch {
    showTab('prompt');
    const ta = document.querySelector<HTMLTextAreaElement>('#panel textarea');
    ta?.focus();
    ta?.select();
    setStatus('Clipboard blocked here. The text is selected, so press Ctrl/Cmd+C.', 'warn');
  }
}

function flash(btn: HTMLElement, text: string) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1400);
}

function setStatus(msg: string, kind: 'ok' | 'warn' | 'err' | '' = '') {
  const el = $('status');
  el.textContent = msg;
  el.dataset.kind = kind;
}

// ───────── reading input ─────────

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readFile(file: File): Promise<{ text: string; filename: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const entries = listZip(buf).filter((e) => /\.(json|jsonl|html?)$/i.test(e.name));
    const name = pickExportMember(entries.map((e) => e.name));
    const entry = entries.find((e) => e.name === name);
    if (!entry) throw new Error('This zip has no conversations.json, .jsonl or .html inside.');
    const raw = entry.method === 8 ? await inflateRaw(entry.compressed) : entry.compressed;
    return { text: new TextDecoder().decode(raw), filename: entry.name };
  }
  return { text: new TextDecoder().decode(buf), filename: file.name };
}

async function load(text: string, filename: string, opts: { url?: string; sample?: boolean } = {}) {
  state.text = text;
  state.filename = filename;
  state.url = opts.url;
  state.isSample = !!opts.sample;
  const picker = $<HTMLSelectElement>('pick');
  const list = parseAny(text, filename, opts.url);
  if (list.length > 1) {
    picker.innerHTML = list.map((c, i) => `<option value="${i}">${escapeHtml(c.title)} · ${c.events.filter((e) => e.kind === 'message' && e.role === 'user').length} prompts</option>`).join('');
    $('pickerRow').hidden = false;
  } else $('pickerRow').hidden = true;
  run();
}

function run() {
  if (!state.text) return;
  const t0 = performance.now();
  try {
    const list = parseAny(state.text, state.filename, state.url);
    const idx = list.length > 1 ? Number($<HTMLSelectElement>('pick').value || 0) : 0;
    const pick = list.length > 1 ? list[idx].source.conversationId ?? list[idx].title : undefined;
    const [res] = convert(state.text, state.filename, {
      url: state.url,
      pick,
      redact: $<HTMLInputElement>('optRedact').checked,
      includeHidden: $<HTMLInputElement>('optHidden').checked,
      html: true,
    });
    state.current = res;
    render();
    const ms = Math.round(performance.now() - t0);
    setStatus(state.isSample ? `Example loaded: a real public ChatGPT share link, converted in ${ms} ms. Drop your own file to replace it.` : `Converted ${state.filename} in ${ms} ms. Nothing left this browser.`, 'ok');
  } catch (e) {
    setStatus(e instanceof Error ? e.message : String(e), 'err');
  }
}

// ───────── rendering ─────────

function render() {
  const r = state.current;
  if (!r) return;
  const b = r.bundle;
  const s = b.stats;
  const a = s.artifacts;
  const total = Math.max(1, a.recovered + a.stale + a.lost + a.attached);
  $('mTitle').textContent = b.title;
  $('mSource').textContent = `${b.source.tool}${b.source.model ? ` · ${b.source.model}` : ''} · ${b.source.kind}`;
  $('mSample').hidden = !state.isSample;
  $('mCounts').innerHTML = [
    ['prompts', s.userMessages],
    ['replies', s.assistantMessages],
    ['reasoning', s.reasoningBlocks],
    ['tool calls', s.toolCalls],
  ]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
    .join('');
  $('mBar').innerHTML = (['recovered', 'attached', 'stale', 'lost'] as const)
    .filter((k) => a[k])
    .map((k) => `<span class="seg s-${k}" style="flex:${a[k] / total}" title="${a[k]} ${k}"></span>`)
    .join('') || '<span class="seg empty" style="flex:1"></span>';
  $('mLegend').innerHTML = (['recovered', 'attached', 'stale', 'lost'] as const)
    .filter((k) => a[k] || k !== 'attached')
    .map((k) => `<span><i class="dot s-${k}"></i>${a[k]} ${k}</span>`)
    .join('');
  const high = b.loss.filter((l) => l.severity === 'high');
  $('mLoss').innerHTML = high.length
    ? high.map((l) => `<li><b>${l.count}</b> ${escapeHtml(l.category.replace(/-/g, ' '))}</li>`).join('')
    : '<li class="none">No high-severity loss</li>';
  $('mRoot').textContent = b.integrity.root;
  $('out').hidden = false;
  showTab(state.tab);
}

function showTab(tab: string) {
  state.tab = tab;
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
  const r = state.current;
  if (!r) return;
  const p = $('panel');
  const f = r.files;
  if (tab === 'handoff') p.innerHTML = `<div class="md">${markdownToHtml(String(f['HANDOFF.md']).replace(/^---[\s\S]*?---\n/, ''))}</div>`;
  else if (tab === 'prompt') p.innerHTML = `<p class="hint">One block for any chat app that cannot open folders. Paste it as your first message.</p><textarea readonly id="promptText" aria-label="Paste-ready prompt">${escapeHtml(String(f['PROMPT.md']))}</textarea>`;
  else if (tab === 'files') {
    const arts = r.bundle.artifacts;
    p.innerHTML = arts.length
      ? `<ul class="files">${arts
          .map((x) => `<li><span class="tag s-${x.status}">${x.status}</span><code>${escapeHtml(x.path)}</code><span class="sz">${fmtBytes(x.bytes)}</span>${x.note ? `<small>${escapeHtml(x.note)}</small>` : ''}</li>`)
          .join('')}</ul>`
      : '<p class="hint">This conversation did not create or reference files.</p>';
  } else if (tab === 'loss') p.innerHTML = `<div class="md">${markdownToHtml(String(f['LOSS_AUDIT.md']))}</div>`;
}

// ───────── wiring ─────────

function wire() {
  const drop = $('drop');
  const file = $<HTMLInputElement>('file');
  const take = async (fl: FileList | null) => {
    const f = fl?.[0];
    if (!f) return;
    setStatus(`Reading ${f.name}…`);
    try {
      const { text, filename } = await readFile(f);
      await load(text, filename);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e), 'err');
    }
  };
  file.addEventListener('change', () => take(file.files));
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    take(e.dataTransfer?.files ?? null);
  });
  $('pasteGo').addEventListener('click', () => {
    const t = $<HTMLTextAreaElement>('paste').value;
    if (!t.trim()) return setStatus('Paste a share page, export JSON or session log first.', 'warn');
    load(t, 'pasted.txt').catch((e) => setStatus(String(e instanceof Error ? e.message : e), 'err'));
  });
  $('optRedact').addEventListener('change', run);
  $('optHidden').addEventListener('change', run);
  $('pick').addEventListener('change', run);
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab!)));

  $('bCopyPrompt').addEventListener('click', (e) => state.current && copy(String(state.current.files['PROMPT.md']), 'Paste-ready prompt', e.currentTarget as HTMLElement));
  $('bCopyHandoff').addEventListener('click', (e) => state.current && copy(String(state.current.files['HANDOFF.md']), 'HANDOFF.md', e.currentTarget as HTMLElement));
  $('bZip').addEventListener('click', () => {
    const r = state.current;
    if (!r) return;
    const prefixed: Record<string, string | Uint8Array> = {};
    for (const [k, v] of Object.entries(r.files)) prefixed[`${r.slug}/${k}`] = v;
    saveFile(`${r.slug}.baton.zip`, zip(prefixed));
  });
  $('bHandoff').addEventListener('click', () => state.current && saveFile(`${state.current.slug}.HANDOFF.md`, String(state.current.files['HANDOFF.md'])));
  $('bCli').addEventListener('click', (e) => copy($('cliCmd').textContent ?? '', 'CLI command', e.currentTarget as HTMLElement));
}

wire();
if (typeof __SAMPLE__ === 'string' && __SAMPLE__) {
  load(__SAMPLE__, 'share.html', { url: __SAMPLE_URL__ || undefined, sample: true }).catch((e) => setStatus(String(e), 'err'));
}
