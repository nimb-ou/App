// /try: a practice page for the bookmark. It shows the start of the real ChatGPT chat behind the demo, marked up the
// way ChatGPT marks its turns, so the real bookmark captures it exactly as it would on chatgpt.com. When the Baton
// panel appears, the page says so: the "it works" moment, before the user tries it on a private chat.

import type { BatonBundle } from '../core/schema.ts';
import { escapeHtml } from '../core/util.ts';
import { markdownToHtml } from '../render/mdlite.ts';
import { markSvg, shell } from './brand.ts';

const CSS = `
.try{padding-top:28px}
.coach{position:sticky;top:72px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;padding:16px 18px;border-radius:var(--r);background:var(--ink);color:var(--paper);box-shadow:var(--shadow);margin-bottom:28px}
.coach b{font-size:17px}.coach .grow{flex:1 1 260px}.coach .mu{color:color-mix(in srgb,var(--paper) 65%,transparent)}
.coach .up{font-size:26px;animation:bob 1.4s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-6px)}}
.coach.done{background:var(--ok);color:#fff}.coach.done .up{animation:none}
.bm{display:inline-flex;align-items:center;gap:10px;padding:10px 18px 10px 12px;border-radius:999px;background:var(--signal);color:var(--signal-ink);font:800 17px/1 var(--f-display);text-decoration:none;cursor:grab}
.chatbox{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden}
.chatbar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);font-weight:700;font-size:14px}
.chatbar i{width:9px;height:9px;border-radius:50%;background:#10A37F}
.chatbar .mu{font-weight:500;margin-left:auto;font-size:13px}
.turns{display:flex;flex-direction:column;gap:14px;padding:18px}
.turn{max-width:88%;padding:14px 16px;border-radius:18px;overflow-wrap:anywhere}
.turn.user{align-self:flex-end;background:var(--ink);color:var(--paper);border-bottom-right-radius:6px;white-space:pre-wrap}
.turn.assistant{align-self:flex-start;background:var(--sunk);border-bottom-left-radius:6px}
.turn p,.turn ul,.turn ol,.turn pre{margin:0 0 10px}.turn>:last-child{margin-bottom:0}
.turn pre{overflow:auto;font:13px var(--f-mono);background:var(--card);padding:10px;border-radius:10px}
.who{font:700 11.5px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:8px}
.note{margin-top:14px;font-size:14px;color:var(--mu)}
`;

export function tryPage(demo: BatonBundle | undefined, bookmarklet: string): string {
  const turns = (demo?.events ?? []).filter((e) => e.kind === 'message' && !e.hidden && (e.role === 'user' || e.role === 'assistant') && e.text.trim()).slice(0, 4);
  const body = `<main class="wrap narrow try">
<div class="eyebrow">Practice</div><h1 style="margin:12px 0 22px;font-size:clamp(34px,6vw,56px)">Try Baton on this chat.</h1>
<div class="coach" id="coach" role="status"><span class="up" aria-hidden="true">↑</span><div class="grow"><b id="coach-t">Click Baton in your bookmarks bar.</b><div class="mu" id="coach-s">Not there yet? Drag this button up first:</div></div><a class="bm" href="${escapeHtml(bookmarklet)}" data-bm>${markSvg(26)}Baton</a></div>
<div class="chatbox"><div class="chatbar"><i></i>${escapeHtml(demo?.title ?? 'Sample chat')}<span class="mu">Practice copy</span></div>
<div class="turns">${turns
    .map((e) => `<div class="turn ${e.role}" data-message-author-role="${e.role}"><div class="who" aria-hidden="true">${e.role === 'user' ? 'You' : 'ChatGPT'}</div>${e.role === 'user' ? escapeHtml(e.text) : markdownToHtml(e.text)}</div>`)
    .join('')}</div></div>
<p class="note">These are the first turns of a real ChatGPT chat (the one in the <a href="/demo">live demo</a>), shown here so you can practise without opening a private chat. Anything you send from this page creates a normal handoff link that expires in 7 days.</p>
</main>`;
  const script = `
$$('[data-bm]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();toast('Drag this button to your bookmarks bar, then click it there')}));
const coach=$('#coach');
new MutationObserver(()=>{const host=[...document.documentElement.children].find(el=>el.style&&el.style.zIndex==='2147483647');if(host&&!coach.classList.contains('done')){coach.classList.add('done');$('#coach-t').textContent='It works. That panel is Baton.';$('#coach-s').textContent='Pick an AI to see the whole flow, or press Esc. Then use it on your real chats.';coach.querySelector('.bm').remove();coach.querySelector('.up').textContent='✓'}}).observe(document.documentElement,{childList:true});
`;
  return shell({ title: `${demo?.title ?? 'Practice'} (practice) · Baton`, description: 'Practise using the Baton bookmark on a sample chat.', body, css: CSS, script, robots: 'noindex' });
}
