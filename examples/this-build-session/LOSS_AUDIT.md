# Loss audit: https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388. Build this. End 

A transfer is only trustworthy if it says what it could **not** carry. This report lists everything the source dropped,
everything Baton reconstructed, and everything Baton removed on purpose (private context, secrets).

| Severity | Category | Count | Detail |
|---|---|---|---|
| HIGH | files-lost | 5 | 5 file(s) were created or linked but their contents are not in the source: docs/outputs/cli-cricket.txt, docs/outputs/plugin-validate.txt, docs/outputs/test-run.txt, docs/outputs/typecheck.txt, fixtures/chatgpt-share-cricket-stumping.html.gz. |
| WARN | files-stale | 11 | 11 file(s) were recovered exactly as last written, but later code changed them in ways that cannot be replayed statically: .claude-plugin/marketplace.json, .gitignore, package.json, scripts/build.mjs, src/cli.ts, src/core/redact.ts, src/node/io.ts, src/recover/artifacts.ts, …. |
| info | files-recovered | 49 | 49 file(s) were reconstructed byte-for-byte from the code that created them. |
| info | reasoning-depth | 71 | Thinking blocks are stored as signatures only (no plaintext) in this log, so reasoning cannot be transferred. Decisions are captured in the visible messages and tool calls. |
| info | private-context | 2 | 2 private context item(s) (system prompts, memory, custom instructions, harness metadata) were excluded. Use --include-hidden to keep them. |
| info | baton-redactions | 31 | Baton redacted 31 secret/PII match(es) before export (anthropic_key: 3, github_token: 3, aws_access_key: 3, bearer: 3, password_assign: 3, email: 6, card: 4, phone: 4, private_key: 1, openai_key: 1). Use --no-redact to disable. |

## Files

