const now = () => new Date().toISOString();

function textFromContent(content = {}) {
  const parts = Array.isArray(content.parts) ? content.parts : [];
  const text = parts.filter((part) => typeof part === "string").join("\n");
  return text || (typeof content.text === "string" ? content.text : "");
}

function blocksFromMessage(message = {}) {
  const content = message.content ?? {};
  const blocks = [];
  const body = textFromContent(content);
  if (body) blocks.push({ type: content.content_type === "code" ? "code" : "text", text: body });
  for (const thought of content.thoughts ?? []) {
    const summary = thought?.summary ?? thought?.content;
    if (typeof summary === "string" && summary.trim()) blocks.push({ type: "reasoning_summary", text: summary });
  }
  const recipient = message.recipient && message.recipient !== "all" ? message.recipient : null;
  if (recipient) blocks.push({ type: "tool_call", name: recipient, input: body });
  return blocks;
}

function roleFromAuthor(author = {}) {
  if (["user", "assistant", "system", "developer"].includes(author.role)) return author.role;
  if (author.role === "tool") return "tool";
  return author.name ? "tool" : "unknown";
}

function normalizeMapping(conversation, sourceKind) {
  const mapping = conversation.mapping ?? {};
  const chain = [];
  let cursor = conversation.current_node;
  const seen = new Set();
  while (cursor && mapping[cursor] && !seen.has(cursor)) {
    seen.add(cursor);
    chain.push(mapping[cursor]);
    cursor = mapping[cursor].parent;
  }
  chain.reverse();
  const messages = chain.flatMap((node) => {
    const message = node.message;
    if (!message) return [];
    const author = message.author ?? {};
    if (author.role === "system" || author.role === "developer") return [];
    return [{
      id: message.id ?? node.id,
      parentId: node.parent ?? null,
      role: roleFromAuthor(author),
      name: author.name ?? null,
      time: message.create_time ?? message.timestamp ?? null,
      blocks: blocksFromMessage(message),
      provenance: { source: sourceKind, sourceMessageId: message.id ?? node.id },
    }];
  });
  return {
    title: conversation.title ?? conversation.name ?? "Imported conversation",
    createdAt: conversation.create_time ?? conversation.created_at ?? null,
    messages,
    sourceMeta: {
      model: conversation.model ?? null,
      messageNodes: Object.keys(mapping).length,
      visibleNodes: chain.length,
      omittedNonUserVisibleNodes: chain.filter((node) => ["system", "developer"].includes(node.message?.author?.role)).length,
      excludedBranchNodes: Math.max(0, Object.keys(mapping).length - chain.length),
      safeUrls: Array.isArray(conversation.safe_urls) ? conversation.safe_urls : [],
    },
  };
}

function normalizeClaude(conversation) {
  const messages = (conversation.chat_messages ?? []).map((message, index) => {
    const contentBlocks = Array.isArray(message.content) ? message.content : [];
    const blocks = [];
    for (const block of contentBlocks) {
      if (typeof block === "string") blocks.push({ type: "text", text: block });
      else if (typeof block?.text === "string") blocks.push({ type: block.type === "thinking" ? "reasoning_summary" : block.type ?? "text", text: block.text });
      else if (block?.type === "tool_use") blocks.push({ type: "tool_call", name: block.name ?? "tool", input: JSON.stringify(block.input ?? {}) });
      else if (block?.type === "tool_result") blocks.push({ type: "tool_result", name: block.name ?? null, text: JSON.stringify(block.content ?? "") });
    }
    if (!blocks.length && typeof message.text === "string") blocks.push({ type: "text", text: message.text });
    for (const attachment of message.attachments ?? []) {
      blocks.push({ type: "attachment", name: attachment.name ?? attachment.file_name ?? "attachment", text: attachment.extracted_content ?? "" });
    }
    return {
      id: message.uuid ?? `claude-${index + 1}`,
      parentId: null,
      role: message.sender === "human" ? "user" : message.sender === "assistant" ? "assistant" : "unknown",
      name: null,
      time: message.created_at ?? null,
      blocks,
      provenance: { source: "claude-export", sourceMessageId: message.uuid ?? null },
    };
  });
  return { title: conversation.name ?? "Imported Claude conversation", createdAt: conversation.created_at ?? null, messages, sourceMeta: {} };
}

