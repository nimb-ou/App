---
description: Package this Claude Code session as a Baton handoff bundle for another agent, person or system
argument-hint: [--zip] [--install-skill] [--sink jira,slack]
---

Use the `baton` skill to hand off this session. Run
`node "${CLAUDE_PLUGIN_ROOT}/dist/baton.mjs" session latest -o handoffs/<short-name-for-this-work> $ARGUMENTS`,
then show me the bundle path, the files status, the loss audit headline, and how to give it to the next tool
(PROMPT.md for chat apps, the folder or SKILL.md for coding agents, sinks for business systems).
Do not post to any external system unless I explicitly ask.
