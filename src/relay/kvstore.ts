// Portable relay store over a minimal async key-value interface, so the same relay runs on Node (files),
// Cloudflare Workers (KV), Deno (Deno KV adapter) or in memory (tests). No Node APIs in this file.

import type { BatonBundle } from '../core/schema.ts';
import type { Checkpoint, RelayRecord, SealedPayload } from './checkpoint.ts';

export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I, L, O, U)
export const CODE_RE = /^BTN(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

/** BTN-XXXX-XXXX-XXXX: 60 random bits. */
export function newCode(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => ALPHABET[b & 31]);
  return `BTN-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export function normaliseCode(input: string): string {
  const c = input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^BTN/, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  return c.length === 12 ? `BTN-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}` : input.trim();
}

export interface StoreLimits {
  ttlDays?: number;
  maxBytes?: number;
}

export class MemoryKV implements KV {
  map = new Map<string, { v: string; exp?: number }>();
  async get(k: string) {
    const e = this.map.get(k);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) {
      this.map.delete(k);
      return null;
    }
    return e.v;
  }
  async put(k: string, v: string, o?: { expirationTtl?: number }) {
    this.map.set(k, { v, exp: o?.expirationTtl ? Date.now() + o.expirationTtl * 1000 : undefined });
  }
  async delete(k: string) {
    this.map.delete(k);
  }
  async list(prefix: string) {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}

export class AsyncRelayStore {
  kv: KV;
  ttlMs: number;
  maxBytes: number;

  constructor(kv: KV, limits: StoreLimits = {}) {
    this.kv = kv;
    this.ttlMs = (limits.ttlDays ?? 7) * 86400000;
    this.maxBytes = limits.maxBytes ?? 25 * 1024 * 1024;
  }

  private key(code: string): string {
    if (!CODE_RE.test(code)) throw new Error(`Invalid pickup code: ${code}`);
    return `h:${code}`;
  }

  private async write(r: RelayRecord): Promise<RelayRecord> {
    const json = JSON.stringify(r);
    if (json.length > this.maxBytes) throw new Error(`Handoff too large (${(json.length / 1048576).toFixed(1)} MB > ${(this.maxBytes / 1048576).toFixed(0)} MB limit)`);
    const ttl = Math.max(60, Math.round((Date.parse(r.expiresAt) - Date.now()) / 1000));
    await this.kv.put(this.key(r.code), json, { expirationTtl: ttl });
    return r;
  }

  async create(init: { title?: string; from: string; bundle?: BatonBundle; sealed?: SealedPayload }): Promise<RelayRecord> {
    const now = new Date();
    let code = newCode();
    while (await this.kv.get(this.key(code))) code = newCode();
    return this.write({
      code,
      title: init.title ?? init.bundle?.title ?? 'Untitled handoff',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      from: [init.from],
      bundle: init.bundle,
      sealed: init.sealed,
      checkpoints: [],
    });
  }

  async get(code: string): Promise<RelayRecord | undefined> {
    const c = normaliseCode(code);
    if (!CODE_RE.test(c)) return undefined;
    const raw = await this.kv.get(this.key(c));
    if (!raw) return undefined;
    const r = JSON.parse(raw) as RelayRecord;
    if (Date.parse(r.expiresAt) < Date.now()) {
      await this.kv.delete(this.key(c));
      return undefined;
    }
    return r;
  }

  async addCheckpoint(code: string, c: Omit<Checkpoint, 'seq' | 'at'>): Promise<RelayRecord> {
    const r = await this.get(code);
    if (!r) throw new Error(`No handoff ${code} (expired or never created)`);
    if (r.sealed) throw new Error('This handoff is end-to-end encrypted; checkpoints cannot be added on the server');
    r.checkpoints.push({ ...c, seq: r.checkpoints.length + 1, at: new Date().toISOString() });
    if (c.title) r.title = c.title;
    if (!r.from.includes(c.from)) r.from.push(c.from);
    r.updatedAt = new Date().toISOString();
    return this.write(r);
  }

  async list(limit = 20): Promise<RelayRecord[]> {
    const out: RelayRecord[] = [];
    for (const k of await this.kv.list('h:')) {
      const r = await this.get(k.slice(2));
      if (r) out.push(r);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }

  async purgeExpired(): Promise<number> {
    let n = 0;
    for (const k of await this.kv.list('h:')) {
      const raw = await this.kv.get(k);
      if (raw && Date.parse((JSON.parse(raw) as RelayRecord).expiresAt) < Date.now()) {
        await this.kv.delete(k);
        n++;
      }
    }
    return n;
  }
}
