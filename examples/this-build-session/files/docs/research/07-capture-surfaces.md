# 07: Capture surfaces: where Baton can live inside an AI, and what each position sees

*2026-10-11. Platform facts from vendor help pages, plus first-hand findings from v0.1.*

## The four positions

| Position | How Baton gets in | Who sees what | Platforms |
|---|---|---|---|
| **A. In the page** (browser extension) | Content script in the user's logged-in tab, plus a main-world tap on `fetch` | Everything the web app itself receives: full conversation JSON including **tool outputs**, **generated files** (download endpoints), uploads, streamed tokens, branches | chatgpt.com, claude.ai, gemini.google.com (DOM), any chat site via a generic DOM adapter |
| **B. In the model's toolbox** (remote MCP relay) | Added once as a connector, after which the model calls `baton_checkpoint` / `baton_pickup` | What the **model** holds in context: decisions, plan, the latest file contents, tool results it read, its own summary. A share link never contains this. | ChatGPT developer mode (Streamable HTTP or SSE; no-auth or OAuth; write actions confirmed by the user) ([OpenAI](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt), [InfoQ](https://www.infoq.com/news/2025/10/chat-gpt-mcp)). claude.ai and Claude Desktop custom connectors (remote MCP, authless or OAuth, Free plan limited to one) ([Anthropic](https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)) |
| **C. In the agent's runtime** (local MCP + hooks) | stdio MCP server, plus lifecycle hooks (`PreCompact`, `SessionEnd`) that receive `transcript_path` | The **complete local log**, captured automatically **before compaction discards it** | Claude Code (plugin `hooks/hooks.json`, `${CLAUDE_PLUGIN_ROOT}`) ([docs](https://docs.claude.com/en/docs/claude-code/hooks)), Codex, Cursor, Gemini CLI (MCP) |
| **D. After the fact** (v0.1) | Share link / export / log file | Whatever the vendor published | all |

## What each position captures (ChatGPT case, from the cricket fixture)

| Item | Share link (D) | Official export (D) | Extension (A) | MCP relay (B) |
|---|---|---|---|---|
| User prompts | ✅ | ✅ | ✅ | ✅ (model restates them) |
| Final replies | ✅ | ✅ | ✅ | summary |
| Reasoning | summaries | summaries | summaries | the model's own stated rationale |
| Executed code (container.exec) | ✅ | ✅ | ✅ | on request |
| `functions.exec` code | ❌ blank (33) | ✅ | ✅ | ✅ |
| Tool **outputs** | ❌ redacted (163) | ✅ | ✅ | the parts the model saw |
| Generated **files** (PDF, ZIP, app.py) | ❌ dead `sandbox:` links (16) | ❌ | ✅ via the download endpoint while the sandbox is alive | ✅ text files the model can reproduce |
| Content lost to context compaction | ❌ | ❌ | ❌ | ✅ checkpoint taken before it is lost |
| Works with no login on the receiving side | ✅ | ❌ | ✅ (pickup code) | ✅ (pickup code) |

**Conclusion:** no single position is enough. A (extension) captures what the vendor *has*. B (MCP) captures what the
*model knows*, including in vendors where no extension can run (mobile, desktop apps, IDEs). C (hooks) makes capture automatic and
lossless for agents. Baton must unify all of them into one format and one relay.

## Transfer modes ("from within")

1. **Tab-to-tab, no server:** the extension captures in the ChatGPT tab, opens claude.ai, and injects the paste-prompt
   and attaches `HANDOFF.md` plus the recovered files to the composer. Everything stays in the browser.
2. **Pickup code via relay:** any surface sends to the relay and gets a code like `BTN-7F3K-9QXA`. Any other surface
   (MCP `baton_pickup`, the extension, `baton pickup` in a terminal, or a browser at `/h/<code>`) receives the full bundle.
3. **Shared local store:** the local stdio MCP servers in Claude Desktop, Cursor, Codex and Claude Code all read and write
   `~/.baton/store`, so a handoff between two AIs on the same machine needs no server at all.

## Constraints that shape the design

- ChatGPT and claude.ai connectors call **from the vendor's cloud**, so the relay must be publicly reachable over HTTPS.
  That is a deployment step for the owner. The build ships a server, a Dockerfile and setup steps.
- The extension uses **undocumented internal endpoints** (as every exporter does). Adapters must be isolated, fail soft to DOM
  capture, and be easy to update.
- The relay stores **work content**, so: unguessable capability codes, TTL expiry (default 7 days), optional bearer token for
  private hubs, and **end-to-end encryption for extension uploads** (AES-GCM key kept in the URL fragment, never sent to the server).
  MCP uploads cannot be E2E (the model sends plaintext), which is the reason the relay is easy to self-host.
