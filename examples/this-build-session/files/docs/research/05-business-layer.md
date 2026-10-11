# 05: The same problem in business software, and Baton as a layer

## The business version of "I can't move my ChatGPT work"

| Scenario | Today | With the Baton layer |
|---|---|---|
| **AI agent → human escalation** (support) | Agentforce passes session ID, contact, escalation reason and a summary into Omni-Channel ([Salesforce](https://www.salesforce.com/blog/agent-to-human-handoff/), [Towards AI](https://pub.towardsai.net/one-brain-every-touchpoint-building-adaptive-multi-channel-agentforce-architectures-d3c16af9b4c7)). This only works *inside* Salesforce's own agent. | Any bot (Intercom Fin, a custom GPT, a Claude agent) emits a Baton bundle. The sink writes a **Case + Task + transcript note** with the loss audit and next steps attached. |
| **Rep researches an account in a personal ChatGPT** | Insights stay in the chat, where the CRM never sees them (shadow AI) | Rep pastes the share link into a Slack command or browser button. A redacted handoff is attached to the **Opportunity**. |
| **Engineer designs in a chat, implements in an IDE agent** | Copy-paste and lost context. "Teleport from chat" is a requested Claude Code feature. | `baton import <link>` → `HANDOFF.md` + Skill. The IDE agent continues with recovered files. |
| **Incident triage in AI chat → ITSM** | A manual summary in the ticket | A **Jira / ServiceNow issue** created with timeline, commands run (from tool calls) and an integrity hash |
| **Compliance / legal hold** | Archive-only capture (Smarsh) in regulated finance | A hash-chained bundle per conversation, retention-tagged, exportable to the archive or e-discovery |
| **Consultant → client delivery** | A PDF report. The *method* is lost. | A shareable HTML handoff with prompts, reasoning and artifacts (proof of work) |

## Architecture of the layer

```
 sources                          core (open, zero-dep)                     sinks
 ─────────                        ──────────────────────                    ─────
 ChatGPT share / export  ──┐      parse → normalise (events)                Markdown / HTML / ZIP
 Claude export           ──┤──▶   redact (PII, secrets)          ──▶        Agent Skill / AGENTS.md
 Claude Code JSONL       ──┤      recover files from exec code              MCP tools (any agent)
 generic MD / JSON       ──┘      loss audit + SHA-256 hash chain           Salesforce · Jira · Zendesk · Slack
```

**Sinks are payload builders, not hard dependencies.** v1 emits API-ready JSON for each system:
Salesforce composite request, Jira REST v3 issue with ADF body, Zendesk ticket and Slack Block Kit. They can be
POSTed by the CLI (`--post` with env credentials) or by the customer's own middleware (MuleSoft, Workato, Zapier).
This keeps the open core free of vendor SDKs and lets enterprises keep credentials in their own systems.

## Why a "layer" and not a CRM app

- The value is **cross-system**: one normalised record feeds CRM, ITSM, chat and archive.
- Lock-in risk is reversed. Baton is the neutral switch, so customers can change AI vendors *or* CRMs.
- It mirrors how Segment became the layer between event sources and destinations: **sources × destinations** is a
  quadratic integration problem that a canonical format reduces to linear.

## Enterprise tier, beyond v1 (roadmap)

- Org policy packs: redaction rules, retention, legal hold and destination allow-lists
- WORM storage or external anchoring of root hashes (tamper-*proof*, not only tamper-evident)
- SSO/SCIM, audit dashboards, DLP integrations
- Managed connectors with OAuth (Salesforce Connected App, Atlassian OAuth 2.0, Zendesk OAuth)
