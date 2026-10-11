# Journal 06: Ready for real accounts ("build it so I can use it for real")

## Prompt (verbatim)

> build it so that i can use it in real and test on my claude and chatgpt and gemini

## What "real" required, and what was done

| Gap | Fix | Proof |
|---|---|---|
| Web AIs need a public HTTPS relay | Relay refactored into a **portable fetch handler** over an async KV store. It runs on **Cloudflare Workers + KV** (`worker/index.ts`, `wrangler.jsonc`, deploy button), Node (file store) or Docker. | Ran in Cloudflare's runtime via `wrangler dev`: cross-AI checkpoint/pickup, viewer, zip and sealed round-trip all passed. In-memory KV unit test added. |
| Sites rewrite URLs on load, so the `#baton=` hash is lost | The background worker records the target **tab id**, and the receiving tab claims it | e2e: the Claude mock rewrites its URL and the handoff is still inserted |
| Internal APIs change without notice | Every API adapter **falls back to the rendered page** and records why | e2e: ChatGPT API returns 500, so 2 turns are captured from the DOM and the reason (`HTTP 500`) is in the loss audit |
| Team/Enterprise ChatGPT workspaces | Sends the `chatgpt-account-id` header from the `_account` cookie | unit-level |
| Gemini cannot accept scripted uploads | File contents are inlined into the message unless a real file input accepted them | e2e: Gemini mock composer contains `--- pricing.md ---` |
| Gemini has no MCP connectors | **Pick up a handoff here**: paste a code or link in the panel → inserted into the composer | e2e: relay code picked up into the Gemini mock |
| Reporting failures from real accounts | **Copy debug report**: endpoint statuses, selector counts, composer detection, no conversation text or ids | e2e asserts the report has no conversation text and no ids |
| Installing | `extension/baton-extension.zip` (production build) | Loaded in Chromium: manifest 0.3.0, content scripts on the 4 sites |
| Repo-root `.mcp.json` broke project MCP (reported in-session) | Moved into `plugin.json` `mcpServers` | `claude plugin validate`: passed (plugin and marketplace) |

## Not verifiable from here

Live logged-in ChatGPT, Claude and Gemini sessions, and an actual Cloudflare deploy. `docs/TESTING.md` is the
20-minute script for the owner. The debug report closes the loop on anything that breaks.
