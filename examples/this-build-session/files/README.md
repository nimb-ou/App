# Baton

**Hand off AI work, not just chat text.**

Baton turns an AI conversation into a **handoff bundle** that another tool, agent, teammate or business system can pick up and continue.
Sources are a ChatGPT share link, a ChatGPT or Claude data export, or a Claude Code session. Each bundle carries:

- every prompt, verbatim
- the assistant's replies and reasoning
- every tool call and the code it ran
- the **files the session created, rebuilt from that code**
- a **loss audit** of everything the source failed to hand over
- a SHA-256 hash chain so any later edit is detectable

It runs locally with zero runtime dependencies and is free to use.

```
$ npx github:nimb-ou/App import https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388
✓ Cricket Stumping Simulation
  source   ChatGPT (chatgpt-share) https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388
  content  8 prompts · 20 replies · 47 reasoning · 133 tool calls
  files    13 recovered · 3 stale · 16 lost
  loss     163 tool-outputs · 81 tool-inputs · 16 files-lost (see LOSS_AUDIT.md)
  root     0e489b3a871206841699f7195e270a7198f60bca19e2defbb98ffb0ec416bac6
  → handoffs/cricket-stumping-simulation/HANDOFF.md  (start here)
```

That is a real public share link. Its page *looks* complete and says "Download the complete ZIP", but the share
silently drops all 163 tool outputs, 33 code cells and every generated file. Baton reports that, rebuilds **13 project files byte
for byte** from the code that wrote them, and lists the 16 it cannot recover (including `app.py`) instead of pretending they exist.
See [`examples/cricket-stumping/`](examples/cricket-stumping/) and its [`HANDOFF.md`](examples/cricket-stumping/HANDOFF.md).

## Why

AI work is stuck where it happened. Claude and Gemini both shipped "import memory" in March 2026, but that moves a **profile
of you**, not **the work**: the plan, decisions, code and files. Exporter extensions produce documents for humans. None
of them says what was lost, and none recovers files. The full analysis is in [`docs/research/01-market-landscape.md`](docs/research/01-market-landscape.md).

## Use it the way you work

| You are… | Use | How |
|---|---|---|
| In a terminal | **CLI** | `npx github:nimb-ou/App import <url-or-file>` (Node ≥ 18) |
| In Claude Code | **Plugin** (skill + `/baton:import`, `/baton:handoff` + MCP) | `/plugin marketplace add nimb-ou/App` then `/plugin install baton@baton` |
| In any Skills-aware agent (Codex, Cursor, …) | **Agent Skill** | copy [`skills/baton/`](skills/baton/) into the agent's skills folder. The CLI is bundled inside it. |
| In an MCP client (Claude Desktop, Cursor, …) | **MCP server** | `{"command": "npx", "args": ["-y", "github:nimb-ou/App", "mcp"]}` |
| In a browser | **Web app** | open [`web/dist/baton.html`](web/dist/baton.html) (one file, works offline) and drop a file. Nothing is uploaded. |
| In a team / company | **Sinks** | `baton sink <bundle> --to salesforce\|jira\|zendesk\|slack [--post]` |

### Sources

