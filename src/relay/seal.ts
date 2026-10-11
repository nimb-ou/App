// End-to-end sealing for relay uploads (extension / CLI): AES-GCM-256 via WebCrypto (Node ≥18 and browsers).
// The key travels only in the pickup link's #fragment, which browsers never send to the server.

import type { SealedPayload } from './checkpoint.ts';
import type { BatonBundle } from '../core/schema.ts';
import { base64ToBytes, bytesToBase64 } from '../core/util.ts';
import { zip, type FileMap } from '../core/zip.ts';

const subtle = () => globalThis.crypto.subtle;

const b64url = (b: Uint8Array) => bytesToBase64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => base64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

export async function seal(plaintext: Uint8Array): Promise<{ sealed: SealedPayload; key: string }> {
  const raw = new Uint8Array(32);
  globalThis.crypto.getRandomValues(raw);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const key = await subtle().importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, plaintext as BufferSource));
  return { sealed: { iv: bytesToBase64(iv), data: bytesToBase64(ct), alg: 'AES-GCM-256' }, key: b64url(raw) };
}

export async function unseal(sealed: SealedPayload, keyB64url: string): Promise<Uint8Array> {
  const key = await subtle().importKey('raw', fromB64url(keyB64url) as BufferSource, 'AES-GCM', false, ['decrypt']);
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: base64ToBytes(sealed.iv) as BufferSource }, key, base64ToBytes(sealed.data) as BufferSource));
  } catch {
    throw new Error('Could not decrypt: wrong key or tampered data');
  }
}

/** "BTN-XXXX-XXXX-XXXX#key" or a full https://…/h/BTN-…#key link → {code, key?, base?} */
export function parsePickup(input: string): { code: string; key?: string; base?: string } {
  const [left, key] = input.trim().split('#');
  const m = left.match(/^(https?:\/\/.+?)\/h\/(BTN-[0-9A-Z-]+)/i);
  if (m) return { base: m[1], code: m[2].toUpperCase(), key: key || undefined };
  return { code: left.toUpperCase(), key: key || undefined };
}

/** What a sealed upload contains: enough to read, paste and download the bundle. */
export function sealedPlaintext(bundle: BatonBundle, files: FileMap): Uint8Array {
  const prefixed: FileMap = {};
  for (const [k, v] of Object.entries(files)) prefixed[`${bundle.id}/${k}`] = v;
  return new TextEncoder().encode(JSON.stringify({ title: bundle.title, handoff: String(files['HANDOFF.md']), prompt: String(files['PROMPT.md']), zip: bytesToBase64(zip(prefixed)) }));
}