export function parseTurboStreamHtml(html) {
  const chunks = [];
  const marker = "streamController.enqueue(";
  let offset = 0;
  while ((offset = html.indexOf(marker, offset)) >= 0) {
    let start = offset + marker.length;
    while (/\s/.test(html[start] ?? "")) start++;
    const quote = html[start];
    if (quote !== '"' && quote !== "'") { offset = start; continue; }
    let end = start + 1;
    let escaped = false;
    for (; end < html.length; end++) {
      const char = html[end];
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === quote) break;
    }
    if (end >= html.length) break;
    const literal = html.slice(start, end + 1);
    try { chunks.push(JSON.parse(literal)); } catch { /* Ignore non-JSON script strings. */ }
    offset = end + 1;
  }
  for (const chunk of chunks) {
    let store;
    try { store = JSON.parse(chunk); } catch { continue; }
    if (!Array.isArray(store)) continue;
    const cache = new Map();
    const sentinels = new Map([[-5, undefined], [-7, null], [-8, false], [-9, true]]);
    const decodeRef = (index, stack = new Set()) => {
      if (typeof index !== "number") return index;
      if (index < 0) return sentinels.has(index) ? sentinels.get(index) : { $sentinel: index };
      if (index >= store.length || stack.has(index)) return null;
      if (cache.has(index)) return cache.get(index);
      const raw = store[index];
      const nextStack = new Set(stack).add(index);
      let result;
      if (Array.isArray(raw)) {
        if (typeof raw[0] === "string" && ["D", "P", "U", "M", "S", "B"].includes(raw[0])) {
          const value = raw.length > 1 ? decodeRef(raw[1], nextStack) : null;
          result = raw[0] === "D" ? { $type: "Date", value } : { $type: raw[0], value };
        } else {
          result = raw.map((item) => typeof item === "number" ? decodeRef(item, nextStack) : item);
        }
      } else if (raw && typeof raw === "object") {
        result = {};
        for (const [encodedKey, valueRef] of Object.entries(raw)) {
          const keyIndex = Number(encodedKey.slice(1));
          const key = store[keyIndex];
          if (typeof key === "string") result[key] = decodeRef(valueRef, nextStack);
        }
      } else result = raw;
      cache.set(index, result);
      return result;
    };
    const root = decodeRef(0);
    const route = root?.loaderData?.["routes/share.$shareId.($action)"];
    const conversation = route?.serverResponse?.data;
    if (conversation?.mapping) return conversation;
    // Some share-page revisions place the conversation under a differently named route.
    const found = [];
    const walk = (value, seen = new Set()) => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if (value.mapping && value.current_node) found.push(value);
      for (const child of Object.values(value)) walk(child, seen);
    };
    walk(root);
    if (found[0]) return found[0];
  }
  throw new Error("No supported ChatGPT share payload was found. Save the share page as HTML or use a ChatGPT data export.");
}

function conversationFromJson(parsed) {
  if (Array.isArray(parsed)) parsed = parsed[0];
  if (parsed?.mapping && parsed?.current_node) return { data: parsed, kind: "chatgpt-export" };
  if (parsed?.chat_messages) return { data: parsed, kind: "claude-export" };
  if (parsed?.conversations && Array.isArray(parsed.conversations)) return conversationFromJson(parsed.conversations[0]);
  return null;
}

