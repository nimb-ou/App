---
title: Baton — carry the work forward
emoji: 🏏
colorFrom: green
colorTo: yellow
sdk: static
app_file: index.html
pinned: false
---

# Baton

**Carry AI work between tools without pretending the source was complete.** Baton turns a conversation export or public share page into a portable handoff bundle containing the visible transcript, provenance, reconstructed files, and a loss audit.

## Try the browser app

The static app lives in [`web/index.html`](web/index.html) and is shown from the root `index.html`. It parses files locally in your browser and creates a ZIP on your device; it does not upload the conversation. Supported inputs are ChatGPT share-page HTML, ChatGPT `conversations.json`, Claude export JSON, Claude Code JSONL, Markdown, and text. A direct share URL can be fetched by the CLI; browsers generally prevent a static page from fetching another site's share page.

For a local preview, serve the repository root with any static file server and open `/web/`.

## Use the CLI

Requires Node 18 or newer. No npm install or API key is needed.

```sh
node bin/baton.mjs import ./conversation.html --zip
node bin/baton.mjs import "https://chatgpt.com/share/YOUR_SHARE_ID" --out ./handoff.zip --zip
node bin/baton.mjs import ./conversations.json --out ./handoff-folder
```

The ZIP contains:

- `HANDOFF.md` — a short continuation brief
- `conversation.md` — the visible conversation and tool-call records
- `loss-audit.md` — missing outputs, redacted results, excluded branches, and unavailable files detected in the source
- `bundle.json` — normalized messages and field provenance
- `manifest.json` — SHA-256 hashes for the bundle files
- `source/` — the original input, retained unchanged
- `recovered/` — files reconstructed from visible shell heredocs, when possible

To run the MCP server over stdio, configure your MCP client to launch `node /absolute/path/to/src/mcp/server.mjs`. The `baton_import` tool can write a bundle to a chosen local directory. The receiving-agent Skill is in [`skills/baton/SKILL.md`](skills/baton/SKILL.md).

## Connect a work system

`src/sinks/` contains payload builders for Salesforce Cases, Jira Issues, Zendesk tickets, and Slack messages. They produce drafts only; credentials, network delivery, and destination-specific approval remain with the receiving system.

## Trust and limits

- Parsing and recovery operate on the file you choose. The browser app has no upload endpoint.
- ChatGPT public-share HTML uses an undocumented internal stream format. Baton keeps the original source so a future parser can re-read it.
- Public shares can redact tool outputs and omit generated files. Baton reports these gaps; it cannot recover data the source does not contain.
- Visible reasoning summaries are preserved. Hidden chain-of-thought is not exposed or reconstructed.
- Reconstructed shell heredocs are text artifacts only. Baton never executes recovered code.
- The `manifest.json` checks file integrity; it is not a signature or proof of who created the bundle.

## Project notes

The research, product decision, prompts, and build journal live in [`docs/`](docs/). The original public share fixture used to guide the parser is [`fixtures/chatgpt-share-cricket-stumping.html.gz`](fixtures/chatgpt-share-cricket-stumping.html.gz).
