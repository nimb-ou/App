// Baton brand system: one place for the mark, colours, type and the page shell every relay page uses.
// Spec and rationale: docs/brand/BRAND.md. No web fonts, trackers or external requests: pages load from the relay only.

import { escapeHtml } from '../core/util.ts';

export const BRAND = {
  name: 'Baton',
  tagline: 'Hand any AI chat to any other AI.',
  repo: 'https://github.com/nimb-ou/App',
  ink: '#121314',
  paper: '#F5F2EA',
  signal: '#FF5A1F',
};

/** The mark: a baton mid-pass, with two motion strokes. Drawn on a 32-unit grid; works from 16px up. */
export function markSvg(size = 32, opts: { tile?: boolean; title?: string } = {}): string {
  const tile = opts.tile ?? true;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${escapeHtml(opts.title ?? 'Baton')}">${
    tile ? `<rect width="32" height="32" rx="9" fill="${BRAND.ink}"/>` : ''
  }<rect x="8.6" y="12.9" width="17.4" height="6.6" rx="3.3" transform="rotate(-38 17.3 16.2)" fill="${BRAND.signal}"/><path d="M6.2 24.6l3.4-2.7M5.6 19.4l2.3-1.8" stroke="${BRAND.signal}" stroke-width="2.1" stroke-linecap="round" opacity=".55"/></svg>`;
}

export const FAVICON_SVG = markSvg(32);

/** Destinations shown across the product. Colours are neutral identifiers, not the vendors' logos. */
export const DESTINATIONS = [
  { id: 'claude', name: 'Claude', dot: '#D97757' },
  { id: 'chatgpt', name: 'ChatGPT', dot: '#10A37F' },
  { id: 'gemini', name: 'Gemini', dot: '#4F7DF3' },
] as const;
export type DestinationId = (typeof DESTINATIONS)[number]['id'];

export const TOKENS = `
:root{
  --paper:#F5F2EA;--card:#FFFFFF;--sunk:#ECE7DC;--ink:#121314;--ink-2:#3A3A38;--mu:#6B675F;--line:#DED8CB;
  --signal:#FF5A1F;--signal-ink:#1C0A02;--signal-soft:#FFE6DA;--ok:#1E7A4C;--ok-soft:#DDF2E6;--bad:#B3261E;--bad-soft:#FBE3E1;--warn:#8A5A00;
  --r-sm:8px;--r:14px;--r-lg:22px;--shadow:0 1px 0 rgba(18,19,20,.04),0 8px 28px -12px rgba(18,19,20,.18);
  --f-display:ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"Segoe UI Variable Display","Segoe UI","Inter Display",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
  --f-body:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
  --f-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0E0F10;--card:#17181A;--sunk:#1E2022;--ink:#F3F0E8;--ink-2:#D2CFC7;--mu:#9C988F;--line:#2A2C2F;
  --signal:#FF6A33;--signal-ink:#1C0A02;--signal-soft:#3A1B0F;--ok:#5FC891;--ok-soft:#12291D;--bad:#F2887E;--bad-soft:#3A1715;--warn:#E8B44D;
  --shadow:0 1px 0 rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.7);color-scheme:dark}}
:root[data-theme="dark"]{
  --paper:#0E0F10;--card:#17181A;--sunk:#1E2022;--ink:#F3F0E8;--ink-2:#D2CFC7;--mu:#9C988F;--line:#2A2C2F;
  --signal:#FF6A33;--signal-ink:#1C0A02;--signal-soft:#3A1B0F;--ok:#5FC891;--ok-soft:#12291D;--bad:#F2887E;--bad-soft:#3A1715;--warn:#E8B44D;
  --shadow:0 1px 0 rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.7);color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 var(--f-body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-underline-offset:3px}
img,svg{display:block;max-width:100%}
:focus-visible{outline:3px solid var(--signal);outline-offset:2px;border-radius:6px}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
.narrow{max-width:760px}
h1,h2,h3{font-family:var(--f-display);line-height:1.05;letter-spacing:-.025em;margin:0;text-wrap:balance}
h1{font-size:clamp(40px,7.4vw,84px);font-weight:800}
h2{font-size:clamp(30px,4.6vw,52px);font-weight:800}
h3{font-size:20px;font-weight:750;letter-spacing:-.01em}
p{margin:0}
.lede{font-size:clamp(18px,2.1vw,22px);line-height:1.5;color:var(--ink-2);max-width:40ch;text-wrap:pretty}
.mu{color:var(--mu)}
.eyebrow{font:700 12.5px/1 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--mu)}
.code{font-family:var(--f-mono);font-size:.92em}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 22px;border-radius:999px;border:1.5px solid var(--ink);
  background:var(--card);color:var(--ink);font:700 16.5px/1 var(--f-body);text-decoration:none;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,background .12s}
