// "Baton Link": one page that serves both audiences.
//   People see a handoff card with one-tap "Continue in ChatGPT / Claude / Gemini" buttons.
//   AIs that open the same URL (every major assistant can browse) read the full brief as plain text in the page.
// No install, no connector, no codes. Works on phones.

import type { BatonBundle } from '../core/schema.ts';
import { escapeHtml, truncate } from '../core/util.ts';
import type { FileMap } from '../core/zip.ts';

/** Everything an AI needs, as Markdown: instructions, the handoff brief, and file contents (budgeted). */
export function aiBrief(b: BatonBundle, files: FileMap, budget = 90000): string {
  const handoff = String(files['HANDOFF.md'] ?? '').replace(/^---[\s\S]*?---\n/, '');
  const parts: string[] = [
    `# Baton handoff: ${b.title}`,
    '',
    `> **To the AI reading this:** a user moved this work here from ${b.source.tool}. Read the brief, restate the goal and where`,
    '> the work stopped in 2–3 sentences, list anything marked lost, then continue from the latest instruction (§3).',
    '> Do not assume lost files exist.',
    '',
    handoff,
  ];
  let room = budget - parts.join('\n').length;
  const inline: string[] = [];
  for (const a of b.artifacts) {
    if (a.content === undefined || a.encoding === 'base64') continue;
    const block = `### files/${a.path}\n\n\`\`\`\n${a.content.replace(/```/g, '`\u200b``')}\n\`\`\``;
    if (block.length > room) {
      inline.push(`### files/${a.path}\n\n*(${a.bytes} bytes, not inlined here: download the .zip)*`);
      continue;
    }
    room -= block.length;
    inline.push(block);
  }
  if (inline.length) parts.push('', '## File contents', '', ...inline);
  return parts.join('\n') + '\n';
}

function continuePrompt(title: string, url: string, tool: string): string {
  return `Please open this link and continue the work it describes: ${url}\n\nIt is a Baton handoff of "${title}" from ${tool}: my prompts, the state of the work, decisions and files. Restate the goal and where it stopped, then continue.`;
}

export interface LinkPageInput {
  bundle: BatonBundle;
  files: FileMap;
  selfUrl: string; // canonical URL of this page (what AIs should open)
  zipUrl: string;
  fullUrl: string;
  mdUrl: string;
}

export function linkPage({ bundle: b, files, selfUrl, zipUrl, fullUrl, mdUrl }: LinkPageInput): string {
  const s = b.stats;
  const a = s.artifacts;
  const prompt = continuePrompt(b.title, selfUrl, b.source.tool);
  const q = encodeURIComponent(prompt);
  const high = b.loss.filter((l) => l.severity === 'high');
  const brief = aiBrief(b, files);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(b.title)} · Baton</title>