| Input | What it is |
|---|---|
| `https://chatgpt.com/share/<id>` | public ChatGPT share link: fetched once, no login |
| `share.html` | a share page saved from the browser (works when fetching is blocked) |
| `export.zip` / `conversations.json` | ChatGPT **or** Claude account data export (`--pick "<title>"` for one conversation) |
| `*.jsonl` / a directory | Claude Code session log (`baton session latest` finds this project's newest) |
| `messages.json` | any `[{role, content}]` log (OpenAI/Anthropic API style) |

### What a bundle contains

| File | For |
|---|---|
| `HANDOFF.md` | **Start here.** Goal · every prompt verbatim · where it stopped · open threads · reasoning trail · file status · losses · how to continue |
| `PROMPT.md` | one paste-ready block for ChatGPT, Claude, Gemini or any chat that cannot read folders |
| `TRANSCRIPT.md` | everything, in order. Reasoning, tool calls and outputs are folded into `<details>`. |
| `LOSS_AUDIT.md` | what did not transfer, per-file status, integrity root |
| `files/` | rebuilt files: **recovered** (exact), **stale** (exact up to a later unreplayable edit), **lost** (listed, not faked) |
| `replay/` | the source's code cells plus a no-network Docker runner, to regenerate PDFs, ZIPs and similar outputs. Never run automatically. |
| `SKILL.md` · `AGENTS.md` | make the folder itself a "continue this work" skill or agent context |
| `index.html` | offline viewer with search |
| `bundle.json` | the canonical record: [`docs/SPEC.md`](docs/SPEC.md) |
| `sinks/*.json` | optional Salesforce / Jira / Zendesk / Slack payloads |

## CLI

```
baton import <source> [-o dir] [--zip] [--pick text] [--sink jira,slack] [--install-skill] [--no-redact] [--include-hidden]
baton session [latest|<id>]      bundle a Claude Code session from this project
baton inspect <source>           dry run: what would transfer, what would not
baton verify <bundle|zip>        recompute the hash chain (exit 2 if anything was edited)
baton sink <bundle> --to <system> [--post] [--jira-project KEY] [--sf-parent RECORD_ID]
baton mcp                        MCP server over stdio
```

Posting uses environment variables only: `SALESFORCE_INSTANCE_URL`/`SALESFORCE_ACCESS_TOKEN`,
`JIRA_BASE_URL`/`JIRA_EMAIL`/`JIRA_API_TOKEN`/`JIRA_PROJECT`, `ZENDESK_SUBDOMAIN`/`ZENDESK_EMAIL`/`ZENDESK_API_TOKEN`, `SLACK_WEBHOOK_URL`.

## Privacy and safety defaults

- **Local-first.** The CLI, skill and MCP server run on your machine. The web app parses in your browser.
- **Redaction on:** API keys (OpenAI, Anthropic, GitHub, AWS, Google, Slack, Stripe), JWTs, bearer tokens, private keys, passwords in
  assignments, emails, phone numbers and Luhn-valid card numbers. Turn off with `--no-redact`.
- **Private context off:** system prompts, memory, custom instructions and harness reminders are excluded (and counted) unless `--include-hidden` is set.
- **One URL, once:** only the public share link you pass is fetched. There is no crawling and no authentication.
- **No code execution:** replay cells are written, never run. Output paths are sanitised and writes outside the target directory are refused.

## How it is built

TypeScript with no runtime dependencies. Node ≥ 22.18 runs the source directly, and `dist/baton.mjs` is a single-file build for Node ≥ 18.

```
src/core       schema, turbo-stream decoder, SHA-256, ZIP, redaction, hash chain, build pipeline
src/parsers    ChatGPT (share + export), Claude export, Claude Code JSONL, generic logs, format detection
src/recover    file recovery (heredocs, Write/Edit replay, modification tracking) + replay kit
src/render     HANDOFF / PROMPT / TRANSCRIPT / LOSS_AUDIT / SKILL / AGENTS / index.html (safe Markdown)
src/sinks      Salesforce composite, Jira ADF, Zendesk, Slack Block Kit
src/mcp        JSON-RPC stdio server
src/node       fetch, file and zip IO, session discovery, posting
web/           client-side app (built to web/dist/baton.html)
```

```bash
npm install            # dev only: typescript, esbuild, @types/node
npm test               # 64 tests, incl. end-to-end on the real share fixture
npm run typecheck
npm run build          # dist/baton.mjs, skills/baton/scripts/baton.mjs, web/dist/*.html
npm run examples       # regenerate examples/ deterministically
```

## Business model (free to the user)

The person moving their work never pays. Revenue comes from whoever **gains** when work moves:
the receiving AI vendor (verified-migration "switching bounty"), employers (an **AI Work Record** layer that files
conversations into Salesforce, ServiceNow, Jira or Zendesk with redaction, retention and integrity), and platforms that want an "Import from anywhere"
button. Data is never sold. Details are in [`docs/research/04-monetization.md`](docs/research/04-monetization.md) and [`05-business-layer.md`](docs/research/05-business-layer.md).

## Project record

This repo documents its own making. Every prompt, decision and result is kept:

- [`docs/prompts/`](docs/prompts/): the user's prompts, verbatim, with how each was interpreted
- [`docs/journal/`](docs/journal/): timestamped build journal (what was done, bugs found, results)
- [`docs/decisions/`](docs/decisions/): architecture decision records
- [`docs/research/`](docs/research/): market, formats, legal/policy, monetisation, business layer, loss findings (with sources)
- [`examples/this-build-session/`](examples/this-build-session/): **the Claude Code session that built Baton, exported by Baton**

## Roadmap

Browser extension for logged-in chats (same core) · Gemini Takeout parser · Cursor/Codex logs · statically replaying
Python `str.replace` patches · OAuth-managed connectors and retention policies for the business tier · external anchoring of
integrity roots · submitting the bundle format to the Data Transfer Initiative.

License: Apache-2.0. Format spec: CC-BY-4.0.
