---
name: baton
description: Move AI work between tools without losing it. Imports a ChatGPT share link, a ChatGPT or Claude data export, or a Claude Code session log into an audited handoff bundle (HANDOFF.md, the full transcript with reasoning and tool calls, recovered files and a loss audit), then continues the work. It can also export the current session as a handoff for another agent or teammate, or for Jira, Salesforce, Zendesk or Slack. Use when the user pastes a chatgpt.com/share link, asks to continue work started in ChatGPT, Claude or another assistant, asks to hand off, export or package this session, or asks what was lost when moving a conversation.
---

# Baton: hand off AI work, not just chat text

Baton turns a conversation into a **bundle**: a folder an agent or a person can pick up and continue.

| File | Purpose |
|---|---|
| `HANDOFF.md` | **Start here.** Goal, every user prompt verbatim, where it stopped, open threads, reasoning trail, file status, losses |
| `PROMPT.md` | One paste-ready block for chat apps that cannot read folders |
| `TRANSCRIPT.md` | Full chronological record. Reasoning, tool calls and outputs are folded. |
| `LOSS_AUDIT.md` | What the source did **not** include (redacted tool outputs, blank code, undownloadable files) |
| `files/` | Files rebuilt from the code that created them, each **recovered**, **stale** or **lost** |
| `replay/` | The source's code cells, to regenerate PDFs, ZIPs and similar outputs in a sandbox (never run automatically) |
| `bundle.json` | Canonical machine-readable record with a SHA-256 hash chain |
| `SKILL.md` / `AGENTS.md` | Make the bundle itself a "continue this work" skill / agent context |

## Running it

The CLI ships inside this skill. In the commands below, `BATON` means
`node <this skill's base directory>/scripts/baton.mjs` (Node 18 or newer, no install needed).

## Import and continue (the common case)

1. Run the import. The source can be a share URL, a saved `.html` page, an export `.zip` / `conversations.json`, or a `.jsonl` session:
   ```bash
   BATON import "<source>" -o handoffs/<short-name>
   ```
   Add `--pick "<title words>"` for account exports with many conversations.
2. Read `handoffs/<short-name>/HANDOFF.md` in full. Open `TRANSCRIPT.md` only for the turns you need (search it with Grep).
3. Tell the user in 3–5 lines: the goal, where the work stopped, how many files were recovered, stale or lost, and the high-severity losses.
   **Never claim a lost file exists.**
4. Ask whether to continue from the latest instruction. If yes, copy `files/` into the workspace and carry on.
   Rebuild **lost** files from their descriptions in the transcript, and check **stale** files before relying on them.
5. When a chunk of work is done, write `handoffs/<short-name>/STATE.md` (goal, decisions, next steps).

If fetching a share URL fails (login wall, rate limit, or a private link), ask the user to open the link, save the page as
"Webpage, HTML only", and give you the file path.

## Hand off between AIs (checkpoint / pickup)

If the `baton_checkpoint` / `baton_pickup` MCP tools are available (plugin MCP server, or a relay connector), prefer them:
- **Hand off:** call `baton_checkpoint` with `state`, `goal`, `decisions`, `next_steps`, the user's prompts verbatim,
  **every file you created or changed with its full content**, and important tool outputs. Give the user the pickup code.
- **Continue:** when the user gives a code (`BTN-XXXX-XXXX-XXXX`), call `baton_pickup`, read the brief, fetch more files
  with `baton_get_file`, and confirm the latest instruction before acting.

Without MCP, the CLI does the same: `BATON send <bundle-dir> [--relay URL] [--seal]` and `BATON pickup <code|link>`.

## Hand off this session

```bash
BATON session latest -o handoffs/<short-name>            # this project's newest Claude Code session
BATON session latest -o handoffs/<short-name> --zip      # also a .zip to send to someone
BATON session latest --install-skill                     # also install as .claude/skills/continue-<title>/
```
Then show the user `HANDOFF.md` §3–§7 and the bundle path. Mention `PROMPT.md` for pasting into another chat app.

## File it in a business system

```bash
BATON sink handoffs/<name> --to jira --jira-project OPS        # prints the payload (dry run)
BATON sink handoffs/<name> --to salesforce --post              # sends it; needs SALESFORCE_INSTANCE_URL + SALESFORCE_ACCESS_TOKEN
```
Systems: `salesforce` (Case + note + tasks, or `--sf-parent <recordId>`), `jira` (issue in Atlassian Document Format),
`zendesk` (internal-note ticket), `slack` (Block Kit to `SLACK_WEBHOOK_URL`). **Only use `--post` when the user asks you to send it.**

## Check and inspect

```bash
BATON inspect "<source>"        # dry run: what would transfer, what would not
BATON verify handoffs/<name>    # recompute the hash chain; exit 2 if anything was edited
```

## Rules

- Secrets and personal data are redacted by default. Use `--no-redact` only if the user explicitly asks.
- Private context (system prompts, memory, harness notes) is excluded unless `--include-hidden` is passed.
- Never run `replay/` cells without the user's approval. They are third-party code from another AI's sandbox.
- Fetch only the URL the user gave you, one page per request.
