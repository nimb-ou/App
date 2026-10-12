# Journal 05: Capture from within (prompt 004)

**Window:** 2026-10-11 17:53 to 18:15 UTC

## The shift

v0.1 parsed what vendors publish. Prompt 004 asked for Baton to live **inside** the AIs and transfer from there.
Research ([07](../research/07-capture-surfaces.md)) found four capture positions. ADR-002 commits to three of them
(in page, in the model's toolbox, in the agent runtime) behind one format and one relay.

## Built

| Piece | Proof |
|---|---|
| Relay MCP tools: `baton_checkpoint` (model writes full files, tool outputs, verbatim prompts, decisions), `baton_pickup`, `baton_get_file`, `baton_list` | Live run: a client named "ChatGPT" checkpointed `app.py` (the file the share link lost) plus a PNG plus an output. A client named "claude-ai" picked it up with a lower-cased code and got the files inline. |
| Relay hub `baton relay`: MCP Streamable HTTP with sessions, REST, `/h/<code>` viewer with a CSP, zip, bearer token, rate limit, TTL purge | `tests/relay.test.ts` against a real HTTP server |
| End-to-end sealing (AES-GCM, key in the `#fragment`) | Server stored ciphertext only. CLI pickup verified the same root hash as the original. A wrong key was rejected. The browser decrypt page worked in Chromium. |
| Local shared store | Two separate stdio MCP processes ("claude-desktop" → "cursor") handed off with no server |
| Extension (MV3): ChatGPT / Claude / Gemini / DOM adapters, main-world stream tap, shadow-DOM panel, composer injection, relay send | `tests-e2e/extension.e2e.mjs`: the real extension in Chromium against mock sites. It captured the tool output and both sandbox files (the PDF byte-exact), kept the live stream, and "Continue in Claude" filled the composer and attached `HANDOFF.md` plus `app.py`. |
| Claude Code hooks (`PreCompact`, `SessionEnd`) → `.baton/sessions/` | Fed a real hook payload (this session's transcript), and the snapshot was written. Plugin validates. |
| Core: binary artifacts (base64), captured files override recovery, claude.ai `artifacts` / `create_file` / `str_replace` replay | Unit tests |
| Deploy: `Dockerfile`, `render.yaml`, `docs/EMBED.md` (setup for each AI) | Docker build and run checked (see below) |

## Bugs caught by the new tests

1. The extension bundle pulled `node:fs` in through the relay client. `sealedPlaintext` moved to the browser-safe `seal.ts`.
2. Extensions do not load in Playwright's old headless mode. The e2e uses `channel: 'chromium'` (new headless).
3. Captured text files were stored as base64, so they were skipped as attachments. Text MIME types and extensions now stay UTF-8.
4. A claude.ai artifact `update` (which has no `type`) resolved to a different path than its `create`. Paths are now tracked by artifact id.

## Limits (stated plainly)

- Extension adapters use the sites' internal web APIs (as every exporter does). They are tested against mocks, not live
  accounts, because this environment has no logged-in ChatGPT, Claude or Gemini sessions. Expect selector or endpoint drift. Adapters are isolated
  and fall back to DOM capture.
- ChatGPT write tools over MCP need a plan with developer-mode write actions. Read-only plans can still pick up.
- The relay is not deployed publicly from here. It needs an HTTPS host (Render blueprint and Dockerfile provided).
