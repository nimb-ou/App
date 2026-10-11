# Baton

**Carry AI work between assistants, from the inside.**

Share links and exports only carry what a vendor chooses to publish. A ChatGPT share link silently drops every tool output and every
generated file. Baton lives **inside** the assistants instead:

- a **browser extension** in ChatGPT, Claude and Gemini that captures the full conversation the page itself holds: tool outputs,
  sandbox files as real bytes, uploads, and the live response stream
- **MCP tools** any model can call (`baton_checkpoint`, `baton_pickup`), so the AI writes down what it knows (full files, outputs,
  decisions, verbatim prompts) and a *different* AI picks it up by code
- **agent hooks** that snapshot a Claude Code session before context compaction throws it away

Everything lands in one audited format. The handoff brief says what the work is, where it stopped, which files exist, and
**what did not make it**. It can be moved tab-to-tab, by pickup code, through a shared local store, or into Salesforce, Jira, Zendesk or Slack.

```
ChatGPT ─┐  extension: capture in page ──── "Continue in Claude" ─────────▶ fills Claude's composer + attaches files
Claude  ─┤  MCP: baton_checkpoint ─▶ relay (BTN-7F3K-9QXA-2M4P) ─▶ baton_pickup in Cursor / ChatGPT / Gemini CLI
Agents  ─┘  hooks: PreCompact/SessionEnd ─▶ .baton/sessions/ (+ optional relay)
```

What in-page capture gets compared with a share link of the same ChatGPT chat (from [`tests-e2e`](tests-e2e/extension.e2e.mjs) and the real fixture):

| | Share link | Baton, inside the page |
|---|---|---|
| Tool / code outputs | 0 (all redacted) | all |
| Generated files (PDF, ZIP, app.py) | dead `sandbox:` links | exact bytes |
| `functions.exec` code | blank | present |
| Streamed output | not kept | raw stream kept |
| Move to Claude | copy-paste by hand | one click: composer filled, files attached |

**Setup for each AI: [`docs/EMBED.md`](docs/EMBED.md).** Architecture: [ADR-002](docs/decisions/ADR-002-capture-from-within.md).
What each capture position can see: [research 07](docs/research/07-capture-surfaces.md).

## The easy way: one bookmark, one link (nothing to install)

1. Open **<https://baton-relay.nimitjain-248.workers.dev>** and drag the **⚡ Baton** button to your bookmarks bar.
2. On any ChatGPT, Claude or Gemini chat, click it. Baton reads the chat **with your own signed-in browser** and opens a
   **Baton Link** like `…/h/BTN-0NSQ-64G6-3VKJ`.
3. Tap **Continue in Claude / ChatGPT / Gemini**, or paste the link into any AI that can browse and say "continue this".

The same link is a page for you and plain text for the AI. It works for the receiving AI with no connector, extension or account setup.
How the bookmark picks its transport per site, and the real test results: [journal 08](docs/journal/2026-10-11-08-baton-link.md).

## Deeper capture: extension and connectors

1. **Extension (no server):** download [`extension/baton-extension.zip`](https://github.com/nimb-ou/App/raw/claude/laughing-davinci-c048d8/extension/baton-extension.zip),
   unzip, open `chrome://extensions` → Developer mode → **Load unpacked**. A **BATON** button appears on chatgpt.com, claude.ai and gemini.google.com:
   **Capture** → **Continue in Claude / ChatGPT / Gemini**.
2. **Inside the models (pickup codes):** deploy the relay for free with
   [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nimb-ou/App),
   then add its MCP URL as a connector in Claude and in ChatGPT developer mode ([`docs/DEPLOY.md`](docs/DEPLOY.md)).
3. Follow the 20-minute script in **[`docs/TESTING.md`](docs/TESTING.md)**. If something breaks, the panel's **Copy debug report**
   says exactly what (no conversation text included).

### Also works after the fact

When you only have a link or an export, Baton still extracts the most possible and reports the rest:

```
$ npx github:nimb-ou/App import https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388
✓ Cricket Stumping Simulation
  content  8 prompts · 20 replies · 47 reasoning · 133 tool calls
  files    13 recovered · 3 stale · 16 lost
  loss     163 tool-outputs · 81 tool-inputs · 16 files-lost (see LOSS_AUDIT.md)
  → handoffs/cricket-stumping-simulation/HANDOFF.md  (start here)
```

It rebuilds **13 project files byte for byte** from the code that wrote them and lists the 16 it cannot recover instead of faking
them. See [`examples/cricket-stumping/`](examples/cricket-stumping/).

## Use it the way you work

| You are… | Use | How |
|---|---|---|
| In ChatGPT / Claude / Gemini on the web | **Extension** | load `extension/dist` unpacked → **Baton** button in the page |
| Any AI with connectors (ChatGPT dev mode, Claude, Cursor, Codex…) | **Relay MCP** | add `https://<your-relay>/mcp` → say "baton: hand this off" / "baton pickup BTN-…" |
| In Claude Code | **Plugin** (skill + hooks + MCP + `/baton:import`, `/baton:handoff`) | `/plugin marketplace add nimb-ou/App` then `/plugin install baton@baton` |
| Any local MCP client | **Local MCP** (shared `~/.baton/store`, no server) | `{"command": "npx", "args": ["-y", "github:nimb-ou/App", "mcp"]}` |
| In a terminal | **CLI** | `npx github:nimb-ou/App import <url-or-file>` · `send` · `pickup` · `relay` |
| In a browser, no install | **Web app** | [`web/dist/baton.html`](web/dist/baton.html): drop an export or saved page, parsed locally |
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
baton mcp                        MCP server over stdio (file tools + checkpoint/pickup)
baton relay [--port 8787]        relay hub: MCP over HTTP for web AIs, REST, /h/<code> viewer
baton send <bundle> [--relay URL] [--seal]   → pickup code / link (sealed = end-to-end encrypted)
baton pickup <code|link> [-o dir]
baton hook                       Claude Code PreCompact/SessionEnd hook entry
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
src/mcp        MCP protocol (shared) + stdio server
src/relay      checkpoints, store, relay HTTP server, MCP relay tools, AES-GCM sealing, send/pickup client
extension/     MV3 extension: site adapters (ChatGPT, Claude, Gemini, DOM), stream tap, composer injection, panel
src/node       fetch, file and zip IO, session discovery, posting
web/           client-side app (built to web/dist/baton.html)
```

```bash
npm install            # dev only: typescript, esbuild, @types/node
npm test               # 78 unit + integration tests (parsers, recovery, relay, adapters, CLI)
npm run test:e2e       # loads the real extension in Chromium against a mock ChatGPT/Claude
npm run typecheck
npm run build          # dist/baton.mjs, skills/baton/scripts/baton.mjs, web/dist/*.html, extension/dist
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

Chrome Web Store listing · Firefox build · Gemini API-level adapter · mobile share-sheet capture · OAuth for the relay · Gemini Takeout parser · Cursor/Codex logs · statically replaying
Python `str.replace` patches · OAuth-managed connectors and retention policies for the business tier · external anchoring of
integrity roots · submitting the bundle format to the Data Transfer Initiative.

License: Apache-2.0. Format spec: CC-BY-4.0.
