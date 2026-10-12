// Node file-backed relay store: one JSON file per handoff (atomic rename). Shared by the local stdio MCP
// server, the CLI and the Node relay, so AIs on one machine hand off through ~/.baton/store.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AsyncRelayStore, type KV } from './kvstore.ts';

export { CODE_RE, newCode, normaliseCode, AsyncRelayStore, MemoryKV } from './kvstore.ts';

export function defaultStoreDir(): string {
  return process.env.BATON_STORE ?? join(homedir(), '.baton', 'store');
}

/** Keys are `h:<code>`; files are `<code>.json`. Expiry is enforced by the store on read. */
export class FileKV implements KV {
  dir: string;
  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }
  private file(key: string) {
    return join(this.dir, `${key.replace(/^h:/, '').replace(/[^A-Z0-9-]/gi, '_')}.json`);
  }
  async get(key: string) {
    const f = this.file(key);
    return existsSync(f) ? readFileSync(f, 'utf8') : null;
  }
  async put(key: string, value: string) {
    const f = this.file(key);
    writeFileSync(f + '.tmp', value);
    renameSync(f + '.tmp', f);
  }
  async delete(key: string) {
    rmSync(this.file(key), { force: true });
  }
  async list(prefix: string) {
    return readdirSync(this.dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => `h:${f.slice(0, -5)}`)
      .filter((k) => k.startsWith(prefix));
  }
}

export interface StoreOptions {
  dir?: string;
  ttlDays?: number;
  maxBytes?: number;
}

export class RelayStore extends AsyncRelayStore {
  dir: string;
  constructor(opts: StoreOptions = {}) {
    const dir = opts.dir ?? defaultStoreDir();
    super(new FileKV(dir), {
      ttlDays: opts.ttlDays ?? Number(process.env.BATON_TTL_DAYS ?? 7),
      maxBytes: opts.maxBytes ?? Number(process.env.BATON_MAX_BYTES ?? 25 * 1024 * 1024),
    });
    this.dir = dir;
  }
}
