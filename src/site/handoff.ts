// The Baton Link page (/h/<code>): one URL for two readers.
//   People: what this is, one tap to continue in Claude / ChatGPT / Gemini, the conversation, files, what's missing.
//   AIs: the complete brief is the first content in the document (and at <url>.md), so a fetcher that converts the
//   page to text reads it before anything else. All panels are in the HTML; tabs only change what is shown.

import type { BatonBundle, BatonEvent } from '../core/schema.ts';
import { escapeHtml, plural, truncate } from '../core/util.ts';
import type { FileMap } from '../core/zip.ts';
import { markdownToHtml } from '../render/mdlite.ts';
import { fmtBytes } from '../render/turns.ts';
import { aiBrief, continuePrompt } from '../relay/linkpage.ts';
import { DESTINATIONS, markSvg, shell } from './brand.ts';

export interface HandoffPageInput {
  bundle: BatonBundle;
  files: FileMap;
  selfUrl: string;
  code: string;
  expiresAt?: string; // absent for the permanent demo
  owner?: boolean; // this browser created it: offer delete
  banner?: 'new' | 'gemini' | 'deleted-failed';
  ogImage?: string;
}

const CSS = `
.hp{padding-top:28px}
.banner{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding:16px 18px;border-radius:var(--r);background:var(--signal-soft);border:1px solid color-mix(in srgb,var(--signal) 35%,transparent);margin-bottom:26px}
.banner b{font-size:17px}.banner .grow{flex:1 1 260px}
.linkbox{display:flex;gap:8px;flex:1 1 100%;min-width:0}
.linkbox input{flex:1;min-width:0;font:600 15px var(--f-mono);padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
.meta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:12px}
.src{display:inline-flex;align-items:center;gap:8px;font-weight:700}
.src .dot{width:9px;height:9px;border-radius:50%;background:var(--mu)}
h1.t{font-size:clamp(32px,5.6vw,56px);margin-bottom:16px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px}
.go{padding:20px}
.go h2{font-size:15px;font-family:var(--f-body);letter-spacing:0;font-weight:700;color:var(--mu);margin-bottom:12px}
.go-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media (max-width:640px){.go-grid{grid-template-columns:1fr}.tabbar label{padding:10px 12px;font-size:14px}.msg{max-width:94%}}
.go-grid .btn{width:100%;min-height:58px;font-size:17px;border-radius:16px}
.go-grid .btn.last{outline:2px solid var(--signal);outline-offset:2px}
.go-more{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ai-note{font-size:14px;color:var(--mu);margin:16px 2px 30px}
.ai-note a{color:var(--ink-2)}
.tabs{position:relative}
.tabbar{display:flex;gap:4px;padding:4px;background:var(--sunk);border-radius:999px;overflow-x:auto;scrollbar-width:none;margin-bottom:18px}
.tabbar label{flex:1 0 auto;text-align:center;padding:10px 16px;border-radius:999px;font-weight:700;font-size:14.5px;color:var(--mu);cursor:pointer;white-space:nowrap}
.panel{display:none}
#t-conv:checked~.tabbar [for=t-conv],#t-brief:checked~.tabbar [for=t-brief],#t-files:checked~.tabbar [for=t-files],#t-miss:checked~.tabbar [for=t-miss]{background:var(--card);color:var(--ink);box-shadow:var(--shadow)}
#t-conv:checked~.panels .p-conv,#t-brief:checked~.panels .p-brief,#t-files:checked~.panels .p-files,#t-miss:checked~.panels .p-miss{display:block}
#t-conv:focus-visible~.tabbar [for=t-conv],#t-brief:focus-visible~.tabbar [for=t-brief],#t-files:focus-visible~.tabbar [for=t-files],#t-miss:focus-visible~.tabbar [for=t-miss]{outline:3px solid var(--signal)}
.msgs{display:flex;flex-direction:column;gap:14px}
.msg{max-width:88%;padding:14px 16px;border-radius:18px;overflow-wrap:anywhere}
.msg.user{align-self:flex-end;background:var(--ink);color:var(--paper);border-bottom-right-radius:6px;white-space:pre-wrap}
.msg.assistant{align-self:flex-start;background:var(--card);border:1px solid var(--line);border-bottom-left-radius:6px}
.msg .who{font:700 11.5px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:8px}
.msg.assistant p,.msg.assistant ul,.msg.assistant ol,.msg.assistant pre,.msg.assistant table,.msg.assistant blockquote{margin:0 0 10px}
.msg.assistant>div>:last-child{margin-bottom:0}
.msg pre{background:var(--sunk);padding:12px;border-radius:10px;overflow:auto;font:13px/1.5 var(--f-mono);white-space:pre}
.msg code{font:13px var(--f-mono);background:var(--sunk);padding:1px 5px;border-radius:5px}
.msg pre code{background:none;padding:0}
.msg table{border-collapse:collapse;font-size:14px;display:block;overflow:auto}.msg td,.msg th{border:1px solid var(--line);padding:5px 8px}
.msg.clamp>div{max-height:340px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 70%,transparent);mask-image:linear-gradient(#000 70%,transparent)}
.more{all:unset;cursor:pointer;margin-top:8px;font-weight:700;font-size:14px;color:var(--signal)}
.step{align-self:center;font-size:13px;color:var(--mu);display:flex;align-items:center;gap:8px}
.step::before,.step::after{content:"";width:28px;height:1px;background:var(--line)}
.gap{align-self:center;font-size:14px;color:var(--mu);padding:6px 14px;border:1px dashed var(--line);border-radius:999px}
pre.brief{white-space:pre-wrap;font:13.5px/1.6 var(--f-mono);margin:0;padding:20px;overflow-wrap:anywhere}
.list{display:flex;flex-direction:column}
.row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--line)}
.row:first-child{border-top:0}
.row .path{flex:1;min-width:0;font:600 14px var(--f-mono);overflow-wrap:anywhere}
.row .detail{flex:1;min-width:0}
.empty{padding:28px;text-align:center;color:var(--mu)}
.owner{margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;color:var(--mu);font-size:14.5px}
.owner button{all:unset;cursor:pointer;color:var(--bad);font-weight:700;text-decoration:underline;text-underline-offset:3px}
.cta{margin-top:56px;padding:28px;display:flex;flex-wrap:wrap;gap:18px 24px;align-items:center;background:var(--ink);color:var(--paper);border-radius:var(--r-lg)}
.cta h3{font-size:24px}.cta p{color:color-mix(in srgb,var(--paper) 70%,transparent)}.cta .grow{flex:1 1 280px}
`;

