// Bookmarklet capture: the user's own browser reads the conversation (ChatGPT blocks servers, not users) and
// hands it to the relay. This file holds the server-side parsing and the two small pieces of browser code.

import { buildBundle } from '../core/build.ts';
import type { BatonBundle, ParsedConversation } from '../core/schema.ts';
import { parseChatGPTConversation, parseChatGPTShareHtml } from '../parsers/chatgpt.ts';
import { parseClaudeExport } from '../parsers/claude.ts';
import { parseMessagesLog } from '../parsers/generic.ts';

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

function hostLabel(url?: string): string {
  const h = url ? new URL(url).hostname : '';
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
}

/** Turn a raw capture into an ingest request. Throws a user-facing message when nothing usable was captured. */
export function captureToIngest(d: Capture): IngestBody {
  if (!d || typeof d !== 'object' || typeof d.url !== 'string') throw new Error('Nothing was captured.');
  if (d.error) throw new Error(`Could not read the chat: ${d.error}`);
  if (d.chatgpt) return { source: 'chatgpt-conversation', payload: d.chatgpt, url: d.url };
  if (d.claude) return { source: 'claude-conversation', payload: d.claude, url: d.url };
  if (d.html && /(chatgpt\.com|chat\.openai\.com)\/share\//.test(d.url)) return { source: 'chatgpt-share-html', payload: d.html, url: d.url };
  if (d.messages?.length) {
    const title = String(d.title ?? '').replace(/\s*[-|–—]\s*(Google )?(Gemini|ChatGPT|Claude|Perplexity|Copilot).*$/i, '').trim();
    return { source: 'messages', payload: { title: title || undefined, messages: d.messages }, url: d.url };
  }
  throw new Error('No conversation found on that page. Open a chat with at least one message and try again.');
}

export function isCapture(x: unknown): x is Capture {
  return !!x && typeof x === 'object' && typeof (x as Capture).url === 'string' && !('source' in (x as object));
}

/**
 * The bookmarklet. Runs in the chat page with the user's own session and reads what the page itself can read.
 * Transport, chosen from the real headers of each site (docs/journal/08):
 *   1. Synchronously open a blank tab (keeps the click's user activation; about:blank is same-origin, so even
 *      COOP: same-origin on claude.ai keeps it).
 *   2. POST the capture into that tab with a plain form (works where CSP form-action allows https:, e.g. Claude,
 *      ChatGPT). The relay answers with a redirect to the Baton Link.
 *   3. If form-action blocks it (Gemini), navigate the tab to /receive and hand the data over with postMessage
 *      (Gemini and ChatGPT send COOP: same-origin-allow-popups, so the popup can talk back).
 * Nothing is sent anywhere except this relay. The live page is never modified (DOM reads use clones).
 */
export function bookmarkletSource(relayOrigin: string): string {
  const R = JSON.stringify(relayOrigin);
  const code = `(async()=>{const R=${R},N='baton'+Date.now(),w=window.open('about:blank',N);const d={url:location.href,title:document.title};
const dom=()=>{const S=[['user-query','model-response','.query-text','message-content'],['[data-message-author-role="user"]','[data-message-author-role="assistant"]'],['[data-testid="user-message"]','.font-claude-response, .font-claude-message']];
for(const[u,a,ut,at]of S){const all=[...document.querySelectorAll(u+', '+a)],ns=all.filter(n=>!all.some(o=>o!==n&&o.contains(n)));
const m=ns.map(n=>{const U=n.matches(u),sel=U?ut:at,src=(sel&&n.querySelector(sel))||n,c=src.cloneNode(true);c.querySelectorAll('button,svg,[aria-hidden="true"],style,script,.sr-only,.cdk-visually-hidden,.visually-hidden').forEach(x=>x.remove());return{role:U?'user':'assistant',content:(c.innerText||c.textContent||'').replace(/\\n{3,}/g,'\\n\\n').trim()}}).filter(t=>t.content);
if(m.length)return m}return null};
try{const p=location.pathname,h=location.host;
if(/\\/share\\//.test(p)&&/chatgpt\\.com|openai\\.com/.test(h)){d.html=document.documentElement.outerHTML}
else if(/chatgpt\\.com|chat\\.openai\\.com/.test(h)&&/\\/c\\//.test(p)){const id=(p.match(/\\/c\\/([0-9a-f-]{20,})/)||[])[1];const s=await(await fetch('/api/auth/session')).json();const H={authorization:'Bearer '+s.accessToken};const a=(document.cookie.match(/(?:^|; )_account=([^;]+)/)||[])[1];if(a)H['chatgpt-account-id']=decodeURIComponent(a);const r=await fetch('/backend-api/conversation/'+id,{headers:H});if(r.ok)d.chatgpt=await r.json();else d.messages=dom()}
else if(h==='claude.ai'&&/\\/chat\\//.test(p)){const id=(p.match(/\\/chat\\/([0-9a-f-]{20,})/)||[])[1];const o=await(await fetch('/api/organizations')).json();const g=(o.find(x=>(x.capabilities||[]).includes('chat'))||o[0]).uuid;const r=await fetch('/api/organizations/'+g+'/chat_conversations/'+id+'?tree=True&rendering_mode=messages&render_all_tools=true');if(r.ok)d.claude=await r.json();else d.messages=dom()}
else{d.messages=dom();if(!d.messages)throw'No conversation found on this page'}}catch(e){d.error=String(e)}
const viaPopup=()=>{const f=e=>{if(e.origin===R&&e.data==='baton:ready'){e.source.postMessage(d,R);removeEventListener('message',f)}};addEventListener('message',f);w.location.href=R+'/receive'};
if(/(^|\\.)gemini\\.google\\.com$/.test(location.host))return viaPopup();
let done=0;const v=e=>{if(!done&&/form-action/.test(e.violatedDirective||e.effectiveDirective)){done=1;viaPopup()}};addEventListener('securitypolicyviolation',v);
const F=document.createElement('form');F.method='POST';F.action=R+'/api/ingest-form';F.target=N;F.acceptCharset='utf-8';F.style.display='none';const t=document.createElement('textarea');t.name='d';t.value=JSON.stringify(d);F.appendChild(t);document.body.appendChild(F);F.submit();F.remove();
setTimeout(()=>removeEventListener('securitypolicyviolation',v),5000)})()`;
  return 'javascript:' + encodeURIComponent(code.replace(/\n/g, ''));
}

/** Popup page on the relay (Gemini path): receives the capture from the opener, uploads it, then shows the Baton Link. */
export function receivePage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton · receiving</title>
<style>:root{--bg:#f3f5f4;--fg:#14201b;--mu:#5b6b64;--bad:#b4271c}@media (prefers-color-scheme:dark){:root{--bg:#0f1513;--fg:#e4ebe7;--mu:#9aaba3;--bad:#f08b80}}
body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.55 system-ui,sans-serif}.w{max-width:560px;margin:0 auto;padding:60px 16px}h1{font-size:30px;margin:0 0 10px}#st{color:var(--mu)}#st.err{color:var(--bad)}</style></head>
<body><div class="w"><h1>Baton</h1><p id="st">Waiting for the conversation…</p></div>
<script>
const st=document.getElementById('st');const fail=m=>{st.textContent=m;st.className='err'};
if(!window.opener){fail('Open this from the Baton bookmark on a ChatGPT, Claude or Gemini chat.')}else{window.opener.postMessage('baton:ready','*')}
addEventListener('message',async e=>{if(e.source!==window.opener||!e.data||typeof e.data!=='object'||typeof e.data.url!=='string')return;
 st.textContent='Saving your handoff…';
 try{const r=await fetch('/api/ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(e.data)});const j=await r.json();if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  await Promise.race([navigator.clipboard.writeText(j.url).catch(()=>{}),new Promise(r=>setTimeout(r,800))]);location.replace(j.url)}catch(err){fail(err.message)}});
</script></body></html>`;
}
