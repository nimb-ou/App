// Bookmarklet capture: the user's own browser reads the conversation (ChatGPT blocks servers, not users) and
// hands it to the relay. This file holds the server-side parsing and the two small pieces of browser code.

import { buildBundle } from '../core/build.ts';
import type { BatonBundle, ParsedConversation } from '../core/schema.ts';
import { parseChatGPTConversation, parseChatGPTShareHtml } from '../parsers/chatgpt.ts';
import { parseClaudeExport } from '../parsers/claude.ts';
import { parseMessagesLog } from '../parsers/generic.ts';
import { detectFormat, parseAny } from '../parsers/detect.ts';
import { parsePastedChat } from '../parsers/pasted.ts';
import { markSvg, TOKENS } from '../site/brand.ts';

export type IngestSource = 'chatgpt-share-html' | 'chatgpt-conversation' | 'claude-conversation' | 'messages';

export interface IngestBody {
  source: IngestSource;
  payload: unknown;
  url?: string;
}

export function ingestToBundle(b: IngestBody): BatonBundle {
  let parsed: ParsedConversation;
  switch (b.source) {
    case 'chatgpt-share-html':
      parsed = parseChatGPTShareHtml(String(b.payload), b.url);
      break;
    case 'chatgpt-conversation':
      parsed = parseChatGPTConversation(b.payload as Record<string, unknown>, { kind: 'chatgpt-export', url: b.url });
      parsed.source.tool = 'ChatGPT (captured in your browser)';
      break;
    case 'claude-conversation': {
      const [c] = parseClaudeExport([b.payload]);
      if (!c) throw new Error('That does not look like a Claude conversation');
      parsed = { ...c, source: { ...c.source, tool: 'Claude (captured in your browser)', url: b.url }, loss: (c.loss ?? []).filter((l) => l.category !== 'memory') };
      break;
    }
    case 'messages':
      parsed = parseMessagesLog(b.payload, 'Conversation');
      parsed.source = { ...parsed.source, tool: hostLabel(b.url), url: b.url };
      parsed.loss = [{ category: 'dom-capture', count: parsed.events.length, severity: 'warn', detail: 'Captured from the rendered page: visible text and code only. Tool outputs, files and hidden reasoning are not in the page.' }];
      break;
    default:
      throw new Error(`Unknown source ${String((b as { source?: string }).source)}`);
  }
  if (!parsed.events.some((e) => e.kind === 'message')) throw new Error('No conversation found on that page. Open a chat with at least one message and try again.');
  return buildBundle(parsed).bundle;
}

/** Text from the paste box: an export or share-page file if it is one, otherwise pasted chat text. */
export function pasteToBundle(text: string, filename = ''): BatonBundle {
  if (!text.trim()) throw new Error('Paste a conversation first.');
  if (/^\s*https?:\/\/\S+\s*$/.test(text)) {
    const share = /chatgpt\.com\/share|chat\.openai\.com\/share|claude\.ai\/share|gemini\.google\.com\/share|g\.co\/gemini/i.test(text);
    throw new Error(share
      ? "That's a share link, not the chat itself. AI sites block servers from opening share links, so: open the link, select all, copy, and paste here (or click the Baton bookmark on that page)."
      : "That's a link, not a conversation. Open it, select all, copy, and paste the text here.");
  }
  if (detectFormat(text, filename).kind !== 'unknown') {
    const list = parseAny(text, filename);
    if (!list.length) throw new Error('That file has no conversations in it.');
    const latest = [...list].sort((a, b) => Date.parse(b.source.updatedAt ?? '') - Date.parse(a.source.updatedAt ?? '') || 0)[0];
    return buildBundle(latest).bundle;
  }
  return buildBundle(parsePastedChat(text)).bundle;
}

function hostLabel(url?: string): string {
  const u = url ? new URL(url) : undefined;
  const h = u?.hostname ?? '';
  if (u?.pathname === '/try') return 'Baton practice page (a copy of a ChatGPT chat)';
  if (h.includes('gemini.google')) return 'Gemini (captured in your browser)';
  if (h.includes('perplexity')) return 'Perplexity (captured in your browser)';
  if (h.includes('copilot')) return 'Copilot (captured in your browser)';
  return `${h || 'Web chat'} (captured in your browser)`;
}