<meta name="description" content="${escapeHtml(truncate(`Baton handoff of "${b.title}" from ${b.source.tool}: ${s.userMessages} prompts, ${a.recovered} files.`, 200))}">
<meta name="robots" content="noindex">
<link rel="alternate" type="text/markdown" href="${escapeHtml(mdUrl)}">
<style>
:root{--bg:#f3f5f4;--card:#fff;--fg:#14201b;--mu:#5b6b64;--line:#d7dfdb;--ac:#2343c9;--acfg:#fff;--ok:#1f7a4d;--bad:#b4271c;--warn:#9a6400}
@media (prefers-color-scheme:dark){:root{--bg:#0f1513;--card:#161e1b;--fg:#e4ebe7;--mu:#9aaba3;--line:#2a3632;--ac:#8ea4ff;--acfg:#0d1430;--ok:#69c897;--bad:#f08b80;--warn:#e6b450}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.w{max-width:760px;margin:0 auto;padding:28px 16px 64px}
.k{font:600 12px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}
h1{font-size:clamp(26px,5vw,36px);line-height:1.1;margin:6px 0 10px;text-wrap:balance}
.stats{display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--mu);font-size:14.5px;font-variant-numeric:tabular-nums}
.stats b{color:var(--fg)}.lost b{color:var(--bad)}
.go{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:22px 0 10px}
.go a,.go button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:10px 14px;border-radius:10px;font:700 16px system-ui,sans-serif;text-decoration:none;cursor:pointer;border:1px solid var(--fg);background:var(--card);color:var(--fg)}
.go .p{background:var(--ac);border-color:var(--ac);color:var(--acfg)}
.sub{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14.5px;margin:6px 0 24px}.sub a,.sub button{color:var(--ac);background:none;border:0;padding:0;font:inherit;cursor:pointer;text-decoration:underline}
.note{font-size:14px;color:var(--mu);border-left:3px solid var(--line);padding:2px 12px;margin:0 0 22px}
details{background:var(--card);border:1px solid var(--line);border-radius:10px}summary{cursor:pointer;padding:12px 14px;font-weight:700}
article{padding:4px 16px 16px;overflow-wrap:anywhere}pre.brief{white-space:pre-wrap;font:13px/1.5 ui-monospace,Menlo,monospace;margin:0}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--fg);color:var(--bg);padding:10px 16px;border-radius:8px;font-size:14px;opacity:0;transition:opacity .2s}
.toast.on{opacity:1}
</style></head><body><div class="w">
<div class="k">Baton handoff · from ${escapeHtml(b.source.tool)}</div>
<h1>${escapeHtml(b.title)}</h1>
<div class="stats"><span><b>${s.userMessages}</b> prompts</span><span><b>${s.toolCalls}</b> tool calls</span><span><b>${a.recovered + a.attached}</b> files recovered</span>${a.lost ? `<span class="lost"><b>${a.lost}</b> lost at source</span>` : ''}</div>
<div class="go">
<a class="p" href="https://claude.ai/new?q=${q}" target="_blank" rel="noopener">Continue in Claude</a>
<a class="p" href="https://chatgpt.com/?q=${q}" target="_blank" rel="noopener">Continue in ChatGPT</a>
<button type="button" data-copy-open="https://gemini.google.com/app">Continue in Gemini</button>
</div>
<div class="sub"><button type="button" data-copy="1">Copy prompt for any AI</button><button type="button" data-copy-link="1">Copy this link</button><a href="${escapeHtml(zipUrl)}">Download bundle (.zip)</a><a href="${escapeHtml(fullUrl)}">Full transcript</a><a href="${escapeHtml(mdUrl)}">Plain text</a></div>
<p class="note">Any AI that can browse (ChatGPT, Claude, Gemini, Perplexity, Copilot…) can read this page. Paste the link and say "continue this".${high.length ? ` What the source did not include: ${escapeHtml(high.map((l) => `${l.count} ${l.category.replace(/-/g, ' ')}`).join(', '))}.` : ''}</p>
<details open><summary>Handoff brief (this is what the AI reads)</summary><article><pre class="brief">${escapeHtml(brief)}</pre></article></details>
</div><div class="toast" id="t"></div>
<script>
const P=${JSON.stringify(prompt).replace(/</g, '\\u003c')},L=${JSON.stringify(selfUrl).replace(/</g, '\\u003c')};
const t=document.getElementById('t');const toast=m=>{t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2200)};
const copy=async s=>{try{await navigator.clipboard.writeText(s);return true}catch{return false}};
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>toast(await copy(P)?'Prompt copied: paste it into any AI':'Copy blocked: select the brief below'));
document.querySelectorAll('[data-copy-link]').forEach(b=>b.onclick=async()=>toast(await copy(L)?'Link copied':'Copy blocked'));
document.querySelectorAll('[data-copy-open]').forEach(b=>b.onclick=async()=>{await copy(P);toast('Prompt copied. Paste it in Gemini');window.open(b.dataset.copyOpen,'_blank','noopener')});
</script></body></html>`;
}

/** Home page: paste a share link (or code) and go. */
export function homePage(base: string, mcpDisplay: string, bookmarklet: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton</title>
<style>:root{--bg:#f3f5f4;--card:#fff;--fg:#14201b;--mu:#5b6b64;--line:#d7dfdb;--ac:#2343c9;--acfg:#fff}@media (prefers-color-scheme:dark){:root{--bg:#0f1513;--card:#161e1b;--fg:#e4ebe7;--mu:#9aaba3;--line:#2a3632;--ac:#8ea4ff;--acfg:#0d1430}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif}.w{max-width:720px;margin:0 auto;padding:40px 16px 64px}
h1{font-size:clamp(34px,7vw,52px);line-height:1;margin:0 0 10px;letter-spacing:-.01em}p{color:var(--mu);margin:0 0 18px}
form{display:flex;gap:8px;flex-wrap:wrap}input{flex:1 1 280px;min-width:0;font:16px system-ui,sans-serif;padding:14px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg)}
button{font:700 16px system-ui,sans-serif;padding:14px 20px;border-radius:10px;border:0;background:var(--ac);color:var(--acfg);cursor:pointer}
ol{padding-left:20px;color:var(--mu)}li{margin:6px 0}code{font:13px ui-monospace,monospace;background:var(--card);padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}h2{font-size:18px;margin:34px 0 8px}
.bm{display:inline-block;padding:12px 18px;border-radius:10px;background:var(--ac);color:var(--acfg);font-weight:800;text-decoration:none;cursor:grab}</style></head>
<body><div class="w"><h1>Baton</h1><p>Move a conversation from one AI to another, including the parts a share link drops.</p>
<h2>1 · Add the Baton button (once)</h2>
<p><a class="bm" href="${escapeHtml(bookmarklet)}" onclick="event.preventDefault();alert('Drag this button to your bookmarks bar, then click it on a ChatGPT, Claude or Gemini chat.')">⚡ Baton</a> ← drag this to your bookmarks bar (show the bar with Ctrl/Cmd+Shift+B).</p>
<h2>2 · On any ChatGPT, Claude or Gemini chat, click it</h2>
<p>Baton reads the chat using your own signed-in browser (prompts, replies and, in ChatGPT and Claude, tool outputs, code and artifacts) and saves it to your relay. A page opens with <b>Continue in Claude / ChatGPT / Gemini</b> buttons, and the link is copied. Any AI can open that link and pick up the work.</p>
<h2>Or paste a code</h2>
<form action="/go" method="get"><input name="u" placeholder="BTN-… or a Baton link" aria-label="Baton code" required><button>Open</button></form>
<h2>For AIs with connectors</h2><p>MCP server: <code>${escapeHtml(base + mcpDisplay)}</code>. In any AI: "baton: hand this off" → code → "baton pickup &lt;code&gt;" elsewhere.</p>
</div></body></html>`;
}
