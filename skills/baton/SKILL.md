---
name: baton-handoff
description: Continue work from a Baton bundle while preserving provenance and respecting its loss audit. Use when a user provides a HANDOFF.md, bundle.json, or asks to continue work transferred from another AI tool.
---

# Continue from a Baton bundle

1. Read `HANDOFF.md` first, then `loss-audit.md`, then `conversation.md`.
2. Treat `source/` as the preserved original. Use it to resolve parser questions, not to assume missing tool outputs exist.
3. Review every file under `recovered/`. These files were reconstructed from visible code and may predate later edits.
4. Do not invent the contents of redacted tool results, missing files, hidden reasoning, or dead sandbox links. State the gap when it affects the task.
5. Continue from the last visible user request. Preserve earlier constraints and decisions that still apply.
6. Put new outputs in the bundle or the receiving project, and update the handoff notes with what changed.

## Create a bundle

If Baton is available in the current checkout, import a saved source with:

```sh
node bin/baton.mjs import path/to/conversation.html --zip
```

Use a local export when possible. A public share URL can be fetched by the CLI, but authenticated chat endpoints and private account data are out of scope.
