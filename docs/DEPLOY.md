# Deploying the Baton relay (for ChatGPT and Claude connectors)

ChatGPT and claude.ai call MCP connectors **from their own cloud**, so the relay needs a public HTTPS address.
The browser extension and local agents do **not** need this.

## Option A: Cloudflare Workers (recommended: free, always on, persistent storage)

**One click:**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nimb-ou/App)

Sign in with Cloudflare (free account). The button forks the repo, creates the `BATON_KV` storage namespace from
`wrangler.jsonc`, and deploys `worker/index.ts`. You get a URL like `https://baton-relay.<you>.workers.dev`.

**Or one command** (with `CLOUDFLARE_API_TOKEN` set, created from the "Edit Cloudflare Workers" template):

```bash
npm run deploy:relay      # creates/reuses BATON_KV, deploys, sets a secret MCP path, smoke-tests, prints the URLs
```

**Or step by step from a terminal (Node 18+):**

```bash
git clone https://github.com/nimb-ou/App && cd App
npx wrangler login                                  # opens the browser once
npx wrangler kv namespace create BATON_KV           # prints an id
#  → paste it into wrangler.jsonc:  "kv_namespaces": [{ "binding": "BATON_KV", "id": "<that id>" }]
npx wrangler deploy                                 # prints https://baton-relay.<you>.workers.dev
```

**Recommended: hide the MCP endpoint behind a secret path.** Anyone who knows the URL can create handoffs.

```bash
npx wrangler secret put BATON_MCP_SECRET            # type any long random string, e.g. from `openssl rand -hex 16`
# MCP URL becomes https://baton-relay.<you>.workers.dev/mcp/<that secret>
```

Optional variables (in the dashboard, or `npx wrangler secret put …`): `BATON_RELAY_TOKEN` (requires a bearer token for REST uploads
from the extension and CLI), `BATON_TTL_DAYS` (default 7).

Check it: open `https://baton-relay.<you>.workers.dev/`. The page shows the exact MCP URL to paste into each AI.

## Option B: any Node or Docker host

```bash
npx -y github:nimb-ou/App relay --port 8787                     # Node 18+, stores in ~/.baton/store
docker build -t baton-relay . && docker run -p 8787:8787 -v baton:/data baton-relay
```

Put it behind HTTPS (Caddy, nginx, Cloud Run, Fly, Railway…). `render.yaml` deploys to Render, but Render's free plan
has **no persistent disk**, so handoffs vanish when the service restarts. Use a paid disk or Option A.

## What was verified

- The Worker runs in Cloudflare's runtime (`wrangler dev`, workerd) with a KV binding. A scripted MCP client (not the real
  ChatGPT or Claude) checkpointed and picked up with files, the viewer and zip were served, and a sealed CLI send/pickup verified the root hash.
- The same handler is covered by `tests/relay.test.ts` (in-memory KV) and runs on Node (file store).
- **Deployed for real** on 2026-10-11 to `https://baton-relay.nimitjain-248.workers.dev` with `npm run deploy:relay` ([journal 07](journal/2026-10-11-07-live-deploy.md)).
