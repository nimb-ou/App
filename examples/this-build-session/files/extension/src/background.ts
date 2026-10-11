// Service worker: cross-origin byte fetches (signed file URLs), opening target tabs, relay uploads.

import { bytesToBase64 } from '../../src/core/util.ts';

declare const chrome: any;

const MAX = 50 * 1024 * 1024;

chrome.runtime.onMessage.addListener((msg: any, _sender: any, reply: (v: unknown) => void) => {
  (async () => {
    try {
      if (msg.type === 'baton:binary') {
        const res = await fetch(msg.url, { credentials: 'omit' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length > MAX) throw new Error('file larger than 50 MB');
        return reply({ ok: true, base64: bytesToBase64(buf), type: res.headers.get('content-type') ?? 'application/octet-stream', size: buf.length });
      }
      if (msg.type === 'baton:open') {
        await chrome.tabs.create({ url: msg.url, active: true });
        return reply({ ok: true });
      }
      if (msg.type === 'baton:relay') {
        const res = await fetch(msg.relay.replace(/\/$/, '') + '/api/handoffs', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(msg.token ? { authorization: `Bearer ${msg.token}` } : {}) },
          body: JSON.stringify(msg.body),
        });
        const out = await res.json();
        return reply(res.ok ? { ok: true, ...out } : { ok: false, error: out.error ?? `HTTP ${res.status}` });
      }
      reply({ ok: false, error: 'unknown message' });
    } catch (err) {
      reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true; // async reply
});

chrome.action.onClicked.addListener((tab: any) => {
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'baton:toggle' }).catch?.(() => {});
});

// Drop pending tab-to-tab handoffs older than an hour.
chrome.runtime.onStartup?.addListener(async () => {
  const all = await chrome.storage.local.get(null);
  const stale = Object.keys(all).filter((k) => k.startsWith('baton:pending:') && Date.now() - (all[k]?.createdAt ?? 0) > 3600000);
  if (stale.length) await chrome.storage.local.remove(stale);
});
