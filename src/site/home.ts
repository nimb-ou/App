// Landing page: explain in five seconds, install in ten, and work on phones (paste) as well as desktops (bookmark).
// Every number on the page comes from the real demo bundle passed in, not from copy.

import type { BundleStats } from '../core/schema.ts';
import { escapeHtml } from '../core/util.ts';
import { BRAND, DESTINATIONS, markSvg, shell } from './brand.ts';

export interface HomeInput {
  base: string;
  bookmarklet: string;
  mcpDisplay: string;
  demo?: { stats: BundleStats; lostToolOutputs: number; title: string };
  ogImage?: string;
}

const CSS = `
.hero{padding:56px 0 40px}
.hero .wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
@media (max-width:900px){.hero .wrap{grid-template-columns:1fr;gap:36px}.hero{padding-top:32px}}
.hero h1 em{font-style:normal;color:var(--signal)}
.hero .lede{margin:22px 0 30px}
.get{display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px}
.bm{display:inline-flex;align-items:center;gap:12px;padding:14px 26px 14px 16px;border-radius:999px;background:var(--signal);color:var(--signal-ink);font:800 21px/1 var(--f-display);letter-spacing:-.02em;text-decoration:none;cursor:grab;box-shadow:0 10px 30px -10px color-mix(in srgb,var(--signal) 70%,transparent);transition:transform .15s}
.bm:hover{transform:translateY(-2px) rotate(-1deg)}.bm:active{cursor:grabbing}
.bm svg{border-radius:9px}
.hint{display:flex;align-items:center;gap:10px;margin-top:16px;font-size:15px;color:var(--mu)}
.hint kbd{font:600 12.5px var(--f-mono);padding:3px 7px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--ink-2)}
.hint .arrow{display:inline-block;animation:bob 1.6s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-5px)}}
.only-touch{display:none}
@media (pointer:coarse){.only-touch{display:revert}.only-fine{display:none!important}}
html.touch .only-touch{display:revert}html.touch .only-fine{display:none!important}
html.touch .btn.only-touch{display:inline-flex}@media (pointer:coarse){.btn.only-touch{display:inline-flex}}
.trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:28px;font-size:14px;color:var(--mu)}
.trust span::before{content:"✓ ";color:var(--ok);font-weight:800}
/* hero illustration: a chat leaves ChatGPT and lands in Claude as a Baton handoff */
.stage{position:relative;aspect-ratio:1/0.92;max-width:540px;width:100%;justify-self:center}
.win{position:absolute;width:74%;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}
.win .bar{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line);font:700 13px var(--f-body)}
.win .bar i{width:9px;height:9px;border-radius:50%}
.win .body{padding:14px;display:flex;flex-direction:column;gap:9px}
.b{height:11px;border-radius:7px;background:var(--sunk)}
.b.u{align-self:flex-end;width:58%;background:var(--ink);opacity:.85}
.b.s{width:44%}.b.m{width:76%}.b.l{width:90%}
.w1{left:0;top:0;transform:rotate(-3deg)}
.w2{right:0;bottom:0;transform:rotate(2deg);z-index:2}
.ho{display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;background:var(--signal-soft);border:1px solid color-mix(in srgb,var(--signal) 30%,transparent)}
.ho svg{flex:none;border-radius:8px}.ho b{display:block;font-size:13px;line-height:1.25}.ho span{font-size:12px;color:var(--ink-2)}
.ho span em{font-style:normal;font-weight:800;color:var(--signal)}
.w2 .ho,.w2 .b{animation:land 7s ease-in-out infinite both}
.w2 .ho{animation-delay:-3.4s}.w2 .b:nth-child(2){animation-delay:-3.2s}.w2 .b:nth-child(3){animation-delay:-3.05s}.w2 .b:nth-child(4){animation-delay:-2.9s}
@keyframes land{0%,30%{opacity:0;transform:translateY(8px)}40%,94%{opacity:1;transform:none}100%{opacity:0}}
.flying{position:absolute;left:24%;top:30%;width:92px;height:32px;z-index:3;animation:fly 7s cubic-bezier(.55,0,.25,1) -3.4s infinite both}
.flying .cap{width:100%;height:100%;border-radius:999px;background:var(--signal);box-shadow:0 14px 30px -8px color-mix(in srgb,var(--signal) 80%,transparent)}
@keyframes fly{0%,6%{transform:translate(0,0) rotate(-38deg) scale(.8);opacity:0}12%{opacity:1}30%{transform:translate(150px,150px) rotate(-38deg) scale(1);opacity:1}36%,100%{transform:translate(170px,170px) rotate(-38deg) scale(.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.flying{display:none}}
section{padding:76px 0 0}
.sec-h{max-width:720px;margin-bottom:34px}.sec-h p{margin-top:14px;font-size:18px;color:var(--ink-2)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:860px){.steps{grid-template-columns:1fr}}
.step{padding:24px;display:flex;flex-direction:column;gap:12px}
.step .n{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--signal);color:var(--signal-ink);font:800 16px var(--f-display)}
.step p{color:var(--ink-2)}
.mini{margin-top:auto;border-radius:14px;background:var(--sunk);padding:14px;min-height:150px;display:flex;flex-direction:column;justify-content:center;gap:8px}
.mini .barline{height:30px;border-radius:8px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;gap:8px;padding:0 10px;font-size:12.5px;color:var(--mu)}
.mini .pill{display:inline-flex;align-items:center;gap:6px;background:var(--signal);color:var(--signal-ink);border-radius:999px;padding:3px 10px;font-weight:800;font-size:12.5px}
.chooser{background:#121314;color:#F5F2EA;border-radius:14px;padding:12px;display:grid;gap:6px;font-size:13px;font-weight:650}
.chooser .o{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:9px;background:#1E2022;border:1px solid #2A2C2F}
.chooser .o.hl{border-color:#FF5A1F}
.chooser .o i{width:8px;height:8px;border-radius:50%}
.reply{background:var(--card);border:1px solid var(--line);border-radius:14px 14px 14px 4px;padding:12px;font-size:13.5px;color:var(--ink-2)}
.compare{width:100%;border-collapse:separate;border-spacing:0;font-size:15.5px}
.compare th,.compare td{padding:15px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.compare thead th{font:700 13px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}
.compare th.us,.compare td.us{background:color-mix(in srgb,var(--signal) 9%,transparent)}
.compare thead th.us{color:var(--signal);border-radius:14px 14px 0 0}
.compare tr:last-child td{border-bottom:0}
.y{color:var(--ok);font-weight:800}.n{color:var(--bad);font-weight:800}.p{color:var(--warn);font-weight:700}
.tablewrap{overflow-x:auto;padding:6px}
.proof{margin-top:16px;font-size:15px;color:var(--mu)}
.where{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:860px){.where{grid-template-columns:1fr}}
.where .card{padding:24px}
.where h3{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.where h3 i{width:12px;height:12px;border-radius:50%}
.where ul{margin:0;padding-left:18px;color:var(--ink-2)}.where li{margin:4px 0}
.also{margin-top:14px;color:var(--mu);font-size:15px}
.paste{padding:26px}
.paste textarea{width:100%;min-height:190px;resize:vertical;font:14.5px/1.55 var(--f-mono);padding:16px;border-radius:14px;border:1.5px dashed var(--line);background:var(--paper);color:var(--ink)}
.paste textarea:focus{outline:none;border-color:var(--signal);border-style:solid}
.paste.drag textarea{border-color:var(--signal);background:var(--signal-soft)}
.paste .row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:14px}
.seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:999px;background:var(--sunk)}
.seg label{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;font-weight:700;font-size:14.5px;color:var(--mu);cursor:pointer}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg input:checked+label{background:var(--card);color:var(--ink);box-shadow:var(--shadow)}
.seg input:focus-visible+label{outline:3px solid var(--signal)}
.seg i{width:9px;height:9px;border-radius:50%}
.paste .grow{flex:1}
.paste .how{margin-top:16px;font-size:14.5px;color:var(--mu)}
.picker{margin-top:14px;display:none;max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:14px}
.picker.on{display:block}
.picker button{all:unset;box-sizing:border-box;display:flex;gap:12px;width:100%;padding:12px 16px;border-top:1px solid var(--line);cursor:pointer;font-weight:600}
.picker button:first-child{border-top:0}.picker button:hover,.picker button:focus-visible{background:var(--sunk)}
.picker small{margin-left:auto;color:var(--mu);font-weight:500}
.err{color:var(--bad);font-weight:600;margin-top:10px;min-height:1.4em}
.priv{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media (max-width:860px){.priv{grid-template-columns:1fr 1fr}}
@media (max-width:520px){.priv{grid-template-columns:1fr}}
.priv .card{padding:20px}.priv b{display:block;font:800 18px var(--f-display);margin-bottom:6px}.priv p{color:var(--ink-2);font-size:15px}
.power{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:860px){.power{grid-template-columns:1fr}}
.power .card{padding:22px}.power p{color:var(--ink-2);margin:8px 0 14px;font-size:15px}
.power code{font:13px var(--f-mono);background:var(--sunk);padding:2px 6px;border-radius:6px;overflow-wrap:anywhere}
.faq details{border-top:1px solid var(--line);padding:4px 0}
.faq details:last-child{border-bottom:1px solid var(--line)}
.faq summary{cursor:pointer;list-style:none;padding:16px 0;font:750 18px var(--f-display);display:flex;justify-content:space-between;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-weight:400;font-size:26px;line-height:.8;color:var(--mu)}
.faq details[open] summary::after{content:"–"}
.faq p{padding:0 0 18px;color:var(--ink-2);max-width:68ch}
.final{margin-top:90px;padding:48px 32px;text-align:center;background:var(--ink);color:var(--paper);border-radius:28px}
.final h2{margin-bottom:22px}.final .get{justify-content:center}
.final .mu{color:color-mix(in srgb,var(--paper) 65%,transparent);margin-top:16px}

dialog.sheet{border:0;padding:0;border-radius:24px;max-width:520px;width:calc(100vw - 32px);background:var(--card);color:var(--ink);box-shadow:0 30px 80px -20px rgba(0,0,0,.45)}
dialog.sheet::backdrop{background:rgba(18,19,20,.45);backdrop-filter:blur(3px)}
.sheet .in{padding:26px}
.sheet h2{font-size:28px;margin-bottom:6px}
.sheet .x{all:unset;cursor:pointer;position:absolute;top:14px;right:16px;font-size:24px;color:var(--mu);width:36px;height:36px;text-align:center;line-height:36px;border-radius:50%}
.sheet .x:hover{background:var(--sunk)}
.browser{margin:18px 0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--paper)}
.browser .tabs{height:26px;background:var(--sunk);display:flex;align-items:center;gap:6px;padding:0 10px}
.browser .tabs i{width:8px;height:8px;border-radius:50%;background:var(--line)}
.browser .bar{height:30px;display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid var(--line);font-size:11.5px;color:var(--mu);position:relative}
.browser .slot{width:70px;height:20px;border-radius:999px;border:1.5px dashed color-mix(in srgb,var(--signal) 60%,transparent)}
.browser .page{height:120px;position:relative}
.browser .pill{position:absolute;left:50%;top:62px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 6px;border-radius:999px;background:var(--signal);color:var(--signal-ink);font:800 12.5px var(--f-display);animation:drag 3.2s cubic-bezier(.6,0,.3,1) infinite;box-shadow:0 8px 20px -6px color-mix(in srgb,var(--signal) 80%,transparent)}
@keyframes drag{0%,15%{transform:translate(-50%,0)}55%,85%{transform:translate(-205px,-88px) scale(.92)}100%{transform:translate(-205px,-88px) scale(.92);opacity:0}}
.browser .cursor{position:absolute;left:calc(50% + 18px);top:76px;font-size:18px;animation:cur 3.2s cubic-bezier(.6,0,.3,1) infinite}
@keyframes cur{0%,15%{transform:none}55%,85%{transform:translate(-205px,-88px)}100%{transform:translate(-205px,-88px);opacity:0}}
.sheet ol{margin:0 0 18px;padding-left:22px}.sheet li{margin:7px 0;color:var(--ink-2)}
.sheet kbd{font:600 12.5px var(--f-mono);padding:2px 6px;border-radius:6px;border:1px solid var(--line);background:var(--paper)}
.sheet .acts{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
`;

