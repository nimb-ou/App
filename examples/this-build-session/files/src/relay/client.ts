// Send bundles to / pick up handoffs from a relay (remote URL) or the local store (~/.baton/store).

import type { BatonBundle } from '../core/schema.ts';
import { base64ToBytes, bytesToBase64 } from '../core/util.ts';
import { unzipStored, zip, type FileMap } from '../core/zip.ts';
import { renderBundleFiles } from '../render/files.ts';
import type { RelayRecord } from './checkpoint.ts';
import { renderRecord } from './checkpoint.ts';
import { parsePickup, seal, unseal } from './seal.ts';
import { RelayStore } from './store.ts';

export interface SendResult {
  code: string;
  link: string; // includes #key when sealed
  sealed: boolean;
  expiresAt?: string;
}

export function sealedPlaintext(bundle: BatonBundle, files: FileMap): Uint8Array {
  const prefixed: FileMap = {};
  for (const [k, v] of Object.entries(files)) prefixed[`${bundle.id}/${k}`] = v;
  return new TextEncoder().encode(JSON.stringify({ title: bundle.title, handoff: String(files['HANDOFF.md']), prompt: String(files['PROMPT.md']), zip: bytesToBase64(zip(prefixed)) }));
}

export async function sendBundle(bundle: BatonBundle, files: FileMap, opts: { relay?: string; token?: string; sealed?: boolean; from?: string; store?: RelayStore }): Promise<SendResult> {
  let body: Record<string, unknown> = { bundle, from: opts.from ?? 'cli' };
  let key: string | undefined;
  if (opts.sealed) {
    const s = await seal(sealedPlaintext(bundle, files));
    body = { sealed: s.sealed, title: bundle.title, from: opts.from ?? 'cli' };
    key = s.key;
  }
  if (!opts.relay) {
    const store = opts.store ?? new RelayStore();
    const rec = store.create({ title: bundle.title, from: String(body.from), bundle: body.bundle as BatonBundle | undefined, sealed: body.sealed as RelayRecord['sealed'] });
    return { code: rec.code, link: key ? `${rec.code}#${key}` : rec.code, sealed: !!key, expiresAt: rec.expiresAt };
  }
  const res = await fetch(opts.relay.replace(/\/$/, '') + '/api/handoffs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    body: JSON.stringify(body),
  });
  const out = (await res.json()) as { code?: string; url?: string; expiresAt?: string; error?: string };
  if (!res.ok || !out.code) throw new Error(`Relay refused the upload: ${out.error ?? res.status}`);
  const base = out.url?.startsWith('http') ? out.url : `${opts.relay.replace(/\/$/, '')}/h/${out.code}`;
  return { code: out.code, link: key ? `${base}#${key}` : base, sealed: !!key, expiresAt: out.expiresAt };
}

/** Fetch a handoff and render it to bundle files. Accepts "BTN-…", "BTN-…#key" or a full /h/ link. */
export async function pickup(input: string, opts: { relay?: string; store?: RelayStore } = {}): Promise<{ code: string; files: FileMap; title: string }> {
  const p = parsePickup(input);
  const relay = p.base ?? opts.relay;
  let rec: RelayRecord | undefined;
  if (relay) {
    const res = await fetch(`${relay.replace(/\/$/, '')}/api/handoffs/${encodeURIComponent(p.code)}`);
    if (res.status === 404) throw new Error(`No handoff ${p.code} on ${relay} (expired or wrong code)`);
    if (!res.ok) throw new Error(`Relay answered HTTP ${res.status}`);
    rec = (await res.json()) as RelayRecord;
  } else {
    rec = (opts.store ?? new RelayStore()).get(p.code);
    if (!rec) throw new Error(`No handoff ${p.code} in the local store. Pass --relay <url> if it was sent to a remote relay.`);
  }
  if (rec.sealed && !rec.bundle) {
    if (!p.key) throw new Error('This handoff is end-to-end encrypted: use the full code including "#key".');
    const payload = JSON.parse(new TextDecoder().decode(await unseal(rec.sealed, p.key))) as { title: string; zip: string };
    const members = unzipStored(base64ToBytes(payload.zip));
    const files: FileMap = {};
    for (const [k, v] of Object.entries(members)) files[k.replace(/^[^/]+\//, '')] = k.endsWith('.md') || k.endsWith('.json') || k.endsWith('.html') ? new TextDecoder().decode(v) : v;
    return { code: rec.code, files, title: payload.title };
  }
  const { files, bundle } = renderRecord(rec);
  return { code: rec.code, files, title: bundle.title };
}

export { renderBundleFiles };