function extractRecoveredFiles(messages) {
  const recovered = new Map();
  const heredoc = /(?:^|\n)\s*cat\s+(?:>|>>|-[^\n]*\s)\s*([^\s;]+)\s+<<\s*(['"]?)([A-Z][A-Z0-9_]*)\2\s*\n([\s\S]*?)\n\3(?=\s|;|$)/g;
  for (const message of messages) {
    for (const block of message.blocks) {
      if (!block.text || block.type !== "code") continue;
      for (const match of block.text.matchAll(heredoc)) {
        const sourcePath = match[1].replace(/^['"]|['"]$/g, "");
        const safePath = sourcePath.replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..").slice(-6).join("/");
        if (!safePath) continue;
        const previous = recovered.get(safePath);
        recovered.set(safePath, {
          path: safePath,
          content: match[4],
          sourceMessageId: message.id,
          status: "reconstructed",
          revisions: (previous?.revisions ?? 0) + 1,
          note: previous
            ? "Multiple visible writes were found; this is the latest one. Later edits in the source conversation may still be missing."
            : "Recovered from a visible shell heredoc. Later edits in the source conversation may not be included.",
        });
      }
    }
  }
  return [...recovered.values()];
}

function buildAudit(messages, sourceMeta, recoveredFiles) {
  const calls = messages.flatMap((message) => message.blocks.filter((block) => block.type === "tool_call").map((block) => ({ message, block })));
  const outputBlocks = messages.flatMap((message) => message.blocks.filter((block) => block.type === "tool_result" || message.role === "tool"));
  const visibleText = messages.flatMap((message) => message.blocks.map((block) => block.text ?? "")).join("\n");
  const findings = [];
  if (calls.length > outputBlocks.length) findings.push({ id: "tool-outputs", severity: "warning", count: calls.length - outputBlocks.length, title: "Tool results missing or redacted", detail: "The share includes tool call records, but fewer tool results. Treat results as unknown unless the source provides them." });
  const redactedToolMessages = messages.filter((message) => message.role === "tool" && message.blocks.some((block) => /output of this plugin was redacted|tool output was redacted|result was redacted/i.test(block.text ?? ""))).length;
  if (redactedToolMessages) findings.push({ id: "redacted-tool-outputs", severity: "warning", count: redactedToolMessages, title: "Tool outputs redacted by source", detail: "The source explicitly replaces these tool results with a redaction notice. Baton preserves the notice and does not infer the missing result." });
  const blankFunctions = calls.filter(({ block }) => block.name === "functions.exec" && !block.input.trim()).length;
  if (blankFunctions) findings.push({ id: "blank-exec-inputs", severity: "warning", count: blankFunctions, title: "Blank function inputs", detail: "Some function execution inputs are absent from the source. Files created only inside those calls cannot be reconstructed from this bundle." });
  const reasoningCount = messages.reduce((sum, message) => sum + message.blocks.filter((block) => block.type === "reasoning_summary").length, 0);
  if (reasoningCount) findings.push({ id: "reasoning-summaries", severity: "info", count: reasoningCount, title: "Reasoning summaries preserved", detail: "Visible summaries are included. Private or hidden chain-of-thought is not exposed by the source and is not reconstructed." });
  const deadFiles = [...visibleText.matchAll(/sandbox:\/[^\s)\]]+/g)].length;
  if (deadFiles) findings.push({ id: "sandbox-links", severity: "warning", count: deadFiles, title: "Sandbox file links may not transfer", detail: "The source mentions sandbox files. Their contents are included only when recoverable from visible code or attachments." });
  if (sourceMeta.excludedBranchNodes) findings.push({ id: "branches", severity: "info", count: sourceMeta.excludedBranchNodes, title: "Non-current branches omitted from transcript", detail: "The conversation contains alternate or abandoned message nodes; the main visible path is shown." });
  if (sourceMeta.omittedNonUserVisibleNodes) findings.push({ id: "non-user-visible-messages", severity: "info", count: sourceMeta.omittedNonUserVisibleNodes, title: "Non-user-visible instructions omitted", detail: "System and developer messages are not shown in the transcript. They remain in the preserved source file." });
  if (recoveredFiles.length) findings.push({ id: "recovered-files", severity: "info", count: recoveredFiles.length, title: "Files reconstructed from code", detail: "These files were recovered from visible shell heredocs. Review their provenance and stale-state note before use." });
  return findings;
}

export function importConversation({ text, name = "conversation.txt", sourceUrl = null }) {
  let normalized;
  const trimmed = text.trim();
  if (/<html[\s>]/i.test(trimmed) || trimmed.includes("streamController.enqueue")) {
    const data = parseTurboStreamHtml(text);
    normalized = { ...normalizeMapping(data, "chatgpt-share"), sourceKind: "chatgpt-share" };
  } else {
    let parsed = null;
    try { parsed = JSON.parse(trimmed); } catch { /* Try JSONL and plain text below. */ }
    const jsonConversation = parsed && conversationFromJson(parsed);
    if (jsonConversation?.kind === "chatgpt-export") normalized = { ...normalizeMapping(jsonConversation.data, jsonConversation.kind), sourceKind: jsonConversation.kind };
    else if (jsonConversation?.kind === "claude-export") normalized = { ...normalizeClaude(jsonConversation.data), sourceKind: jsonConversation.kind };
    else if (trimmed.split("\n").filter(Boolean).every((line) => line.startsWith("{") && line.endsWith("}"))) {
      const records = trimmed.split("\n").filter(Boolean).map((line) => JSON.parse(line));
      const messages = records.filter((row) => row.type === "user" || row.type === "assistant").map((row, index) => {
        const payload = row.message ?? {};
        const content = payload.content;
        const blocks = [];
        if (typeof content === "string") blocks.push({ type: "text", text: content });
        else if (Array.isArray(content)) for (const part of content) {
          if (part.type === "text") blocks.push({ type: "text", text: part.text ?? "" });
          else if (part.type === "thinking") blocks.push({ type: "reasoning_summary", text: part.thinking ?? "" });
          else if (part.type === "tool_use") blocks.push({ type: "tool_call", name: part.name ?? "tool", input: JSON.stringify(part.input ?? {}) });
          else if (part.type === "tool_result") blocks.push({ type: "tool_result", name: null, text: JSON.stringify(part.content ?? "") });
        }
        return { id: row.uuid ?? `jsonl-${index + 1}`, parentId: null, role: row.type, name: null, time: row.timestamp ?? null, blocks, provenance: { source: "claude-code-jsonl", sourceMessageId: row.uuid ?? null } };
      });
      normalized = { title: name.replace(/\.[^.]+$/, ""), createdAt: null, messages, sourceMeta: {}, sourceKind: "claude-code-jsonl" };
    } else if (typeof trimmed === "string" && trimmed) {
      normalized = { title: name.replace(/\.[^.]+$/, "") || "Imported notes", createdAt: null, messages: [{ id: "source-text", parentId: null, role: "user", name: null, time: null, blocks: [{ type: "text", text }], provenance: { source: "plain-text" } }], sourceMeta: {}, sourceKind: "plain-text" };
    }
  }
  if (!normalized?.messages) throw new Error("This file does not contain a supported conversation.");
  const recoveredFiles = extractRecoveredFiles(normalized.messages);
  const bundle = {
    format: "baton.bundle",
    version: "1.0.0",
    importedAt: now(),
    title: normalized.title,
    createdAt: normalized.createdAt,
    source: { kind: normalized.sourceKind, name, url: sourceUrl, keptAs: `source/${name.replace(/[^A-Za-z0-9._-]/g, "_")}` },
    sourceMeta: normalized.sourceMeta ?? {},
    messages: normalized.messages,
    recoveredFiles,
    lossAudit: buildAudit(normalized.messages, normalized.sourceMeta ?? {}, recoveredFiles),
  };
  return bundle;
}

export function renderConversationMarkdown(bundle) {
  const lines = [`# ${bundle.title}`, "", `Imported from ${bundle.source.kind} on ${bundle.importedAt}.`, "The `source/` folder contains the original input.", ""];
  for (const message of bundle.messages) {
    lines.push(`## ${message.role}${message.name ? ` · ${message.name}` : ""}${message.time ? ` · ${message.time}` : ""}`, "");
    for (const block of message.blocks) {
      if (block.type === "code") lines.push("```text", block.text, "```");
      else if (block.type === "tool_call") lines.push(`**Tool call: ${block.name}**`, "", "```text", block.input || "[input missing]", "```", "");
      else if (block.type === "tool_result") lines.push(`**Tool result${block.name ? `: ${block.name}` : ""}**`, "", block.text, "");
      else if (block.type === "reasoning_summary") lines.push(`> Reasoning summary: ${block.text}`, "");
      else if (block.type === "attachment") lines.push(`**Attachment: ${block.name}**`, "", block.text || "[attachment content unavailable]", "");
      else lines.push(block.text ?? "", "");
    }
  }
  return lines.join("\n");
}

export function renderHandoffMarkdown(bundle) {
  const warnings = bundle.lossAudit.filter((finding) => finding.severity === "warning");
  const lines = [
    `# Handoff: ${bundle.title}`, "",
    "This bundle carries the visible conversation, the untouched source file, reconstructed artifacts, and an explicit loss audit.", "",
    "## Source", "",
    `- Format: ${bundle.source.kind}`,
    `- Imported: ${bundle.importedAt}`,
    `- Original file: \`${bundle.source.keptAs}\``,
    `- Visible messages: ${bundle.messages.length}`,
    `- Reconstructed files: ${bundle.recoveredFiles.length}`,
    "", "## Important gaps", "",
    ...(warnings.length ? warnings.map((finding) => `- **${finding.title} (${finding.count})** — ${finding.detail}`) : ["- No missing items detected by the available source signals."]),
    "", "## Continue the work", "",
    "1. Read `conversation.md` for the visible transcript and `loss-audit.md` for known gaps.",
    "2. Review `recovered/` files before use; the source may contain later edits that are not represented.",
    "3. Treat every absent tool output or linked file as unknown. Do not claim it was recovered.",
    "4. Continue from the last user request in the transcript and keep new outputs in this bundle.",
    "", "## Files", "",
    "- `bundle.json` — normalized messages and provenance",
    "- `conversation.md` — readable transcript",
    "- `loss-audit.md` — what the source omitted or redacted",
    "- `source/` — original input, preserved byte-for-byte by the importer",
    "- `recovered/` — artifacts reconstructed from visible code, when available",
  ];
  return lines.join("\n");
}

export function renderAuditMarkdown(bundle) {
  const lines = [`# Loss audit: ${bundle.title}`, "", `Source: ${bundle.source.kind}. Findings are computed from visible records; they do not imply that an absent item never existed.`, ""];
  if (!bundle.lossAudit.length) lines.push("No loss signals were detected.");
  for (const finding of bundle.lossAudit) lines.push(`## ${finding.severity.toUpperCase()}: ${finding.title} (${finding.count})`, "", finding.detail, "");
  return lines.join("\n");
}