export function homePage(h: HomeInput): string {
  const d = h.demo;
  const bm = escapeHtml(h.bookmarklet);
  const bmButton = `<a class="bm only-fine" href="${bm}" title="Drag me to your bookmarks bar" data-bm>${markSvg(34)}Baton</a>`;
  const filesRecovered = d ? d.stats.artifacts.recovered + d.stats.artifacts.attached : 0;
  const filesLost = d ? d.stats.artifacts.lost + d.stats.artifacts.stale : 0;

  const body = `<main>
<section class="hero" id="get" style="padding-top:56px"><div class="wrap">
<div>
<div class="eyebrow">Free · no account · works in your browser</div>
<h1 style="margin-top:16px">Move any AI chat to <em>any other AI.</em></h1>
<p class="lede">ChatGPT to Claude, Claude to Gemini, anything to anything. Baton carries your prompts, the answers, the code and files, and tells the next AI exactly what's missing.</p>
<div class="get">${bmButton}<a class="btn primary only-touch" href="#paste">Paste a chat</a><a class="btn ghost" href="/demo">See a live handoff</a></div>
<div class="hint only-fine"><span class="arrow">↑</span><span>Drag <b>Baton</b> to your bookmarks bar, then <a href="/try">try it on a practice chat</a>. No bar? Press <kbd data-kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>B</kbd></span></div>
<div class="hint only-touch"><span>On a computer, Baton is one bookmark. On a phone, select all in your AI app, copy, and paste it here.</span></div>
<div class="trust"><span>Nothing to install</span><span>Links expire in 7 days</span><span>Delete anytime</span><span>Open source</span></div>
</div>
<div class="stage" aria-hidden="true">
<div class="win w1"><div class="bar"><i style="background:#10A37F"></i>ChatGPT</div><div class="body"><div class="b u"></div><div class="b l"></div><div class="b m"></div><div class="b u" style="width:40%"></div><div class="b l"></div><div class="b s"></div><div class="b m"></div></div></div>
<div class="win w2"><div class="bar"><i style="background:#D97757"></i>Claude</div><div class="body"><div class="ho">${markSvg(30)}<div><b>Baton handoff from ChatGPT</b><span>${d ? `<em>${d.stats.userMessages}</em> prompts · <em>${d.stats.toolCalls}</em> tool steps · <em>${filesRecovered}</em> files` : 'prompts · answers · files'}</span></div></div><div class="b l"></div><div class="b m"></div><div class="b s"></div></div></div>
<div class="flying"><div class="cap"></div></div>
</div>
</div></section>

<section id="how"><div class="wrap">
<div class="sec-h"><div class="eyebrow">How it works</div><h2 style="margin-top:12px">Three steps. The first one you do once.</h2></div>
<div class="steps">
<div class="card step"><div class="n">1</div><h3>Add Baton to your bookmarks</h3><p>Drag the orange button to your bookmarks bar. No extension, no sign-up, no permissions.</p>
<div class="mini"><div class="barline"><span class="pill">${markSvg(14, { tile: false })}Baton</span><span>Docs</span><span>Mail</span></div><div class="mu" style="font-size:12.5px;text-align:center">Your bookmarks bar</div></div></div>
<div class="card step"><div class="n">2</div><h3>On any chat, click it</h3><p>Pick where to continue. Baton reads the chat with your own signed-in browser and packs it.</p>
<div class="mini"><div class="chooser"><div style="font-weight:800">Continue this chat in</div>${DESTINATIONS.map((x, i) => `<div class="o${i === 0 ? ' hl' : ''}"><i style="background:${x.dot}"></i>${x.name}</div>`).join('')}</div></div></div>
<div class="card step"><div class="n">3</div><h3>Keep going</h3><p>The new AI opens with the handoff ready. It reads where you left off and carries on.</p>
<div class="mini"><div class="reply"><b>Got it.</b> We stopped at the deployment step, and your files came across. Picking up from your last request…</div><div class="mu" style="font-size:12px;text-align:center">Example reply</div></div></div>
</div></div></section>

<section><div class="wrap">
<div class="sec-h"><div class="eyebrow">Why not just copy-paste?</div><h2 style="margin-top:12px">Copy-paste and share links leave the important parts behind.</h2></div>
<div class="card tablewrap"><table class="compare">
<thead><tr><th></th><th>Copy-paste</th><th>Share link</th><th class="us">Baton</th></tr></thead>
<tbody>
<tr><td>Your prompts and the replies</td><td class="p">Messy</td><td class="y">Yes</td><td class="us y">Yes, clean</td></tr>
<tr><td>Code and files the AI wrote</td><td class="p">What's on screen</td><td class="n">Dead links</td><td class="us y">Rebuilt from the chat</td></tr>
<tr><td>Tool outputs (code runs, searches)</td><td class="n">No</td><td class="n">Removed</td><td class="us y">Yes, in ChatGPT and Claude</td></tr>
<tr><td>Opens in a <i>different</i> AI</td><td class="p">By hand</td><td class="n">No</td><td class="us y">One click</td></tr>
<tr><td>Tells you what didn't make it</td><td class="n">No</td><td class="n">No</td><td class="us y">Always</td></tr>
</tbody></table></div>
${d ? `<p class="proof">Measured on a real ChatGPT chat (<a href="/demo">open it</a>): the share link carried <b>0 of ${d.lostToolOutputs}</b> tool outputs and only dead file links. Baton recovered <b>${filesRecovered} files</b> and listed the ${filesLost} it couldn't.</p>` : ''}
</div></section>

<section><div class="wrap">
<div class="sec-h"><div class="eyebrow">Where it works</div><h2 style="margin-top:12px">The big three, and almost any chat page.</h2></div>
<div class="where">
<div class="card"><h3><i style="background:#10A37F"></i>ChatGPT</h3><ul><li>Full conversation, including tool outputs and code</li><li>Shared chats, with the files rebuilt</li></ul></div>
<div class="card"><h3><i style="background:#D97757"></i>Claude</h3><ul><li>Full conversation, including artifacts and tool steps</li><li>Projects and long chats</li></ul></div>
<div class="card"><h3><i style="background:#4F7DF3"></i>Gemini</h3><ul><li>Every visible message and code block</li><li>Signed in or not</li></ul></div>
</div>
<p class="also">Also: Perplexity, Copilot, DeepSeek and other chat pages (visible messages), ChatGPT and Claude data exports, and anything you paste.</p>
</div></section>

<section id="paste"><div class="wrap narrow">
<div class="sec-h"><div class="eyebrow">On a phone, or no bookmark?</div><h2 style="margin-top:12px">Paste a chat instead.</h2><p>In your AI app: select all, copy, paste below. Or drop a ChatGPT or Claude export file.</p></div>
<form class="card paste" id="pf" autocomplete="off">
<label class="sr" for="pt">Conversation text</label>
<textarea id="pt" name="text" placeholder="You said:&#10;Help me plan a 3-day trip to Lisbon…&#10;&#10;ChatGPT said:&#10;Here's a plan…" required></textarea>
<div class="picker" id="pick" role="listbox" aria-label="Choose a conversation"></div>
<div class="row"><div class="seg" role="radiogroup" aria-label="Continue in">${[...DESTINATIONS.map((x) => ({ id: x.id, name: x.name, dot: x.dot })), { id: 'link', name: 'Link', dot: '' }]
    .map((x, i) => `<input type="radio" name="to" id="to-${x.id}" value="${x.id}"${i === 0 ? ' checked' : ''}><label for="to-${x.id}">${x.dot ? `<i style="background:${x.dot}"></i>` : ''}${x.name}</label>`)
    .join('')}</div><span class="grow"></span><button class="btn primary" id="pgo" type="submit">Make handoff</button></div>
<p class="err" id="perr" role="alert"></p>
<p class="how">Or drop a <span class="code">conversations.json</span> from a ChatGPT or Claude data export. Exports with many chats let you pick one.</p>
</form>
</div></section>

<section><div class="wrap">
<div class="sec-h"><div class="eyebrow">Privacy</div><h2 style="margin-top:12px">Your chat, your link, your call.</h2></div>
<div class="priv">
<div class="card"><b>Only here</b><p>Your chat goes only to this Baton server, and only after you choose where to send it.</p></div>
<div class="card"><b>Unguessable</b><p>Each link carries a random 60-bit code. Only people you give it to can open it.</p></div>
<div class="card"><b>Gone in 7 days</b><p>Links delete themselves. Delete yours sooner from the browser that made it.</p></div>
<div class="card"><b>No tracking</b><p>No accounts, ads, analytics or cookies beyond the one that lets you delete your link.</p></div>
</div>
<p class="also"><a href="/privacy">Read the full privacy notes →</a></p>
</div></section>

<section id="power"><div class="wrap">
<div class="sec-h"><div class="eyebrow">For power users and developers</div><h2 style="margin-top:12px">Go deeper.</h2></div>
<div class="power">
<div class="card"><h3>Browser extension</h3><p>Captures generated files as real bytes and attaches them in the next AI's composer for you.</p><a class="btn ghost sm" href="${BRAND.repo}/blob/claude/laughing-davinci-c048d8/docs/TESTING.md">Install guide</a></div>
<div class="card"><h3>Connector (MCP)</h3><p>Let a model write its own handoff and another model pick it up by code. Server: <code>${escapeHtml(h.base + h.mcpDisplay)}</code></p><a class="btn ghost sm" href="${BRAND.repo}/blob/claude/laughing-davinci-c048d8/docs/EMBED.md">Set up</a></div>
<div class="card"><h3>CLI and Claude Code</h3><p>Convert exports and share links offline, and snapshot Claude Code sessions before compaction.</p><a class="btn ghost sm" href="${BRAND.repo}">View on GitHub</a></div>
</div></div></section>

<section class="faq"><div class="wrap narrow">
<div class="sec-h"><div class="eyebrow">Questions</div><h2 style="margin-top:12px">Good questions.</h2></div>
<details><summary>Does the other AI need anything installed?</summary><p>No. Baton opens it with a short prompt and a link. Claude, ChatGPT and Gemini can read the link. If an AI can't browse, use "Copy prompt for any AI" on the handoff page, or paste the brief.</p></details>
<details><summary>Why a bookmark and not an app?</summary><p>Your browser can already see your chat, because you're signed in. A bookmark uses exactly that, with no install and no permissions to grant. ChatGPT blocks servers from reading chats but not you.</p></details>
<details><summary>What doesn't transfer?</summary><p>Hidden reasoning, and files that only existed inside the AI's sandbox and were never shown. Baton rebuilds what it can from the chat and lists everything else on the "Missing" tab, so the next AI doesn't assume it exists.</p></details>
<details><summary>Is it really free?</summary><p>Yes. No ads, no selling data, no account. Baton is open source, and you can run your own server with one command.</p></details>
<details><summary>Can I delete a link?</summary><p>Yes. Open it in the browser that created it and click "Delete it now". Every link also expires after 7 days.</p></details>
<details><summary>Does it work on my phone?</summary><p>Yes, by pasting: select all in your AI app, copy, and paste into the box above. Handoff links open on any device.</p></details>
</div></section>

<div class="wrap"><div class="final"><h2>Stop starting over.</h2><div class="get">${bmButton.replace('class="bm only-fine"', 'class="bm only-fine" style="box-shadow:none"')}<a class="btn primary only-touch" href="#paste">Paste a chat</a></div><p class="mu only-fine">Drag the button to your bookmarks bar, then click it on any chat.</p></div></div>
</main>
<dialog class="sheet" id="sheet" aria-labelledby="sheet-h"><div class="in"><button class="x" type="button" data-close aria-label="Close">×</button>
<div class="eyebrow">Add Baton · 10 seconds</div><h2 id="sheet-h" style="margin-top:10px">Drag, don't click.</h2><p class="mu">Baton lives in your bookmarks bar, so it's one click away on any chat.</p>
<div class="browser" aria-hidden="true"><div class="tabs"><i></i><i></i><i></i></div><div class="bar"><span class="slot"></span><span>Docs</span><span>Mail</span></div><div class="page"><span class="pill">${markSvg(16)}Baton</span><span class="cursor">✋</span></div></div>
<ol><li>Show your bookmarks bar: <kbd data-kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>B</kbd></li><li>Drag this button up into the bar: <a class="bm" href="${bm}" data-bm title="Drag me to your bookmarks bar" style="font-size:16px;padding:7px 15px 7px 7px;vertical-align:middle">${markSvg(24)}Baton</a></li><li>Open any chat and click it.</li></ol>
<div class="acts"><a class="btn primary" href="/try">Try it on a practice chat</a><button class="btn ghost" type="button" data-close>Done</button></div></div></dialog>
`;

  const script = `
if(!matchMedia('(pointer:fine)').matches&&(navigator.maxTouchPoints>0||'ontouchstart' in window))document.documentElement.classList.add('touch');
const mac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);$$('[data-kbd]').forEach(k=>k.textContent=mac?'⌘':'Ctrl');
const sheet=$('#sheet');$$('[data-bm]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(sheet.open)toast('Drag it up into your bookmarks bar');else sheet.showModal()}));
$$('[data-close]').forEach(b=>b.onclick=()=>sheet.close());sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
if(new URLSearchParams(location.search).has('deleted')){toast('Deleted. That link no longer works.');history.replaceState(null,'','/')}
const pf=$('#pf'),pt=$('#pt'),perr=$('#perr'),pick=$('#pick'),pgo=$('#pgo');let fileName='';
const send=async(text,name)=>{perr.textContent='';pgo.disabled=true;pgo.textContent='Packing…';
 try{const to=(pf.querySelector('input[name=to]:checked')||{}).value||'link';
  const r=await fetch('/api/paste',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,filename:name||'',to})});
  const j=await r.json();if(!r.ok)throw new Error(j.error||'Something went wrong');location.href=j.next}
 catch(e){perr.textContent=e.message;pgo.disabled=false;pgo.textContent='Make handoff'}};
