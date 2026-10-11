# Journal 04: Dogfood and handover

**Window:** 2026-10-11 18:15 to 18:25 UTC

## Dogfood: Baton exports the session that built Baton

```bash
node src/bin.ts session latest -o examples/this-build-session
```

This turns the Claude Code session log (`~/.claude/projects/-home-user-App/<session>.jsonl`) into a bundle in the repo:
every user prompt verbatim, every assistant message, every tool call (web searches, file writes, test runs) with its output,
and the repo's source files **recovered from the session's own Write/Edit calls**. It is the "all reasoning, prompts,
outputs … saved … on GitHub" requirement, produced by the product itself.

What the export shows about Claude Code as a *source*:
- Thinking blocks are stored as signatures only, with no plaintext. The loss audit reports this (`reasoning-depth`), and the
  reasoning appears instead in the visible messages, these journals and the ADRs.
- Harness `<system-reminder>` blocks (which carry account context) are stripped and counted, not exported.
- Files edited with Python in-place scripts are reported as **stale**. This is correct: the log does not contain their final bytes.
  The committed source in `src/` is authoritative.

## Verified install paths

| Path | Result |
|---|---|
| `npx -y github:nimb-ou/App#claude/laughing-davinci-c048d8 --version` from an empty directory | `0.1.0`, then `inspect` works on the fixture |
| `claude plugin validate .` (marketplace) and on the plugin manifest | passed |
| Web app in headless Chromium, 1280 px light / 400 px dark | renders, converts the example, 0 console errors, no horizontal scroll |
| Hosted page | https://claude.ai/artifact/LNWKhj92JwA6wVtBkBMmRK (private to the owner until shared) |

## Not done / open

- **No `main` branch exists** on `nimb-ou/App`. Its only branch is this one, so a pull request has no base to target.
  Creating `main` (from this branch, or empty) is the owner's call.
- Live posting to Salesforce, Jira, Zendesk and Slack was not exercised (no credentials here). Payload shapes are unit-tested only.
- Logged-in ChatGPT chats (not shared) need the browser extension on the roadmap.
- The Stumping Recovery Lab itself (the cricket research app from the original ChatGPT thread) was **not** rebuilt. The
  user re-scoped to the transfer problem. Its handoff bundle (`examples/cricket-stumping/`) holds the 13 recovered files and a
  list of the 16 lost ones, ready for a follow-up session to continue it with `/baton:import`.
