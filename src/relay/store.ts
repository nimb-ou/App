// File-backed relay store. One JSON file per handoff, written atomically. Codes are capability tokens.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { BatonBundle } from '../core/schema.ts';
import type { Checkpoint, RelayRecord, SealedPayload } from './checkpoint.ts';

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

export interface StoreOptions {
  dir?: string;
  ttlDays?: number;
  maxBytes?: number;
}

export function defaultStoreDir(): string {
  return process.env.BATON_STORE ?? join(homedir(), '.baton', 'store');
}

export class RelayStore {
  dir: string;
  ttlMs: number;
  maxBytes: number;

  constructor(opts: StoreOptions = {}) {
    this.dir = opts.dir ?? defaultStoreDir();
    this.ttlMs = (opts.ttlDays ?? Number(process.env.BATON_TTL_DAYS ?? 7)) * 86400000;
    this.maxBytes = opts.maxBytes ?? Number(process.env.BATON_MAX_BYTES ?? 25 * 1024 * 1024);
    mkdirSync(this.dir, { recursive: true });
  }

  private file(code: string): string {
    if (!CODE_RE.test(code)) throw new Error(`Invalid pickup code: ${code}`);
    return join(this.dir, `${code}.json`);
  }

  private write(r: RelayRecord): RelayRecord {
    const json = JSON.stringify(r);
    if (json.length > this.maxBytes) throw new Error(`Handoff too large (${(json.length / 1048576).toFixed(1)} MB > ${(this.maxBytes / 1048576).toFixed(0)} MB limit)`);
    const f = this.file(r.code);
    writeFileSync(f + '.tmp', json);
    renameSync(f + '.tmp', f);
    return r;
  }

  create(init: { title?: string; from: string; bundle?: BatonBundle; sealed?: SealedPayload }): RelayRecord {
    const now = new Date();
    let code = newCode();
    while (existsSync(join(this.dir, `${code}.json`))) code = newCode();
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

  get(code: string): RelayRecord | undefined {
    const f = this.file(normaliseCode(code));
    if (!existsSync(f)) return undefined;
    const r = JSON.parse(readFileSync(f, 'utf8')) as RelayRecord;
    if (Date.parse(r.expiresAt) < Date.now()) {
      rmSync(f, { force: true });
      return undefined;
    }
    return r;
  }

  addCheckpoint(code: string, c: Omit<Checkpoint, 'seq' | 'at'>): RelayRecord {
    const r = this.get(code);
    if (!r) throw new Error(`No handoff ${code} (expired or never created)`);
    if (r.sealed) throw new Error('This handoff is end-to-end encrypted; checkpoints cannot be added on the server');
    r.checkpoints.push({ ...c, seq: r.checkpoints.length + 1, at: new Date().toISOString() });
    if (c.title) r.title = c.title;
    if (!r.from.includes(c.from)) r.from.push(c.from);
    r.updatedAt = new Date().toISOString();
    return this.write(r);
  }

  list(limit = 20): RelayRecord[] {
    return readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(this.dir, f), 'utf8')) as RelayRecord;
        } catch {
          return undefined;
        }
      })
      .filter((r): r is RelayRecord => !!r && Date.parse(r.expiresAt) >= Date.now())
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  purgeExpired(): number {
    let n = 0;
    for (const f of readdirSync(this.dir).filter((x) => x.endsWith('.json'))) {
      try {
        const r = JSON.parse(readFileSync(join(this.dir, f), 'utf8')) as RelayRecord;
        if (Date.parse(r.expiresAt) < Date.now()) {
          rmSync(join(this.dir, f), { force: true });
          n++;
        }
      } catch {
        /* skip */
      }
    }
    return n;
  }
}
