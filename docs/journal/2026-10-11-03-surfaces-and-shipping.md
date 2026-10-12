# Journal 03: Surfaces, tests, web app, packaging

**Window:** 2026-10-11 17:50 to 18:15 UTC

## Built

| Surface | Where | Verified by |
|---|---|---|
| CLI (`import`, `session`, `inspect`, `verify`, `sink`, `mcp`) | `src/cli.ts`, `src/bin.ts`, `dist/baton.mjs` | e2e tests, live fetch of the real share URL (3 s, same root hash as the saved fixture) |
| MCP server (6 tools, JSON-RPC stdio, no SDK) | `src/mcp/server.ts` | scripted stdio session + unit tests (initialize, tools/list, tools/call, errors) |
| Business sinks (Salesforce composite, Jira ADF, Zendesk, Slack Block Kit) | `src/sinks/index.ts`, `src/node/post.ts` | payload-shape tests. Live posting not exercised (no credentials in this environment). |
| Agent Skill with the CLI bundled inside | `skills/baton/` | runs with plain `node`, no install |
| Claude Code plugin + marketplace + MCP config + 2 commands | `.claude-plugin/`, `.mcp.json`, `commands/` | `claude plugin validate`: passed |
| Web app, client-side only | `web/` → `web/dist/baton.html` | headless Chromium: example converts in about 130–200 ms, no console errors, no horizontal scroll at 400 px, light and dark |
| Live hosted copy of the web app | claude.ai Artifact (private to the owner), `downloads` capability for the .zip | published |
| Open format spec | `docs/SPEC.md` | n/a |
| CI | `.github/workflows/ci.yml` (typecheck, tests, build drift, bundled-CLI smoke test) | runs on push |

## Test results

64 tests, 64 pass (see `docs/outputs/test-run.txt`). TypeScript strict mode reports 0 errors.

Tests that caught real bugs before shipping:
1. **Phone redaction inside UUIDs.** `7907aff6-3500-4321-9387-…` was redacted as a phone number. Fixed with identifier-aware boundaries.
2. **Card vs phone ordering.** A Luhn-valid card number was labelled PHONE. The card rule now runs first.
3. **Decimal digits as a card.** `0.014641999965533614` was redacted. Fixed with a `(?<![\w.-])` boundary.
4. **`/repo/../x` mapping.** It resolved to `x` inside the repo instead of `_abs/x`. Fixed by normalising dots before the prefix check.
5. **Tamper detection root.** Verify flagged altered files but recomputed the *recorded* digest, so the root matched. It now hashes the shipped bytes.
6. **Duplicate shebang** in the esbuild output (source shebang plus banner). Removed the banner.

## Design decisions

- **Downloads in the hosted page** use the Artifact `downloads` capability (explicit viewer confirmation). The standalone
  HTML uses a normal download. Copying the paste-prompt works in both and is the primary action.
- **The web app cannot fetch share links** because of browser cross-origin rules. It says so plainly and offers the two paths that do work:
  saving the page as HTML, or copying a one-line CLI command. No CORS proxy is used, which would mean a third party sees the chat.
- **Example-first.** The page opens on the real cricket share, converted live in the browser and clearly labelled "Example",
  so the first view shows what the product does.
