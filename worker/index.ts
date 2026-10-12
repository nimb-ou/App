// Cloudflare Worker host for the Baton relay: free, always-on HTTPS with persistent KV storage.
// Deploy: see docs/DEPLOY.md (one-click button, or `npx wrangler deploy`).

import { createRelayHandler } from '../src/relay/handler.ts';
import { AsyncRelayStore, type KV } from '../src/relay/kvstore.ts';
import type { BatonBundle } from '../src/core/schema.ts';
// The permanent /demo handoff: the real ChatGPT share chat this project started from (examples/cricket-stumping).
import demo from '../examples/cricket-stumping/bundle.json';

interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

interface Env {
  BATON_KV: KVNamespaceLike;
  BATON_PUBLIC_URL?: string;
  BATON_RELAY_TOKEN?: string;
  BATON_MCP_SECRET?: string;
  BATON_TTL_DAYS?: string;
  BATON_MAX_BYTES?: string;
}

class CloudflareKV implements KV {
  ns: KVNamespaceLike;
  constructor(ns: KVNamespaceLike) {
    this.ns = ns;
  }
  get(k: string) {
    return this.ns.get(k);
  }
  put(k: string, v: string, o?: { expirationTtl?: number }) {
    return this.ns.put(k, v, o);
  }
  delete(k: string) {
    return this.ns.delete(k);
  }
  async list(prefix: string) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.ns.list({ prefix, cursor });
      out.push(...page.keys.map((k) => k.name));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && out.length < 5000);
    return out;
  }
}

let handler: ((req: Request) => Promise<Response>) | undefined;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (!env.BATON_KV) return new Response('Baton relay: bind a KV namespace as BATON_KV (see docs/DEPLOY.md)', { status: 500 });
    handler ??= createRelayHandler({
      store: new AsyncRelayStore(new CloudflareKV(env.BATON_KV), {
        ttlDays: Number(env.BATON_TTL_DAYS ?? 7),
        // Workers KV values are capped at 25 MiB.
        maxBytes: Math.min(Number(env.BATON_MAX_BYTES ?? 24 * 1024 * 1024), 24 * 1024 * 1024),
      }),
      publicUrl: env.BATON_PUBLIC_URL || undefined,
      token: env.BATON_RELAY_TOKEN || undefined,
      mcpSecret: env.BATON_MCP_SECRET || undefined,
      demo: demo as unknown as BatonBundle,
    });
    return handler(req);
  },
};