const SOURCE_DOT: Record<string, string> = { chatgpt: '#10A37F', claude: '#D97757', gemini: '#4F7DF3' };

function sourceKey(tool: string): string {
  const t = tool.toLowerCase();
  return t.includes('chatgpt') ? 'chatgpt' : t.includes('claude') ? 'claude' : t.includes('gemini') ? 'gemini' : '';
}

function expiryText(iso?: string): string {
  if (!iso) return 'Permanent demo';
  const ms = Date.parse(iso) - Date.now();
  const d = Math.floor(ms / 86400000);
  if (d >= 2) return `Expires in ${d} days`;
  const h = Math.max(1, Math.round(ms / 3600000));
  return `Expires in ${plural(h, 'hour')}`;
}

/** Visible conversation, with runs of tool work collapsed into one line. Very long chats keep the start and the end. */
function conversationHtml(events: BatonEvent[]): string {
  type Item = { kind: 'msg'; e: BatonEvent } | { kind: 'step'; tools: number; thoughts: number };
  const items: Item[] = [];
  for (const e of events) {
    if (e.kind === 'message' && !e.hidden && (e.role === 'user' || e.role === 'assistant') && e.text.trim()) {
      items.push({ kind: 'msg', e });
    } else if (e.kind === 'tool_call' || e.kind === 'reasoning') {
      const last = items[items.length - 1];
      const step = last?.kind === 'step' ? last : (items.push({ kind: 'step', tools: 0, thoughts: 0 }), items[items.length - 1] as Extract<Item, { kind: 'step' }>);
      if (e.kind === 'tool_call') step.tools++;
      else step.thoughts++;
    }
  }
  if (!items.some((i) => i.kind === 'msg')) return '<div class="empty">No visible messages. See the brief for details.</div>';
  const MAX = 80;
  let shown = items;
  let gap = 0;
  if (items.length > MAX) {
    shown = [...items.slice(0, 12), ...items.slice(items.length - (MAX - 12))];
    gap = items.length - MAX;
  }
  return `<div class="msgs">${shown
    .map((it, idx) => {
      const g = gap && idx === 12 ? `<div class="gap">${gap} earlier items are in the brief and the full transcript</div>` : '';
      if (it.kind === 'step') {
        const parts = [it.tools ? plural(it.tools, 'tool step') : '', it.thoughts ? plural(it.thoughts, 'reasoning note') : ''].filter(Boolean);
        return `${g}<div class="step">${parts.join(' · ')}</div>`;
      }
      const e = it.e;
      const long = e.text.length > 1400;
      const text = e.text.replace(/\s*\[cite:[^\]]*\]/g, '').replace(/\s*cite[\ue200-\ue2ff][^\s]*/g, '');
      const body = e.role === 'user' ? escapeHtml(text) : markdownToHtml(text);
      return `${g}<div class="msg ${e.role}${long ? ' clamp' : ''}"><div class="who">${e.role === 'user' ? 'You' : 'AI'}</div><div>${body}</div>${long ? '<button class="more" type="button">Show more</button>' : ''}</div>`;
    })
    .join('')}</div>`;
}

