# 01: Market landscape: moving AI work between tools

*Researched 2026-10-11. Sources are linked inline. Vendor pages are marketing claims unless noted, and
figures should be re-checked before external use.*

## 1. The problem in one line

People do real work inside AI chats: plans, research, code, files, decisions. That work is stuck in
the tool where it happened. Moving it to another assistant, a coding agent, a teammate or a business
system is **manual, lossy and expert-only**.

This session showed it directly. A public ChatGPT share link returned *only its title* to a
standard web fetch. Getting the content out meant reverse-engineering an undocumented stream format. Even
then the source had **redacted every tool output** and kept none of the generated files (see
[06-loss-audit-findings.md](06-loss-audit-findings.md)).

## 2. Who is already here

### 2a. Platform-native "switching" features (2026)

| Player | What moves | What does not | Source |
|---|---|---|---|
| **Claude "Import memory"** (Mar 2026) | A memory summary produced by running a Claude prompt inside the old assistant | Full conversations, files, tool runs. Memories take about 24 h to appear. | [PCWorld](https://pcworld.com/article/3076376/claude-can-now-import-chat-histories-from-chatgpt-and-other-ais.html), [Tom's Guide](https://www.tomsguide.com/ai/you-can-move-your-chatgpt-memory-to-claude-in-60-seconds-heres-how), [Blog du Modérateur](https://www.blogdumoderateur.com/anthropic-facilite-migration-chatgpt-claude/) |
| **Gemini "Import memory / Import chats"** (late Mar 2026) | Memory via prompt, plus chat-history ZIPs from ChatGPT or Claude exports (5 ZIPs/day, 5 GB each) | Not in the UK, Switzerland or EEA. **Uploaded files and images do not transfer.** | [gHacks](https://www.ghacks.net/2026/03/31/google-adds-chatgpt-and-claude-import-tools-to-gemini-for-memory-and-chat-history/), [WinBuzzer](https://winbuzzer.com/2026/03/27/google-gemini-imports-chats-memory-chatgpt-claude-xcxwbn/), [Android Headlines](https://www.androidheadlines.com/2026/03/google-gemini-import-chat-history-memory-how-to.html) |
| **Claude Code `--teleport`** | Claude Code *web* sessions moved to the local CLI | Ordinary claude.ai chats. Moving a chat into Claude Code was requested as a feature ("teleport from chat"). | [claudelog](https://claudelog.com/faqs/what-is-teleport-in-claude-code/), [feature request](https://claudeissues.com/issue/23017-feature-transfer-chat-context-to-claude-code-session-teleport-from-chat) |
| **Official data exports** (ChatGPT, Claude) | Account-wide ZIP with `conversations.json` | Undocumented schema. Claude's export excludes memory, and the download link expires after 24 h. | [OpenAI community](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144), [saveai.net](https://saveai.net/blog/how-to-export-claude-conversations) |

**Read:** the labs now compete to *receive* switchers. The feature they ship moves **memory**, a profile
of the user. It does not move **work state**, meaning what was being built, what was decided, what code
ran and which files exist.

### 2b. Memory-portability start-ups and open source

| Player | Positioning | Notes |
|---|---|---|
| Egoist Machines **AI Passport** | Consumer context layer, approve-to-share | YC-backed, **$3M seed**, launched 2026-10-07 ([GlobeNewswire via Manila Times](https://www.manilatimes.net/2026/10/07/tmt-newswire/globenewswire/egoist-machines-ai-passport-goes-live-today-only-way-to-make-your-personal-context-portable-across-ai-assistants-like-chatgpt-claude-muse-and-gemini-but-still-owned-by-you/2440954)) |
| **Mem0 / OpenMemory** extension | "Universal, portable memory" across ChatGPT, Claude, Perplexity, Grok and Gemini | [mem0.ai](https://mem0.ai/blog/introducing-the-openmemory-chrome-extension) |
| **Walrus Memory** | Portable agent memory (June 2026) | [TechEdgeAI](https://techedgeai.com/walrus-unveils-portable-walrus-memory-for-ai-agents-integrating-claude-chatgpt-gemini-and-openclaw-nemoclaw/) |
| **Context Pack**, Echo, MemoryLake, memx | Memory packs and cross-model memory | [context-pack.com](https://www.context-pack.com/), [echoknows](https://echoknows.com/cross-platform-ai-memory), [Plurality roundup](https://plurality.network/blogs/best-universal-ai-memory-extensions-2026/) |
| **context-use** (OSS CLI), **portable-ai-memory** (OSS) | Turn exports into memory | [onfabric](https://onfabric.substack.com/p/context-use-turn-your-data-exports), [GitHub](https://github.com/chandanpandeys/portable-ai-memory) |

### 2c. Exporters (browser extensions)

AI Chat Exporter (Backrun; freemium, about 7 full exports per month free), AI Exporter (SaveAI), LLM Chat Exporter,
ai.md (OSS, YAML front-matter) and Chatport (MD, PDF, DOCX, JSON, CSV). Sources: [Substack comparison](https://myzservices.substack.com/p/ai-chat-export-tools-ai-exporter),
[AlternativeTo](https://alternativeto.net/software/ai-chat-exporter-extension/), [ai.md](https://addons.mozilla.org/firefox/addon/ai-md/),
[Chatport](https://addons.mozilla.org/en-US/firefox/addon/chatport/), [Backrun](https://backrun.co/blog/ai-chat-exporter-chrome-extension).

**Read:** these produce *documents for humans*. None produces a *continuation package for an agent*. None
audits what the source dropped, and none recovers files.

### 2d. Coding-session history

**SpecStory** saves Cursor, Copilot, Claude Code and Codex sessions as local Markdown. Capture is free;
Cloud Pro is $25/mo and Cloud Team $300/mo ([pricing](https://specstory.com/pricing), [docs](https://docs.specstory.com/specstory/quickstart)).
It is the closest analogue for *IDE agents*. It does not cover consumer chat apps or cross-vendor handoff.

### 2e. Enterprise capture and compliance

**Smarsh** captures ChatGPT Enterprise and Microsoft 365 Copilot prompts, responses and files as records
for SEC 17a-4 / FINRA obligations ([ChatGPT Enterprise](https://www.smarsh.com/channel/chatgpt-enterprise), [Copilot](https://www.smarsh.com/channel/microsoft-365-copliot/)).
Capture of this kind exists for regulated finance, but it is archive-only. It does not *hand off* work.

### 2f. Agent interoperability standards (what we should plug into, not compete with)

- **MCP**: the standard tool and context protocol for agents.
- **Agent Skills / `SKILL.md`**: open standard published by Anthropic (Dec 2025). Reported adopters include
  Codex, Cursor, Copilot and Gemini CLI ([DenserAI](https://denser.ai/blog/agent-skills-guide/), [mcp.directory](https://mcp.directory/blog/cross-agent-skills-cursor-codex-cline-antigravity-gemini-mastra-portability), [spec](https://github.com/agentskills/agentskills)).
- **A2A** (Linux Foundation): more than 150 organisations, in production across major clouds ([LF press](https://linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)).
  It is agent-to-agent *runtime* messaging, not *persisted work handoff*.

## 3. The gap, stated precisely

| Need | Memory tools | Exporters | Platform import | SpecStory | Smarsh | **Baton (this build)** |
|---|---|---|---|---|---|---|
| Move user preferences | ✅ | ❌ | ✅ | ❌ | ❌ | ➖ (not the goal) |
| Full transcript incl. **reasoning** + **tool calls** | ❌ | partial | partial | ✅ (IDE only) | ✅ (archive) | ✅ |
| **Agent-ready continuation brief** (goal, state, next steps) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ `HANDOFF.md` |
| **Loss audit** (what the source dropped) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **File recovery** from executed code | ❌ | ❌ | ❌ (files explicitly dropped) | ❌ | ❌ | ✅ |
| Works from a **public share link**, no login | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Lands in **Claude Code / Codex / Cursor** as a Skill | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Lands in **Salesforce / Jira / Zendesk / Slack** | ❌ | ❌ | ❌ | ❌ | archive only | ✅ |
| Tamper-evident integrity | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ (hash chain) |
| Local-first, free | varies | freemium | ✅ | ✅ capture | ❌ | ✅ |

## 4. Demand signals

- Every major lab shipped switching features within ~30 days of each other (Mar 2026). That is a strong signal
  that **cross-tool movement is a growth lever for the receiver**, which supports a "destination pays" model
  (see [04-monetization.md](04-monetization.md)).
- Shadow AI is widespread: Gartner (Q1 2026) reports 88% of employees with an employer tool also use a personal
  one for work. Verizon DBIR 2026 puts unsanctioned personal access at 67% of AI users ([Deel summary](https://www.deel.com/deel-works/shadow-ai-workplace),
  [CloudEagle on Netskope](https://www.cloudeagle.ai/blogs/the-shadow-ai-economy)). Work done in personal chats is
  **institutional knowledge that never reaches the system of record**. That is the business-layer wedge.
- Policy pressure: the Data Transfer Initiative calls AI assistants a "high priority" portability area and piloted an
  export format with Inflection AI. CDT notes a joint lab standard is unlikely without user and policy pressure ([CDT](https://cdt.org/insights/dont-let-perfect-be-the-enemy-of-portable/),
  [DTI DMA response](https://dtinit.org/assets/DTI-Response-to-DMA-One-Year-Review.pdf)). An **open, neutral format** fills that gap.

## 5. Implication for the build

Do not build "another memory app" or "another exporter". Build the **work-handoff layer**:

1. A neutral, open **bundle format** (transcript + reasoning + tools + files + loss audit + integrity).
2. **Ingest** from where work happens: share links, official exports, coding-agent logs.
3. **Emit** to where work continues: coding agents (Skill, AGENTS.md), people (HTML, MD), and systems of record
   (CRM, ITSM, ticketing, chat).
4. Be **free and local-first** for individuals; monetise destinations and enterprises.