.btn:hover{transform:translateY(-1px);box-shadow:var(--shadow)}
.btn:active{transform:translateY(0)}
.btn.primary{background:var(--signal);border-color:var(--signal);color:var(--signal-ink)}
.btn.dark{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.btn.ghost{border-color:var(--line);background:transparent}
.btn.sm{min-height:40px;padding:0 16px;font-size:14.5px}
.btn .dot{width:10px;height:10px;border-radius:50%;flex:none}
.chip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--sunk);font:600 13.5px/1.2 var(--f-body);color:var(--ink-2);white-space:nowrap}
.chip b{color:var(--ink);font-variant-numeric:tabular-nums}
.chip.bad{background:var(--bad-soft);color:var(--bad)}.chip.bad b{color:var(--bad)}
.chip.ok{background:var(--ok-soft);color:var(--ok)}.chip.ok b{color:var(--ok)}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow)}
.nav{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--paper) 86%,transparent);backdrop-filter:saturate(1.4) blur(10px);-webkit-backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid transparent}
.nav.scrolled{border-bottom-color:var(--line)}
.nav .wrap{display:flex;align-items:center;gap:22px;height:64px}
.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font:800 22px/1 var(--f-display);letter-spacing:-.03em}
.brand svg{border-radius:28%;box-shadow:0 0 0 1px color-mix(in srgb,var(--ink) 14%,transparent)}
.nav-links{display:flex;gap:22px;margin-left:auto;font-size:15px;font-weight:600}
.nav-links a{text-decoration:none;color:var(--ink-2)}.nav-links a:hover{color:var(--ink)}
@media (max-width:720px){.nav-links .hide-sm{display:none}}
.foot{border-top:1px solid var(--line);margin-top:96px;padding:36px 0 48px;color:var(--mu);font-size:14.5px}
.foot .wrap{display:flex;flex-wrap:wrap;gap:14px 28px;align-items:center}
.foot a{color:var(--ink-2);text-decoration:none}.foot a:hover{text-decoration:underline}
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:var(--ink);color:var(--paper);padding:12px 18px;border-radius:999px;font-weight:600;font-size:15px;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;z-index:50;max-width:calc(100vw - 32px)}
.toast.on{opacity:1;transform:translate(-50%,0)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

/** Shared client helpers: toast, copy, sticky-nav border. */
export const BASE_SCRIPT = `
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const toastEl=$('#toast');let toastT;const toast=m=>{toastEl.textContent=m;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('on'),2400)};
const copy=async s=>{try{await navigator.clipboard.writeText(s);return true}catch{const t=document.createElement('textarea');t.value=s;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();let ok=false;try{ok=document.execCommand('copy')}catch{}t.remove();return ok}};
const nav=$('.nav');if(nav){const f=()=>nav.classList.toggle('scrolled',scrollY>8);addEventListener('scroll',f,{passive:true});f()}
`;

export interface ShellInput {
  title: string;
  description?: string;
  body: string;
  script?: string;
  css?: string;
  canonical?: string;
  head?: string;
  nav?: boolean;
  robots?: string;
  ogImage?: string;
}

export function shell(p: ShellInput): string {
  const desc = p.description ?? BRAND.tagline;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(p.title)}</title><meta name="description" content="${escapeHtml(desc)}">
<meta name="theme-color" content="${BRAND.paper}" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0E0F10" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.png">
<meta property="og:title" content="${escapeHtml(p.title)}"><meta property="og:description" content="${escapeHtml(desc)}"><meta property="og:type" content="website">
${p.ogImage ? `<meta property="og:image" content="${escapeHtml(p.ogImage)}"><meta name="twitter:card" content="summary_large_image">` : ''}
${p.canonical ? `<link rel="canonical" href="${escapeHtml(p.canonical)}">` : ''}${p.robots ? `<meta name="robots" content="${p.robots}">` : ''}${p.head ?? ''}
<style>${TOKENS}${p.css ?? ''}</style></head><body>
${p.nav === false ? '' : navHtml()}
${p.body}
${footHtml()}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>${BASE_SCRIPT}${p.script ?? ''}</script></body></html>`;
}

export function navHtml(): string {
  return `<header class="nav"><div class="wrap"><a class="brand" href="/" aria-label="Baton home">${markSvg(30)}<span>baton</span></a>
<nav class="nav-links" aria-label="Main"><a class="hide-sm" href="/#how">How it works</a><a class="hide-sm" href="/demo">Live demo</a><a class="hide-sm" href="/privacy">Privacy</a><a href="/#get">Get Baton</a></nav></div></header>`;
}

export function footHtml(): string {
  return `<footer class="foot"><div class="wrap"><a class="brand" href="/" style="font-size:18px">${markSvg(22)}<span>baton</span></a>
<span>Free. No account. Links expire in 7 days.</span><a href="/privacy">Privacy</a><a href="${BRAND.repo}">Open source</a><a href="/#power">For developers</a></div></footer>`;
}

/** Security headers for the site's own pages (inline style/script only, same-origin forms and fetches). */
export const SITE_CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
