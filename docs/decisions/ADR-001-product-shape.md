# ADR-001: Product shape: an open core with several thin surfaces

- **Status:** Accepted, 2026-10-11
- **Decider:** the build agent, on the user's mandate to "decide skill? app? plugin? something else?"

## Context

The user asked whether the answer is "a skill? app? plugin? something else?" Research (docs/research/01–05)
shows:

1. Work lives in many sources (share links, exports, agent logs) and needs to land in many destinations
   (coding agents, people, business systems).
2. Every destination has its own preferred extension surface: Skills/AGENTS.md for coding agents, MCP for tool-using
   agents, a web page for people, and APIs for CRM and ITSM.
3. Users will only adopt something that is **free, local and one step**.

## Decision

Build **one zero-dependency TypeScript core** and ship it through **five thin surfaces**, all in this repo:

| Surface | For | Why |
|---|---|---|
| **Core library** `src/core` | Developers and platforms (the "enabler") | Parsers, normaliser, redaction, recovery, loss audit, hash chain and renderers in one place, with no runtime deps |
| **CLI** `baton` | Power users, CI, scripts | `baton import <url\|file>` → bundle directory or ZIP |
| **Agent Skill** `skills/baton/SKILL.md` (+ Claude Code plugin manifest) | Claude Code, Codex, Cursor and other Skill-compatible agents | The *receiving* agent runs the import, reads `HANDOFF.md` and continues the work. **It does the summarisation on the user's existing subscription**, so free users cost $0 in inference. |
| **MCP server** `baton mcp` (stdio, JSON-RPC) | Any MCP client | `baton_import`, `baton_handoff`, `baton_recover`, `baton_sink` as tools |
| **Web app** `web/` (single HTML file, client-side only) | Everyone else | Drag-and-drop an export or saved share page. Parsing runs in the browser and nothing is uploaded. Can be hosted free on any static host. |
| **Business sinks** `src/sinks` | Teams and enterprises (the "layer") | Salesforce, Jira, Zendesk and Slack payload builders, with optional POST |

## Alternatives considered

| Option | Why not (alone) |
|---|---|
| Browser extension only | Best UX for logged-in chats, but it cannot be tested here without live accounts, store review blocks iteration, and it does nothing for agents or business systems. **Roadmap item**: it will reuse the same core. |
| Hosted SaaS first | Adds a privacy liability (a server copy of private chats) before product-market fit. Contradicts "free to user". |
| Memory app | Crowded (Claude/Gemini native import, Mem0, AI Passport). It moves preferences, not work. |
| Python package | Fine for research, but TS gives one codebase for CLI, MCP, browser and the future extension. |

## Consequences

- **Implementation update (2026-10-11):** use dependency-free JavaScript ESM for v1, with a Node ≥18 CLI and browser-importable core. This keeps the supported runtime aligned with the available Node 20 environment and lets the static page reuse the same parser without a build step.
- The core avoids Node-only APIs; ZIP writing and CRC32 use small portable implementations. Node-only filesystem, hashing and network code stays in the CLI/MCP adapters.
- The original TypeScript proposal remains a possible library packaging choice after the event format stabilizes; no source transform is required for v1.
