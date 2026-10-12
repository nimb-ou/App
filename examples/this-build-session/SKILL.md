---
name: continue-https-chatgpt-com-share-6acbc222-2500-83ee-b38c-dc
description: "Resume the 'https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388. Build this. End ' work handed off from Claude Code (2026-10-11). Original goal: hi. Use when the user asks to continue, resume, rebuild, review or extend this work."
---

# Continue: https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388. Build this. End 

This skill folder is a **Baton handoff bundle**: an audited transfer of work done in Claude Code.
Everything needed to resume is next to this file.

## Steps

1. Read `HANDOFF.md` first. It has the goal, every user prompt, where the work stopped, open threads, files and losses.
2. Open `TRANSCRIPT.md` only for the turns you need. It is long, and reasoning and tool calls are folded.
3. Treat `files/` as the recovered working tree. Only **recovered** files are exact. **stale** files need checking.
   **lost** files do not exist and must be rebuilt (see `LOSS_AUDIT.md`).
4. Confirm the latest instruction with the user before large changes:
   > not necessary drop a file, i mean we can embed it in multiple ais and transfer from within, so that w capturw what sharing could never possibly can. build from that perspective. think bih
5. When you finish a chunk of work, write `STATE.md` (goal, decisions, next steps) next to this file.

## Integrity

`bundle.json` is the canonical record. Hash-chain root: `cc9df95c1270ca3440b96b435303549ae07753fecbbcebcc557daaceb907c4cf`.
If `baton` is installed, run `baton verify .` to check nothing was altered.