pf.addEventListener('submit',e=>{e.preventDefault();if(pt.value.trim())send(pt.value,fileName)});
const showPicker=list=>{pick.innerHTML='';list.sort((a,b)=>(b.t||0)-(a.t||0)).forEach(c=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.append(c.title||'Untitled');const s=document.createElement('small');s.textContent=c.t?new Date(c.t*1000).toLocaleDateString():'';b.append(s);b.onclick=()=>send(JSON.stringify([c.raw]),fileName);pick.append(b)});pick.classList.add('on');perr.textContent='This export has '+list.length+' chats. Pick one:'};
const readFile=async f=>{fileName=f.name;if(/\\.zip$/i.test(f.name)){perr.textContent='Unzip the export first, then drop conversations.json.';return}
 if(f.size>200e6){perr.textContent='That file is too large.';return}
 const text=await f.text();
 if(/\\.json$/i.test(f.name)){try{const j=JSON.parse(text);if(Array.isArray(j)&&j.length>1&&(j[0].mapping||j[0].chat_messages)){showPicker(j.map(c=>({raw:c,title:c.title||c.name,t:c.update_time||(c.updated_at?Date.parse(c.updated_at)/1000:0)})));return}}catch{}}
 if(text.length>20e6){perr.textContent='That file is too large to send. Pick a single conversation.';return}
 pt.value=text.length>200000?text.slice(0,200000)+'\\n…':text;pt.dataset.full='1';send(text,f.name)};
['dragenter','dragover'].forEach(t=>pf.addEventListener(t,e=>{e.preventDefault();pf.classList.add('drag')}));
['dragleave','drop'].forEach(t=>pf.addEventListener(t,e=>{e.preventDefault();pf.classList.remove('drag')}));
pf.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)readFile(f)});
`;
  return shell({
    title: 'Baton · Move any AI chat to any other AI',
    description: 'Hand a chat from ChatGPT, Claude or Gemini to any other AI in one click, with the prompts, answers, code and files, and a list of anything that did not transfer. Free, no account.',
    body,
    css: CSS,
    script,
    canonical: h.base + '/',
    head: `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Baton', applicationCategory: 'ProductivityApplication', operatingSystem: 'Any (web browser)', description: 'Move any AI chat to any other AI: ChatGPT, Claude, Gemini.', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, url: h.base + '/' }).replace(/</g, '\\u003c')}</script>`,
    ogImage: h.ogImage,
  });
}
