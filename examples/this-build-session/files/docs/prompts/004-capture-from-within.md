# Prompt 004: "Capture from within"

**Received:** 2026-10-11, about 17:53 UTC (after v0.1 was pushed)

## Verbatim

> not necessary drop a file, i mean we can embed it in multiple ais and transfer from within, so that w capturw what sharing could never possibly can. build from that perspective. think bih

## Interpretation (agent's reading)

v0.1 works **after the fact**: it parses whatever a vendor chooses to publish (a share link, an export). Prompt 004 asks for the
opposite position. Baton should live **inside** each AI and capture at the source, then hand the work across from within.

| Words in the prompt | What it means for the build |
|---|---|
| "not necessary drop a file" | No manual download and upload. Capture and transfer are one action inside the AI. |
| "embed it in multiple AIs" | One relay reachable from every AI surface: web chats (ChatGPT, Claude, Gemini), desktop apps, coding agents (Claude Code, Codex, Cursor, Gemini CLI). |
| "transfer from within" | Send from AI A and receive in AI B, using a pickup code or a direct tab-to-tab injection, with no files in between. |
| "capture what sharing could never possibly can" | Tool outputs, generated files (binary included), streamed text, model-side state (decisions, plan, files it holds in context), and context about to be lost to compaction. |
| "think big" | Treat Baton as the **neutral context bus between AIs**: a protocol plus a relay, not a converter. |

See [ADR-002](../decisions/ADR-002-capture-from-within.md) and [research 07](../research/07-capture-surfaces.md).