/** What the bookmarklet captured in the page (raw, before parsing). */
export interface Capture {
  url: string;
  title?: string;
  html?: string;
  chatgpt?: unknown;
  claude?: unknown;
  messages?: { role: string; content: string }[];
  error?: string;
  to?: string; // where the user chose to continue: claude | chatgpt | gemini | link
  v?: number;
}

/** Turn a raw capture into an ingest request. Throws a user-facing message when nothing usable was captured. */
export function captureToIngest(d: Capture): IngestBody {
  if (!d || typeof d !== 'object' || typeof d.url !== 'string') throw new Error('Nothing was captured.');
  if (d.error) throw new Error(`Could not read the chat: ${d.error}`);
  if (d.chatgpt) return { source: 'chatgpt-conversation', payload: d.chatgpt, url: d.url };
  if (d.claude) return { source: 'claude-conversation', payload: d.claude, url: d.url };
  if (d.html && /(chatgpt\.com|chat\.openai\.com)\/share\//.test(d.url)) return { source: 'chatgpt-share-html', payload: d.html, url: d.url };
  if (d.messages?.length) {
    const title = String(d.title ?? '').replace(/\s*·\s*Baton$/, '').replace(/\s*[-|–—]\s*(Google )?(Gemini|ChatGPT|Claude|Perplexity|Copilot).*$/i, '').trim();
    return { source: 'messages', payload: { title: title || undefined, messages: d.messages }, url: d.url };
  }
  throw new Error('No conversation found on that page. Open a chat with at least one message and try again.');
}

export function isCapture(x: unknown): x is Capture {
  return !!x && typeof x === 'object' && typeof (x as Capture).url === 'string' && !('source' in (x as object));
}

/** Bookmarklet version. Pages can tell an old bookmark from a new one (the capture carries `v`). */
export const BOOKMARKLET_VERSION = 2;

// The bookmarklet body, kept as plain JS. String.raw keeps regex backslashes intact; __RELAY__ is filled in below.
// Flow: start reading the chat at once, show a small chooser (Claude / ChatGPT / Gemini / link) in a closed shadow
// root, and on a choice open a tab synchronously (keeps user activation), then send the capture to the relay.
// Transport by real site headers (docs/journal/08): form POST into the tab (works under COOP same-origin, e.g.
// claude.ai); Gemini restricts form-action, so there the tab loads /receive and gets the data by postMessage.
// Built with createElement/textContent only (Gemini enforces Trusted Types) and CSSOM styles (immune to style-src).
const BOOKMARKLET_JS = String.raw`(()=>{const R='__RELAY__',V=__V__,H=location.host,P=location.pathname;
if(window.__batonOpen){window.__batonOpen();return}window.__batonOpen=()=>{};
const d={url:location.href,title:document.title,v:V};let info='';
const dom=()=>{const S=[['user-query','model-response','.query-text','message-content'],['[data-message-author-role="user"]','[data-message-author-role="assistant"]'],['[data-testid="user-message"]','.font-claude-response, .font-claude-message']];
for(const[u,a,ut,at]of S){const all=[...document.querySelectorAll(u+', '+a)],ns=all.filter(n=>!all.some(o=>o!==n&&o.contains(n)));
const m=ns.map(n=>{const U=n.matches(u),sel=U?ut:at,src=(sel&&n.querySelector(sel))||n,c=src.cloneNode(true);c.querySelectorAll('button,svg,[aria-hidden="true"],style,script,.sr-only,.cdk-visually-hidden,.visually-hidden').forEach(x=>x.remove());return{role:U?'user':'assistant',content:(c.innerText||c.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}}).filter(t=>t.content);
if(m.length)return m}return null};
const cap=(async()=>{try{
if(/\/share\//.test(P)&&/chatgpt\.com|openai\.com/.test(H)){d.html=document.documentElement.outerHTML;info='Shared ChatGPT chat, with recoverable files'}
else if(/chatgpt\.com|chat\.openai\.com/.test(H)&&/\/c\//.test(P)){const id=(P.match(/\/c\/([0-9a-f-]{20,})/)||[])[1];const s=await(await fetch('/api/auth/session')).json();const h={authorization:'Bearer '+s.accessToken};const a=(document.cookie.match(/(?:^|; )_account=([^;]+)/)||[])[1];if(a)h['chatgpt-account-id']=decodeURIComponent(a);const r=await fetch('/backend-api/conversation/'+id,{headers:h});if(r.ok){d.chatgpt=await r.json();info='Full conversation, including tool outputs'}else d.messages=dom()}
else if(H==='claude.ai'&&/\/chat\//.test(P)){const id=(P.match(/\/chat\/([0-9a-f-]{20,})/)||[])[1];const o=await(await fetch('/api/organizations')).json();const g=(o.find(x=>(x.capabilities||[]).includes('chat'))||o[0]).uuid;const r=await fetch('/api/organizations/'+g+'/chat_conversations/'+id+'?tree=True&rendering_mode=messages&render_all_tools=true');if(r.ok){d.claude=await r.json();info=(d.claude.chat_messages||[]).length+' messages, including artifacts'}else d.messages=dom()}
else{d.messages=dom()}
if(d.messages&&!info)info=d.messages.length+' messages (visible text)';
if(!d.html&&!d.chatgpt&&!d.claude&&!d.messages)throw new Error('No conversation found on this page')
}catch(e){d.error=String(e&&e.message||e)}})();
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.style.cssText=c;if(x!=null)e.textContent=x;return e};
const NS='http://www.w3.org/2000/svg',S=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e};
const host=E('div','all:initial;position:fixed;top:14px;right:14px;z-index:2147483647'),root=host.attachShadow({mode:'closed'});
const card=E('div','box-sizing:border-box;width:304px;max-width:calc(100vw - 28px);background:#121314;color:#F5F2EA;border-radius:20px;padding:16px 16px 14px;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;box-shadow:0 24px 60px -12px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)');
card.setAttribute('role','dialog');card.setAttribute('aria-label','Baton');
const hd=E('div','display:flex;align-items:center;gap:10px;margin-bottom:12px'),mk=S('svg',{viewBox:'0 0 32 32',width:'26',height:'26'});
mk.append(S('rect',{x:'8.6',y:'12.9',width:'17.4',height:'6.6',rx:'3.3',transform:'rotate(-38 17.3 16.2)',fill:'#FF5A1F'}),S('path',{d:'M6.2 24.6l3.4-2.7M5.6 19.4l2.3-1.8',stroke:'#FF5A1F','stroke-width':'2.1','stroke-linecap':'round',opacity:'.55',fill:'none'}));
const x=E('button','all:unset;cursor:pointer;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;color:#9C988F;font-size:20px','×');x.setAttribute('aria-label','Close');
hd.append(mk,E('div','flex:1;font-weight:800;font-size:16px;letter-spacing:-.01em','Continue this chat in'),x);
const grid=E('div','display:grid;gap:8px'),st=E('div','margin-top:12px;color:#9C988F;font-size:12.5px','Reading this chat…');
const here=/claude\.ai$/.test(H)?'claude':/chatgpt\.com|openai\.com/.test(H)?'chatgpt':/gemini\.google/.test(H)?'gemini':'',bs=[];
[['claude','Claude','#D97757'],['chatgpt','ChatGPT','#10A37F'],['gemini','Gemini','#4F7DF3'],['link','Just give me a link','']].forEach(([id,name,dot],i)=>{if(id===here)name+=' (fresh chat)';
const b=E('button','all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border-radius:12px;border:1px solid #2A2C2F;font-weight:650;font-size:15px;color:#F5F2EA;background:'+(dot?'#1E2022':'transparent'));
if(dot)b.append(E('span','width:10px;height:10px;border-radius:50%;background:'+dot));
b.append(E('span','flex:1',name),E('span','color:#6B675F;font:600 11px ui-monospace,Menlo,monospace;border:1px solid #2A2C2F;border-radius:5px;padding:1px 5px',String(i+1)));bs.push(b);
b.onmouseenter=b.onfocus=()=>b.style.borderColor='#FF5A1F';b.onmouseleave=b.onblur=()=>b.style.borderColor='#2A2C2F';b.onclick=()=>go(id);grid.append(b)});
card.append(hd,grid,st);root.append(card);document.documentElement.append(host);
cap.then(()=>{st.textContent=d.error?'⚠ '+d.error:'✓ '+info+'. Nothing is sent until you choose.'});
const esc=e=>{if(e.key==='Escape')close();else if(/^[1-4]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA/.test((document.activeElement||{}).tagName||'')&&!(document.activeElement||{}).isContentEditable){e.preventDefault();e.stopPropagation();bs[+e.key-1].click()}};setTimeout(()=>bs[0].focus(),30);const close=()=>{host.remove();removeEventListener('keydown',esc,true);window.__batonOpen=null};
addEventListener('keydown',esc,true);x.onclick=close;let busy=0;
const go=async to=>{if(busy)return;busy=1;const N='baton'+Date.now(),w=window.open('about:blank',N);
if(!w){st.textContent='Pop-up blocked. Allow pop-ups for this site, then click again.';busy=0;return}
try{w.document.title='Baton';const b=w.document.body;b.style.cssText='margin:0;height:100vh;display:grid;place-items:center;background:#F5F2EA;color:#121314;font:600 18px -apple-system,"Segoe UI",Inter,Roboto,Arial,sans-serif';b.textContent='Baton is packing your chat…'}catch(_){}
st.textContent='Packing…';await cap;
if(d.error){try{w.close()}catch(_){}st.textContent='⚠ '+d.error;busy=0;return}
d.to=to;const pop=()=>{const f=e=>{if(e.origin===R&&e.data==='baton:ready'){e.source.postMessage(d,R);removeEventListener('message',f)}};addEventListener('message',f);w.location.href=R+'/receive'};
if(/(^|\.)gemini\.google\.com$/.test(H))pop();else{let done=0;const v=e=>{if(!done&&/form-action/.test(e.violatedDirective||e.effectiveDirective)){done=1;pop()}};addEventListener('securitypolicyviolation',v);
const F=E('form','display:none');F.method='POST';F.action=R+'/api/ingest-form';F.target=N;F.acceptCharset='utf-8';const t=E('textarea');t.name='d';t.value=JSON.stringify(d);F.append(t);document.documentElement.append(F);F.submit();F.remove();setTimeout(()=>removeEventListener('securitypolicyviolation',v),5000)}
st.textContent='✓ Opened in a new tab';setTimeout(close,1800)}})()`;

/** The bookmarklet URL for this relay. Nothing is sent anywhere except this relay, and only after the user picks. */
export function bookmarkletSource(relayOrigin: string): string {
  const code = BOOKMARKLET_JS.replace('__RELAY__', relayOrigin.replace(/[^A-Za-z0-9:/._-]/g, '')).replace('__V__', String(BOOKMARKLET_VERSION));
  return 'javascript:' + encodeURIComponent(code.replace(/\n/g, ''));
}

/** Popup page on the relay (Gemini path): receives the capture from the opener, uploads it, then goes where the user chose. */
export function receivePage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${TOKENS}main{min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center}.spin{width:44px;height:44px;margin:0 auto 18px;animation:sp 1.1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}#st{font:700 20px/1.4 var(--f-display)}#st.err{color:var(--bad)}#sub{margin-top:8px}</style></head>
<body><main><div><div class="spin">${markSvg(44)}</div><p id="st">Packing your chat…</p><p id="sub" class="mu">This takes a second.</p></div></main>
<script>
const st=document.getElementById('st'),sub=document.getElementById('sub');const fail=m=>{st.textContent=m;st.className='err';sub.innerHTML='<a href="/">Back to Baton</a>';document.querySelector('.spin').style.animation='none'};
if(!window.opener){fail('Open this from the Baton bookmark on a ChatGPT, Claude or Gemini chat.')}else{window.opener.postMessage('baton:ready','*')}
addEventListener('message',async e=>{if(e.source!==window.opener||!e.data||typeof e.data!=='object'||typeof e.data.url!=='string')return;
 try{const r=await fetch('/api/ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(e.data)});const j=await r.json();if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  if(!j.next||j.next===j.url)await Promise.race([navigator.clipboard.writeText(j.url).catch(()=>{}),new Promise(r=>setTimeout(r,800))]);location.replace(j.next||j.url)}catch(err){fail(err.message)}});
</script></body></html>`;
}
