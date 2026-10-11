# 02: Source formats: where AI work lives and how to read it

*Findings from hands-on reverse-engineering in this session, plus community documentation. None of these
formats is officially documented by its vendor. Parsers must stay defensive and keep the raw source.*

## A. ChatGPT public share link (`https://chatgpt.com/share/<uuid>`)

**Discovery path (this session):**

1. A plain fetch with an HTML-to-text tool returned only `<title>`. The body is rendered on the client.
2. A raw `curl` with a browser User-Agent returned HTTP 200 and 1.4 MB of HTML.
3. The data sits inside `<script>` tags as
   `window.__reactRouterContext.streamController.enqueue("<JSON-string>")`.
   Two chunks appeared: a 731,900-character payload and a 12-character terminator.
4. The payload is a **React Router turbo-stream** (a flattened, de-duplicated graph):
   - The top level is a JSON array.
   - Objects are encoded as `{"_<keyIndex>": <valueIndex>, ...}`. Keys and values are **indices into the same
     array**, which de-duplicates repeated strings.
   - Negative integers are sentinels (`-5` = undefined, `-7` = null, and so on).
   - Arrays hold value indices. A few special arrays start with a tag such as `"D"` (Date) or `"P"` (Promise).
5. After decoding, `loaderData["routes/share.$shareId.($action)"].serverResponse.data` has the same shape as
   one conversation in the official export: `title`, `create_time`, `mapping{}`, `current_node`, `model`,
   `safe_urls[]` and more.

**Message tree:** `mapping[id] = {id, parent, children[], message}`. Walking `current_node → parent → … → root`
and reversing gives the visible branch. In this fixture, 406 nodes formed one linear chain.

**`content.content_type` values seen:**

| content_type | role | Meaning | Text location |
|---|---|---|---|
| `text` | user / assistant / tool / system | Prose | `parts[]` (strings) |
| `thoughts` | assistant | **Reasoning summaries** | `thoughts[] {summary, content}` |
| `reasoning_recap` | assistant | "Worked for 24m 59s" | `content` |
| `code` | assistant → `container.exec` | **Executed shell or Python** | `text` |
| `model_editable_context` | assistant (hidden) | Memory snapshot | `model_set_context` (empty here) |

**Rich rendering:** assistant text can contain GenUI JSX (`<box>`, `<grid>`, `<Cite refs={…}/>`,
`<AsyncImage/>`). A clean Markdown fallback is stored at `metadata.model_dil_v2.fallbackMarkdown`, with
private-use-area entity markers: `U+E200 name U+E202 arg … U+E201` (for example `cite`, `image_group`).

**Tool routing:** `recipient` on assistant messages: `web.run`, `container.exec`, `functions.exec`,
`api_tool.call_tool` (connectors such as GitHub, Canva and Hugging Face) and opaque ids such as `q7dr546` (memory).
`metadata.reasoning_title(s)` carries a human label such as *"Searching OpenAlex…"*.

**Redaction in public shares:** every tool output in the fixture reads `"The output of this plugin was redacted."`
This held for all 52 container execs, 52 API-tool calls, 33 `functions.exec`, 20 image opens and 6 web runs.
`functions.exec` *inputs* were also blank. Details are in [06-loss-audit-findings.md](06-loss-audit-findings.md).

## B. ChatGPT official data export (`conversations.json` in the account ZIP)

A JSON **array** of conversation objects with the same `mapping` / `current_node` shape as A
([community](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144),
[levelup](https://levelup.gitconnected.com/your-chatgpt-history-is-a-tree-not-a-transcript-2026-5660ceb301d4)).
Edits and regenerations create **branches**. Discarded branches stay in `mapping`. Open WebUI detects the
format by the presence of a `mapping` key ([Open WebUI docs](https://docs.openwebui.com/features/chat-conversations/data-controls/import-export)).
**Decision:** A and B share one normaliser.

## C. Claude.ai official data export (`conversations.json`)

An array of `{uuid, name, created_at, updated_at, chat_messages[]}`. Each message has `sender` (`human` or `assistant`),
`text`, `created_at`, and in newer exports a `content[]` array of typed blocks (`text`, `thinking`, `tool_use`,
`tool_result`). Attachments appear as `attachments[]` (with `extracted_content`) and `files[]`.
Memory is **not** included ([saveai.net](https://saveai.net/blog/how-to-export-claude-conversations)).
**Decision:** prefer `content[]` blocks when present and fall back to `text`.

## D. Claude Code session log (`~/.claude/projects/<cwd-slug>/<session-id>.jsonl`)

One JSON object per line. Records with `type: "user" | "assistant"` carry `message.content`, which is either a string or an
array of blocks (`text`, `thinking`, `tool_use{name,input}`, `tool_result{tool_use_id, content}`, `image`).
Other record types (`summary`, `system`, attachments, file-history snapshots) carry metadata.
`isSidechain` marks sub-agent traffic. `cwd`, `gitBranch`, `version` and `timestamp` are present on most lines.
**Decision:** this is the dogfood source, because Baton exports the session that built Baton.

## E. Rejected or deferred sources (v1)

| Source | Reason |
|---|---|
| Gemini (Takeout "My Activity" HTML) | Activity log, not threaded conversations. Needs HTML scraping. Deferred. |
| Logged-in ChatGPT `backend-api/conversation/{id}` | Needs the user's session token. That belongs in a browser extension running in the user's own session, not a server. Roadmap. |
| Cursor / Copilot / Codex local logs | SpecStory covers these. The generic Markdown and JSONL parser handles them for now. Roadmap. |

## F. Design consequences

1. **Keep the raw input** inside the bundle (`source/`), so better parsers can re-run later without loss.
2. **Normalise to events, not just messages.** One turn holds prose, reasoning, tool calls and tool results.
3. **Record provenance per field** (`redacted_by_source`, `recovered_from`), so the loss audit is computed, not guessed.
