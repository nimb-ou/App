# ADR-002: Capture from within: Baton as the context bus between AIs

- **Status:** Accepted, 2026-10-11 (supersedes the "file in, file out" framing of ADR-001; ADR-001's core stays)
- **Trigger:** [prompt 004](../prompts/004-capture-from-within.md)

## Decision

Baton moves from a converter to a **relay embedded in every AI**, with three capture positions that share one bundle format
(`baton.bundle/v1`, extended with binary artifacts) and one transfer fabric.

```
           ┌────────────── capture from within ──────────────┐
 web chats │ A. Browser extension (ChatGPT, Claude, Gemini, …)│── tab-to-tab inject ──▶ any web chat
           │    full JSON + tool outputs + generated files    │
 any model │ B. Remote MCP relay: baton_checkpoint/pickup     │── pickup code ───────▶ any MCP client
 agents    │ C. Local MCP + hooks (PreCompact, SessionEnd)    │── ~/.baton/store ────▶ any local agent
           └──────────────────────┬───────────────────────────┘
                                  ▼
                 Relay hub (self-hostable): store · /h/<code> viewer · REST · MCP
                                  ▼
                 Sinks: Salesforce · Jira · Zendesk · Slack (ADR-001)
```

## Components (this iteration)

| Component | Path | Notes |
|---|---|---|
| Relay store | `src/relay/store.ts` | File-backed and versioned. Each checkpoint is hash-chained, with codes `BTN-XXXX-XXXX`, TTL and size caps. |
| Relay server | `src/relay/server.ts`, `baton relay` | MCP over Streamable HTTP at `/mcp`, REST at `/api/handoffs`, viewer at `/h/<code>`, zip at `/h/<code>.zip`. Zero dependencies. |
| Relay MCP tools | `src/relay/tools.ts` | `baton_checkpoint`, `baton_send`, `baton_pickup`, `baton_get_file`, `baton_list`. Shared by the remote server and the local stdio server. |
| Browser extension | `extension/` | MV3. Adapters for ChatGPT (backend conversation JSON + sandbox file downloads), Claude (org conversation JSON + artifacts and files), Gemini and other sites (DOM). In-page panel: capture, save zip, copy prompt, **Continue in…** (tab-to-tab injection), **Send to relay**. |
| Claude Code hooks | `hooks/hooks.json`, `baton hook` | Auto-bundle on `PreCompact` and `SessionEnd` into `.baton/sessions/`. |
| Pickup CLI | `baton pickup <code>`, `baton send <bundle>` | For terminals. |

## Format change: binary artifacts

`BatonArtifact.encoding?: 'utf8' | 'base64'`. Captured PDFs, images and ZIPs ship as bytes under `files/`. The hash is over the decoded bytes.
New artifact status: none. Captured files are `recovered`, with `note: "captured from source"`.

## Alternatives rejected

- **Scraping the DOM everywhere.** It misses tool outputs and files. Used only as a fallback.
- **A hosted-only SaaS relay.** Vendor connectors need a public URL, so hosting is offered, but the relay must stay self-hostable for trust.
- **Bundling a cloud LLM to summarise.** The model doing the work writes the checkpoint. That is better context at zero inference cost.

## Risks

- Internal web endpoints change. Adapters are small, versioned and fall back to DOM capture. Tests run against recorded fixtures.
- Relay data sensitivity. Mitigated by TTL, codes, bearer token, E2E for extension uploads, and redaction on by default.
