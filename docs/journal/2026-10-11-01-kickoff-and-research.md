# Journal 01: Kickoff, source decoding and research

**Window:** 2026-10-11 17:10 to 17:35 UTC
**State at start:** empty repo `nimb-ou/App` with no commits on any branch (`git ls-remote` returned nothing).

## Timeline

| Time (UTC) | Action | Output / result |
|---|---|---|
| 17:10 | Greeted. Confirmed repo and branch. | none |
| 17:14 | Prompt 002 received (share link + "build this end to end"). | none |
| 17:14 | `WebFetch` on share URL | Title only: "Cricket Stumping Simulation" |
| 17:15 | `curl` with browser UA | 200 OK, 1,400,610 bytes HTML |
| 17:16 | Located `streamController.enqueue(...)` | 2 chunks (731,900 chars + terminator) |
| 17:17 | Wrote turbo-stream decoder (Python, scratch) | 406 nodes, linear chain. Roles: 8 user, 46 thoughts, 52 code, 163+ tool. |
| 17:18 | Inspected hidden/system messages | All empty. `model_editable_context` empty. Safe to keep. |
| 17:19 | Analysed exec cells for file writes | ~15 files recoverable from heredocs. `functions.exec` blank, so `app.py` is lost. |
| 17:20 | **Prompt 003: reframe.** The product is the transfer problem itself. | Plan changed (see below) |
| 17:21–17:30 | 16 web searches (market, formats, legal, B2B, monetisation) | `docs/research/01–06` |
| 17:30 | Decided product shape | `docs/decisions/ADR-001-product-shape.md` |

## Key reasoning (summarised)

1. **Why reframe instead of building the cricket lab?** Prompt 003 says "Now this is the exact problem". The
   screenshot shows the agent struggling to *transfer* the chat. The cricket chat becomes the first real-world
   fixture and the demo: Baton must turn that share link back into a working handoff, including the files
   ChatGPT made but never delivered.
2. **Why not a memory app?** Claude and Gemini both shipped memory import in March 2026, and start-ups (AI Passport, $3M seed)
   are crowding that space. Memory is a *user profile*. The user's pain is moving *work state*: plan, reasoning,
   code, files.
3. **Why the loss audit matters:** the share link *looks* complete but silently drops every tool output and every
   generated file. A transfer tool that hides that is worse than useless, so the audit is a first-class output.
4. **Why the receiving agent summarises:** it keeps the free tier at $0 inference cost, avoids API keys, and the
   receiving agent is the one that needs to understand the work anyway.

## Next

Commit docs. Build the core (`src/core`), then parsers and renderers, testing against the real fixture at each step.