| Status | Path | Size | Versions | Notes |
|---|---|---|---|---|
| stale | `.claude-plugin/marketplace.json` | 247 B | 1 | rewritten by Python open(…, "w") |
| recovered | `.claude-plugin/plugin.json` | 570 B | 1 |  |
| recovered | `.github/workflows/ci.yml` | 605 B | 1 |  |
| stale | `.gitignore` | 58 B | 2 | edited in place by sed -i |
| recovered | `.mcp.json` | 134 B | 1 |  |
| recovered | `commands/handoff.md` | 608 B | 1 |  |
| recovered | `commands/import.md` | 581 B | 1 |  |
| recovered | `docs/decisions/ADR-001-product-shape.md` | 3.0 KB | 1 |  |
| recovered | `docs/journal/2026-10-11-01-kickoff-and-research.md` | 2.4 KB | 1 |  |
| recovered | `docs/journal/2026-10-11-02-core-engine.md` | 3.2 KB | 1 |  |
| recovered | `docs/journal/2026-10-11-03-surfaces-and-shipping.md` | 2.9 KB | 1 |  |
| recovered | `docs/journal/2026-10-11-04-dogfood-and-handover.md` | 2.4 KB | 1 |  |
| lost | `docs/outputs/cli-cricket.txt` |  |  | overwritten by shell redirect; exists in the original working directory; contents not reconstructable from the log |
| lost | `docs/outputs/plugin-validate.txt` |  |  | overwritten by shell redirect; exists in the original working directory; contents not reconstructable from the log |
| lost | `docs/outputs/test-run.txt` |  |  | overwritten by shell redirect; exists in the original working directory; contents not reconstructable from the log |
| lost | `docs/outputs/typecheck.txt` |  |  | overwritten by shell redirect; appended by shell redirect; exists in the original working directory; contents not reconstructable from the log |
| recovered | `docs/prompts/002-build-this.md` | 1.4 KB | 1 |  |
| recovered | `docs/prompts/003-the-exact-problem.md` | 2.9 KB | 1 |  |
| recovered | `docs/prompts/README.md` | 1.0 KB | 1 |  |
| recovered | `docs/research/01-market-landscape.md` | 9.7 KB | 1 |  |
| recovered | `docs/research/02-source-formats.md` | 5.8 KB | 1 |  |
| recovered | `docs/research/03-legal-and-policy.md` | 4.3 KB | 1 |  |
| recovered | `docs/research/04-monetization.md` | 4.3 KB | 1 |  |
| recovered | `docs/research/05-business-layer.md` | 3.6 KB | 1 |  |
| recovered | `docs/research/06-loss-audit-findings.md` | 2.6 KB | 1 |  |
| recovered | `docs/SPEC.md` | 5.7 KB | 1 |  |
| lost | `fixtures/chatgpt-share-cricket-stumping.html.gz` |  |  | overwritten by shell redirect; exists in the original working directory; contents not reconstructable from the log |
| stale | `package.json` | 979 B | 1 | edited in place by sed -i |
| recovered | `README.md` | 8.7 KB | 1 |  |
| recovered | `scripts/build-examples.ts` | 993 B | 1 |  |
| stale | `scripts/build.mjs` | 2.3 KB | 1 | edited in place by sed -i |
| recovered | `skills/baton/SKILL.md` | 4.5 KB | 1 |  |
| recovered | `src/bin.ts` | 283 B | 1 |  |
| stale | `src/cli.ts` | 10.4 KB | 1 | rewritten by Python open(…, "w") |
| recovered | `src/core/build.ts` | 8.2 KB | 1 |  |
| recovered | `src/core/integrity.ts` | 2.3 KB | 2 |  |
| stale | `src/core/redact.ts` | 3.2 KB | 1 | rewritten by Python open(…, "w") |
| recovered | `src/core/schema.ts` | 4.0 KB | 2 |  |
| recovered | `src/core/sha256.ts` | 3.2 KB | 1 |  |
| recovered | `src/core/turbostream.ts` | 3.3 KB | 1 |  |
| recovered | `src/core/util.ts` | 2.5 KB | 1 |  |
| recovered | `src/core/zip.ts` | 6.0 KB | 2 |  |
| recovered | `src/mcp/server.ts` | 9.6 KB | 1 |  |
| stale | `src/node/io.ts` | 7.4 KB | 1 | rewritten by Python open(…, "w") |
| recovered | `src/node/post.ts` | 1.8 KB | 1 |  |
| recovered | `src/parsers/chatgpt.ts` | 13.2 KB | 2 |  |
| recovered | `src/parsers/claude.ts` | 11.3 KB | 3 |  |
| recovered | `src/parsers/detect.ts` | 3.2 KB | 1 |  |
| recovered | `src/parsers/generic.ts` | 2.2 KB | 1 |  |
| recovered | `src/pipeline.ts` | 2.5 KB | 1 |  |
| stale | `src/recover/artifacts.ts` | 17.8 KB | 5 | rewritten by Python open(…, "w") |
| recovered | `src/render/files.ts` | 1.8 KB | 1 |  |
| stale | `src/render/handoff.ts` | 10.8 KB | 2 | rewritten by Python open(…, "w") |
| recovered | `src/render/html.ts` | 7.2 KB | 1 |  |
| recovered | `src/render/markdown.ts` | 5.2 KB | 1 |  |
| recovered | `src/render/mdlite.ts` | 4.6 KB | 1 |  |
| recovered | `src/render/turns.ts` | 4.9 KB | 1 |  |
| recovered | `src/sinks/index.ts` | 10.0 KB | 1 |  |
| recovered | `tests/core.test.ts` | 5.6 KB | 1 |  |
| recovered | `tests/parsers.test.ts` | 10.1 KB | 1 |  |
| recovered | `tests/recover.test.ts` | 5.5 KB | 1 |  |
| recovered | `tests/surfaces.test.ts` | 7.6 KB | 1 |  |
| recovered | `tsconfig.json` | 429 B | 1 |  |
| stale | `web/app.ts` | 10.8 KB | 1 | edited in place by sed -i |
| stale | `web/page.html` | 15.0 KB | 1 | rewritten by Python open(…, "w") |

- **recovered**: reconstructed byte for byte from the code that wrote it. Its SHA-256 is in `bundle.json`.
- **stale**: exactly the last full write, but later code modified it in a way that cannot be replayed statically.
- **lost**: the conversation created or linked it, but its contents are not in the source.
- **attached**: shipped with the source export (e.g. uploaded file with extracted text).

## Integrity

Hash chain root (SHA-256 over 440 events + 65 artifact digests): `782e7e280b2e78d11e5b8047c500f0ab85913a7d4a731a3460fff364c35649dc`

Run `baton verify <bundle-dir>` to recompute it. Any edit to an event or a recovered file changes the root.

## Stats

- Prompts: 4 · assistant messages: 27 · reasoning blocks: 95
- Tool calls: 157 · tool results: 156 · items the source redacted: 71
- Wall-clock span: 40m 55s