export function handoffPage(p: HandoffPageInput): string {
  const b = p.bundle;
  const s = b.stats;
  const a = s.artifacts;
  const filesOk = a.recovered + a.attached;
  const lostFiles = a.lost + a.stale;
  const src = sourceKey(b.source.tool);
  const prompt = continuePrompt(b.title, p.selfUrl, b.source.tool);
  const q = encodeURIComponent(prompt);
  const brief = aiBrief(b, p.files);
  const losses = b.loss.filter((l) => l.severity !== 'info');
  const md = `${p.selfUrl}.md`;
  const hrefFor: Record<string, string> = { claude: `https://claude.ai/new?q=${q}`, chatgpt: `https://chatgpt.com/?q=${q}`, gemini: 'https://gemini.google.com/app' };

  const banner =
    p.banner === 'new'
      ? `<div class="banner" role="status"><div class="grow"><b>Your handoff link is ready.</b> <span class="mu">Send it anywhere, or pick an AI below.</span></div>
<div class="linkbox"><input id="lnk" readonly value="${escapeHtml(p.selfUrl)}" aria-label="Handoff link"><button class="btn dark sm" type="button" data-copy-link>Copy</button></div></div>`
      : p.banner === 'gemini'
        ? `<div class="banner" role="status"><div class="grow"><b>One more tap for Gemini.</b> <span class="mu">Gemini can't be pre-filled, so Baton copies the prompt for you. Then paste it with Ctrl/⌘ V.</span></div>
<button class="btn primary" type="button" data-dest="gemini"><span class="dot" style="background:#4F7DF3"></span>Copy &amp; open Gemini</button></div>`
        : '';

  const files = b.artifacts.length
    ? `<div class="card list">${b.artifacts
        .map((f) => {
          const chip = f.status === 'recovered' || f.status === 'attached' ? `<span class="chip ok">${f.status}</span>` : `<span class="chip bad">${f.status}</span>`;
          return `<div class="row"><span class="path">${escapeHtml(f.path)}</span><span class="mu code">${f.bytes ? fmtBytes(f.bytes) : ''}</span>${chip}</div>`;
        })
        .join('')}</div><p class="mu" style="margin-top:12px">Recovered files are inside the <a href="${escapeHtml(p.selfUrl)}.zip">bundle (.zip)</a> and inlined in the brief.</p>`
    : '<div class="card empty">No files in this conversation.</div>';

  const missing = losses.length
    ? `<div class="card list">${losses
        .map((l) => `<div class="row"><span class="chip ${l.severity === 'high' ? 'bad' : ''}"><b>${l.count}</b></span><div class="detail"><b>${escapeHtml(l.category.replace(/-/g, ' '))}</b><div class="mu">${escapeHtml(l.detail ?? '')}</div></div></div>`)
        .join('')}</div><p class="mu" style="margin-top:12px">Baton never fakes what it couldn't carry. The next AI is told exactly what's missing.</p>`
    : '<div class="card empty">Nothing known to be missing.</div>';

  const body = `<main class="wrap narrow hp">
${banner}
<article class="brief-first">
<div class="meta"><span class="src"><span class="dot" style="background:${SOURCE_DOT[src] ?? 'var(--mu)'}"></span>From ${escapeHtml(b.source.tool)}</span><span class="mu">·</span><span class="mu">${escapeHtml(expiryText(p.expiresAt))}</span></div>
<h1 class="t">${escapeHtml(b.title)}</h1>
<div class="chips"><span class="chip"><b>${s.userMessages}</b> ${s.userMessages === 1 ? 'prompt' : 'prompts'}</span><span class="chip"><b>${s.assistantMessages}</b> ${s.assistantMessages === 1 ? 'reply' : 'replies'}</span>${s.toolCalls ? `<span class="chip"><b>${s.toolCalls}</b> tool steps</span>` : ''}${filesOk ? `<span class="chip ok"><b>${filesOk}</b> ${filesOk === 1 ? 'file' : 'files'}</span>` : ''}${lostFiles ? `<span class="chip bad"><b>${lostFiles}</b> not recoverable</span>` : ''}</div>
<section class="card go" aria-labelledby="go-h"><h2 id="go-h">Continue in</h2>
<div class="go-grid">${DESTINATIONS.map((d) => `<a class="btn" data-dest="${d.id}" href="${escapeHtml(hrefFor[d.id])}" target="_blank" rel="noopener"><span class="dot" style="background:${d.dot}"></span>${d.name}</a>`).join('')}</div>
<div class="go-more"><button class="btn ghost sm" type="button" data-copy-prompt>Copy prompt for any AI</button><button class="btn ghost sm" type="button" data-copy-link>Copy link</button><a class="btn ghost sm" href="${escapeHtml(p.selfUrl)}.zip">Download .zip</a></div></section>
<p class="ai-note">For AI assistants: the complete brief is below and as plain text at <a href="${escapeHtml(md)}">${escapeHtml(md)}</a>.</p>
<div class="tabs">
<input class="sr" type="radio" name="tab" id="t-conv" checked><input class="sr" type="radio" name="tab" id="t-brief"><input class="sr" type="radio" name="tab" id="t-files"><input class="sr" type="radio" name="tab" id="t-miss">
<div class="tabbar" role="presentation"><label for="t-conv">Conversation</label><label for="t-brief">Brief for AI</label><label for="t-files">Files${b.artifacts.length ? ` · ${b.artifacts.length}` : ''}</label><label for="t-miss">Missing${losses.length ? ` · ${losses.length}` : ''}</label></div>
<div class="panels">
<section class="panel p-brief" aria-label="Brief for AI"><div class="card"><pre class="brief">${escapeHtml(brief)}</pre></div></section>
<section class="panel p-conv" aria-label="Conversation">${conversationHtml(b.events)}<p class="mu" style="margin-top:18px;text-align:center"><a href="${escapeHtml(p.selfUrl)}/full">Full transcript with tool steps →</a></p></section>
<section class="panel p-files" aria-label="Files">${files}</section>
<section class="panel p-miss" aria-label="What did not transfer">${missing}</section>
</div></div>
</article>
${p.owner ? `<form class="owner" method="post" action="/h/${escapeHtml(p.code)}/delete"><span>You created this link.</span><button type="submit">Delete it now</button></form>` : ''}
<aside class="cta"><div>${markSvg(48)}</div><div class="grow"><h3>Move your own chats.</h3><p>Free, no account. One bookmark works in ChatGPT, Claude and Gemini.</p></div><a class="btn primary" href="/">Get Baton</a></aside>
</main>`;

  const script = `
const P=${JSON.stringify(prompt).replace(/</g, '\\u003c')},L=${JSON.stringify(p.selfUrl).replace(/</g, '\\u003c')};
let last='';try{last=localStorage.getItem('baton:dest')||''}catch{}
$$('[data-dest]').forEach(el=>{if(el.dataset.dest===last&&el.closest('.go-grid'))el.classList.add('last');el.addEventListener('click',async ev=>{const d=el.dataset.dest;try{localStorage.setItem('baton:dest',d)}catch{}
 if(d==='gemini'){ev.preventDefault();await copy(P);toast('Prompt copied. Paste it in Gemini');window.open('https://gemini.google.com/app','_blank','noopener')}})});
$$('[data-copy-prompt]').forEach(el=>el.onclick=async()=>toast(await copy(P)?'Prompt copied. Paste it into any AI':'Copy blocked. Open the Brief tab and copy from there'));
$$('[data-copy-link]').forEach(el=>el.onclick=async()=>toast(await copy(L)?'Link copied':'Copy blocked'));
$$('.more').forEach(el=>el.onclick=()=>{const m=el.closest('.msg');m.classList.toggle('clamp');el.textContent=m.classList.contains('clamp')?'Show more':'Show less'});
const lnk=$('#lnk');if(lnk){lnk.onfocus=()=>lnk.select();copy(L).then(ok=>ok&&toast('Link copied'))}
if(location.search)history.replaceState(null,'',location.pathname+location.hash);
`;
  return shell({
    title: `${b.title} · Baton`,
    description: truncate(`A Baton handoff from ${b.source.tool}: ${s.userMessages} prompts, ${s.assistantMessages} replies${filesOk ? `, ${filesOk} files` : ''}. Open it to continue in Claude, ChatGPT or Gemini.`, 200),
    body,
    css: CSS,
    script,
    robots: 'noindex',
    head: `<link rel="alternate" type="text/markdown" href="${escapeHtml(md)}">`,
    ogImage: p.ogImage,
  });
}
