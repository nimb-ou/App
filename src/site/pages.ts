// Small pages in the Baton shell: privacy notes and the generic message page (errors, not found, deleted).

import { escapeHtml } from '../core/util.ts';
import { BRAND, shell } from './brand.ts';

const CSS = `.msg-page{padding:72px 0 0}.msg-page h1{font-size:clamp(34px,6vw,56px);margin-bottom:16px}.msg-page .lede{margin-bottom:28px}
.prose{padding:56px 0 0}.prose h1{font-size:clamp(36px,6vw,60px);margin-bottom:12px}.prose h2{font-size:24px;margin:40px 0 10px}.prose p,.prose li{color:var(--ink-2);font-size:17px}.prose p{margin:0 0 12px}.prose ul{padding-left:20px}.prose li{margin:6px 0}.prose code{font:14px var(--f-mono);background:var(--sunk);padding:2px 6px;border-radius:6px}`;

export function messagePage(title: string, text: string, action: { href: string; label: string } = { href: '/', label: 'Back to Baton' }): string {
  return shell({
    title: `${title} · Baton`,
    robots: 'noindex',
    css: CSS,
    body: `<main class="wrap narrow msg-page"><div class="eyebrow">Baton</div><h1 style="margin-top:12px">${escapeHtml(title)}</h1><p class="lede">${escapeHtml(text)}</p><a class="btn dark" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a></main>`,
  });
}

export function privacyPage(ttlDays: number): string {
  return shell({
    title: 'Privacy · Baton',
    css: CSS,
    body: `<main class="wrap narrow prose"><div class="eyebrow">Privacy</div><h1 style="margin-top:12px">What happens to your chat</h1>
<p class="lede">Plain answers, no legalese. Baton is open source, so every claim here can be checked in <a href="${BRAND.repo}">the code</a>.</p>
<h2>When you click the bookmark</h2>
<ul><li>Baton reads the chat in your own browser tab, using the session you're already signed in with. Nothing leaves the page while the chooser is open.</li>
<li>When you pick a destination, the chat is sent to this Baton server, and nowhere else.</li>
<li>The server turns it into a handoff and gives it a random link (<code>BTN-XXXX-XXXX-XXXX</code>, 60 random bits).</li></ul>
<h2>Who can see a handoff</h2>
<ul><li>Anyone who has the link, including the AI you send it to. Links are not listed or indexed (<code>noindex</code>).</li>
<li>Treat a link like the chat itself. Don't share it if the chat holds something you wouldn't share.</li></ul>
<h2>How long it lasts</h2>
<ul><li>Handoffs delete themselves after ${ttlDays} days.</li>
<li>The browser that created a handoff gets one cookie for it, which lets you delete it early with "Delete it now". That cookie is the only one Baton sets.</li></ul>
<h2>What Baton does not do</h2>
<ul><li>No accounts, ads, analytics or third-party scripts. Pages load only from this server.</li>
<li>No selling or training on your chats.</li>
<li>Obvious secrets (API keys, tokens) are redacted from handoffs automatically, but check before sharing.</li></ul>
<h2>Want full control?</h2>
<p>Run your own Baton server for free on Cloudflare with one command. The bookmark then talks only to your server. See <a href="${BRAND.repo}/blob/claude/laughing-davinci-c048d8/docs/DEPLOY.md">the deploy guide</a>.</p>
</main>`,
  });
}
