// index.html: a single self-contained page (no network, no external assets) to read a bundle.

import type { BatonBundle } from '../core/schema.ts';
import { escapeHtml } from '../core/util.ts';
import { renderHandoff } from './handoff.ts';
import { renderLossAudit, renderTranscript } from './markdown.ts';
import { markdownToHtml } from './mdlite.ts';
import { fmtBytes, sourceLabel } from './turns.ts';

const CSS = `
:root{--bg:#fbfaf7;--fg:#1d1d1f;--muted:#6b6b70;--card:#fff;--line:#e6e3dc;--accent:#b4521f;--code:#f3f1ec;--hi:#fde7da;--ok:#2f7d4f;--warn:#a46a00;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#141413;--fg:#ecebe6;--muted:#a3a29c;--card:#1d1d1b;--line:#33322f;--accent:#e08a5a;--code:#262522;--hi:#3a2a20;--ok:#6cc08f;--warn:#e0b04a;--bad:#f08a80}}
:root[data-theme=dark]{--bg:#141413;--fg:#ecebe6;--muted:#a3a29c;--card:#1d1d1b;--line:#33322f;--accent:#e08a5a;--code:#262522;--hi:#3a2a20;--ok:#6cc08f;--warn:#e0b04a;--bad:#f08a80}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg)}
body{font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:28px 16px 8px;max-width:980px;margin:auto}
header h1{font-size:26px;line-height:1.25;margin:0 0 6px}
.meta{color:var(--muted);font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
.chip{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:12.5px}
.chip b{font-variant-numeric:tabular-nums}
nav{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line)}
nav .in{max-width:980px;margin:auto;display:flex;gap:4px;padding:8px 16px;overflow-x:auto;align-items:center}
nav button{font:inherit;font-size:14px;border:0;background:none;color:var(--muted);padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap}
nav button[aria-selected=true]{background:var(--card);color:var(--fg);box-shadow:0 0 0 1px var(--line)}
nav input{margin-left:auto;font:inherit;font-size:14px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);min-width:160px}
main{max-width:980px;margin:auto;padding:8px 16px 80px}
section{display:none}section.on{display:block}
h2{font-size:19px;margin:28px 0 8px}h3{font-size:15.5px;margin:20px 0 6px;color:var(--accent)}
a{color:var(--accent)}
pre{background:var(--code);padding:12px;border-radius:8px;overflow:auto;font-size:12.5px;line-height:1.45;max-height:520px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em}
p code,li code,td code{background:var(--code);padding:1px 5px;border-radius:4px}
blockquote{margin:8px 0;padding:4px 14px;border-left:3px solid var(--accent);background:var(--card);border-radius:0 8px 8px 0}
details{border:1px solid var(--line);border-radius:8px;margin:8px 0;background:var(--card)}
details>summary{cursor:pointer;padding:6px 10px;color:var(--muted);font-size:13.5px}
details[open]>summary{border-bottom:1px solid var(--line)}
details>*:not(summary){margin-left:10px;margin-right:10px}
.tbl{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13.5px;margin:8px 0}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600}
.s-recovered{color:var(--ok)}.s-stale{color:var(--warn)}.s-lost{color:var(--bad)}.s-attached{color:var(--ok)}
.turn.hide{display:none}
mark{background:var(--hi);color:inherit}
footer{color:var(--muted);font-size:12px;max-width:980px;margin:auto;padding:0 16px 40px}
`;

const JS = `
const tabs=[...document.querySelectorAll('nav button')];
function show(id){tabs.forEach(b=>b.setAttribute('aria-selected',b.dataset.t===id));document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('on',s.id===id));try{history.replaceState(null,'','#'+id)}catch(e){}}
tabs.forEach(b=>b.onclick=()=>show(b.dataset.t));
show((location.hash||'#handoff').slice(1)||'handoff');
const q=document.getElementById('q');
q.oninput=()=>{const v=q.value.trim().toLowerCase();if(v)show('transcript');
document.querySelectorAll('.turn').forEach(t=>{const hit=!v||t.textContent.toLowerCase().includes(v);t.classList.toggle('hide',!hit);if(hit&&v)t.querySelectorAll('details').forEach(d=>{if(d.textContent.toLowerCase().includes(v))d.open=true})})};
`;

/** Wrap each "## Turn N" block of the transcript HTML in a <div class="turn"> for search filtering. */
function wrapTurns(html: string): string {
  const parts = html.split(/(?=<h2>(?:Turn \d+|Preamble)<\/h2>)/);
  return parts.map((p) => (/^<h2>(?:Turn \d+|Preamble)<\/h2>/.test(p) ? `<div class="turn">${p}</div>` : p)).join('\n');
}

export function renderHtml(b: BatonBundle): string {
  const s = b.stats;
  const files = b.artifacts
    .map((a) => {
      const head = `<span class="s-${a.status}">${a.status}</span> · <code>${escapeHtml(a.path)}</code> ${a.bytes !== undefined ? `· ${fmtBytes(a.bytes)}` : ''}${a.note ? ` · <span class="meta">${escapeHtml(a.note)}</span>` : ''}`;
      return a.content !== undefined ? `<details><summary>${head}</summary><pre><code>${escapeHtml(a.content)}</code></pre></details>` : `<p>${head}</p>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="Baton ${escapeHtml(b.generator.version)}">
<title>${escapeHtml(b.title)} · Baton handoff</title>
<style>${CSS}</style></head>
<body>
<header>
<div class="meta">Baton handoff · ${escapeHtml(sourceLabel(b))}</div>
<h1>${escapeHtml(b.title)}</h1>
${b.source.url ? `<div class="meta"><a href="${escapeHtml(b.source.url)}" rel="noopener noreferrer">${escapeHtml(b.source.url)}</a></div>` : ''}
<div class="chips">
<span class="chip"><b>${s.userMessages}</b> prompts</span>
<span class="chip"><b>${s.reasoningBlocks}</b> reasoning</span>
<span class="chip"><b>${s.toolCalls}</b> tool calls</span>
<span class="chip"><b class="s-recovered">${s.artifacts.recovered}</b> files recovered</span>
${s.artifacts.stale ? `<span class="chip"><b class="s-stale">${s.artifacts.stale}</b> stale</span>` : ''}
${s.artifacts.lost ? `<span class="chip"><b class="s-lost">${s.artifacts.lost}</b> lost</span>` : ''}
<span class="chip">root <code>${b.integrity.root.slice(0, 12)}…</code></span>
</div>
</header>
<nav><div class="in" role="tablist">
<button data-t="handoff" role="tab">Handoff</button>
<button data-t="transcript" role="tab">Transcript</button>
<button data-t="files" role="tab">Files (${b.artifacts.length})</button>
<button data-t="loss" role="tab">Loss audit</button>
<input id="q" type="search" placeholder="Search transcript" aria-label="Search transcript">
</div></nav>
<main>
<section id="handoff">${markdownToHtml(renderHandoff(b).replace(/^---[\s\S]*?---\n/, ''))}</section>
<section id="transcript">${wrapTurns(markdownToHtml(renderTranscript(b)))}</section>
<section id="files"><h2>Files</h2>${files || '<p>No files.</p>'}</section>
<section id="loss">${markdownToHtml(renderLossAudit(b))}</section>
</main>
<footer>Generated ${escapeHtml(b.generator.generatedAt)} by Baton ${escapeHtml(b.generator.version)} · bundle <code>${escapeHtml(b.id)}</code> · this page works offline.</footer>
<script>${JS}</script>
</body></html>
`;
}
