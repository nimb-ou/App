# Working rules for this repo

- **Real only, no mocks.** The owner wants every demo and test claim to come from real services and real accounts.
  Never present a scripted or simulated client as "Claude", "ChatGPT" or "Gemini". If something can only be checked with
  the owner's logins, say so and give exact steps, rather than substituting a mock.
- Never commit secrets: API tokens, the relay's MCP secret path (`.baton-relay.json`) and `.wrangler.deploy.json` stay out of git.
- Live relay: `https://baton-relay.nimitjain-248.workers.dev` (Cloudflare Workers + KV). Redeploy with `npm run deploy:relay`
  (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment).
- Website and brand: pages live in `src/site/` (one shell in `brand.ts`). Brand rules in `docs/brand/BRAND.md`. After changing the mark or
  the social card, run `node scripts/build-brand-assets.mjs` (regenerates `assets/brand/*` and `src/site/assets.gen.ts`).
