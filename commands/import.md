---
description: Import a ChatGPT share link, export or session log as a Baton handoff and continue the work
argument-hint: <share-url | file> [--pick "title words"]
---

Use the `baton` skill to import this source and continue the work: $ARGUMENTS

Run the import with the CLI bundled in the plugin (`node "${CLAUDE_PLUGIN_ROOT}/dist/baton.mjs" import …`, writing to `handoffs/<short-name>`).
Then read HANDOFF.md, summarise the goal, current state, recovered/stale/lost files and high-severity losses in a few lines,
and ask me whether to continue from the latest instruction.
