// Claude.ai account export (conversations.json) and Claude Code session logs (*.jsonl).

import type { BatonEvent, LossItem, ParsedConversation } from '../core/schema.ts';
import { asString, epochToIso, isRecord } from '../core/util.ts';

type Rec = Record<string, unknown>;
type DraftEvent = Omit<BatonEvent, 'seq' | 'hash'>;

// ───────────────────────────── claude.ai export ─────────────────────────────

export function parseClaudeExport(json: unknown): ParsedConversation[] {
  const list = Array.isArray(json) ? json : isRecord(json) ? [json] : [];
  return list.filter((c) => isRecord(c) && Array.isArray(c.chat_messages)).map((c) => parseClaudeConversation(c as Rec));
}

function parseClaudeConversation(conv: Rec): ParsedConversation {
  const events: DraftEvent[] = [];
  const attachments: { path: string; content: string; note?: string }[] = [];
  let filesWithoutContent = 0;
  let n = 0;

  for (const m of conv.chat_messages as Rec[]) {
    const role = m.sender === 'human' ? 'user' : 'assistant';
    const time = epochToIso(m.created_at);
    const baseId = asString(m.uuid) || `m${++n}`;
    const blocks = Array.isArray(m.content) ? (m.content as Rec[]) : [];
    if (blocks.length) {
      blocks.forEach((b, i) => pushBlock(events, b, `${baseId}-${i}`, role, time));
    } else if (asString(m.text).trim()) {
      events.push({ id: baseId, kind: 'message', role, time, text: asString(m.text) });
    }
    for (const a of (Array.isArray(m.attachments) ? m.attachments : []) as Rec[]) {
      const name = asString(a.file_name) || 'attachment.txt';
      const extracted = asString(a.extracted_content);
      events.push({ id: `${baseId}-att-${name}`, kind: 'attachment', role: 'user', time, text: `Attached file: ${name}`, meta: { size: a.file_size, type: a.file_type } });
      if (extracted) attachments.push({ path: `attachments/${name}`, content: extracted, note: 'text extracted by Claude at upload time' });
      else filesWithoutContent++;
    }
    for (const f of (Array.isArray(m.files) ? m.files : []) as Rec[]) {
      filesWithoutContent++;
      events.push({ id: `${baseId}-file-${asString(f.file_name)}`, kind: 'attachment', role: 'user', time, text: `Attached file: ${asString(f.file_name) || 'file'}` });
    }
  }

  const loss: LossItem[] = [];
  if (filesWithoutContent) loss.push({ category: 'user-attachments', count: filesWithoutContent, severity: 'warn', detail: 'Uploaded files without extracted text (images, binaries) are referenced by name only.' });
  loss.push({ category: 'memory', count: 1, severity: 'info', detail: 'Claude exports do not include memory or project knowledge; only conversation messages.' });

  return {
    title: asString(conv.name) || 'Untitled Claude conversation',
    source: { kind: 'claude-export', tool: 'Claude', conversationId: asString(conv.uuid) || undefined, createdAt: epochToIso(conv.created_at), updatedAt: epochToIso(conv.updated_at) },
    events,
    attachments,
    loss,
  };
}

// ───────────────────────────── shared block handling ─────────────────────────────

function pushBlock(events: DraftEvent[], b: Rec, id: string, role: 'user' | 'assistant', time?: string, model?: string): void {
  const type = asString(b.type);
  if (type === 'text') {
    const text = asString(b.text);
    if (text.trim()) events.push({ id, kind: 'message', role, time, model, text });
  } else if (type === 'thinking' || type === 'redacted_thinking') {
    const text = asString(b.thinking);
    events.push({
      id,
      kind: 'reasoning',
      role: 'assistant',
      time,
      model,
      text,
      redactedBySource: !text.trim() || type === 'redacted_thinking' || undefined,
      meta: { granularity: 'full' },
    });
  } else if (type === 'tool_use' || type === 'server_tool_use') {
    const input = b.input;
    const name = asString(b.name) || 'tool';
    const args = FILE_TOOLS.has(name) && isRecord(input) ? input : undefined;
    events.push({ id, kind: 'tool_call', role: 'assistant', time, model, text: describeToolCall(name, input), tool: { name, callId: asString(b.id) || undefined, input: toolInputText(name, input), language: toolLang(name), args } });
  } else if (type === 'tool_result' || type.endsWith('_tool_result')) {
    const text = toolResultText(b.content);
    events.push({ id, kind: 'tool_result', role: 'tool', time, text, tool: { name: asString(b.name) || 'tool', callId: asString(b.tool_use_id) || undefined }, meta: b.is_error ? { isError: true } : undefined });
  } else if (type === 'image' || type === 'document') {
    events.push({ id, kind: 'attachment', role, time, text: `*[${type} attachment, binary content not included]*` });
  }
}

function describeToolCall(name: string, input: unknown): string {
  if (!isRecord(input)) return name;
  const hint = input.description ?? input.file_path ?? input.path ?? input.query ?? input.url ?? input.pattern ?? input.command;
  return hint ? `${name}: ${asString(hint).split('\n')[0].slice(0, 160)}` : name;
}

// Tools whose structured args drive file recovery (see recover/artifacts.ts).
const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'artifacts', 'create_file', 'str_replace']);

function toolInputText(name: string, input: unknown): string {
  if (isRecord(input)) {
    if ((name === 'Bash' || name === 'bash_tool') && typeof input.command === 'string') return input.command;
    if (name === 'artifacts') return `${asString(input.command)} ${asString(input.id)}${input.title ? ` "${asString(input.title)}"` : ''}  (${asString(input.content || input.new_str).length} chars → recovered file)`;
    if (name === 'create_file') return `${asString(input.path)}  (${asString(input.file_text).length} chars → recovered file)`;
    // File bodies live in tool.args and are recovered as artifacts; keep the display compact.
    if (name === 'Write' && typeof input.content === 'string') return `${asString(input.file_path)}  (${input.content.length} chars → recovered file)`;
    if (name === 'Edit') return `${asString(input.file_path)}  (edit: ${asString(input.old_string).length} → ${asString(input.new_string).length} chars)`;
  }
  return asString(input);
}

function toolLang(name: string): string | undefined {
  if (name === 'Bash' || name === 'bash_tool') return 'bash';
  return 'json';
}

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return asString(content);
  return (content as Rec[])
    .map((c) => {
      if (c.type === 'text') return asString(c.text);
      if (c.type === 'image') return '*[image output]*';
      if (c.type === 'tool_reference') return `(tool loaded: ${asString(c.tool_name)})`;
      return asString(c);
    })
    .join('\n');
}

// ───────────────────────────── Claude Code JSONL ─────────────────────────────

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

export function parseClaudeCodeJsonl(text: string): ParsedConversation {
  const events: DraftEvent[] = [];
  let title = '';
  let sessionId: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let model: string | undefined;
  let firstTime: string | undefined;
  let lastTime: string | undefined;
  let reminders = 0;
  let badLines = 0;
  let sidechain = 0;
  const toolNames = new Map<string, string>();

  const lines = text.split('\n');
  lines.forEach((line, li) => {
    if (!line.trim()) return;
    let o: Rec;
    try {
      o = JSON.parse(line) as Rec;
    } catch {
      badLines++;
      return;
    }
    if (o.type === 'summary' && typeof o.summary === 'string' && !title) title = o.summary;
    if (o.type !== 'user' && o.type !== 'assistant') return;
    const msg = o.message;
    if (!isRecord(msg)) return;
    sessionId ??= asString(o.sessionId) || undefined;
    cwd ??= asString(o.cwd) || undefined;
    gitBranch ??= asString(o.gitBranch) || undefined;
    const time = epochToIso(o.timestamp);
    if (time) {
      firstTime ??= time;
      lastTime = time;
    }
    if (o.isSidechain) sidechain++;
    const id = asString(o.uuid) || `l${li}`;
    const role = o.type === 'user' ? 'user' : 'assistant';
    const m = typeof msg.model === 'string' ? msg.model : undefined;
    if (m && !m.startsWith('<')) model = m;
    const isMeta = o.isMeta === true;

    if (typeof msg.content === 'string') {
      const cleaned = msg.content.replace(SYSTEM_REMINDER, () => {
        reminders++;
        return '';
      });
      if (!cleaned.trim()) return;
      const priv = isMeta || /^<(?:command-|local-command-)/.test(cleaned.trim());
      events.push({ id, kind: priv ? 'note' : 'message', role, time, text: cleaned.trim(), hidden: priv || undefined, meta: priv ? { private: isMeta } : o.isSidechain ? { sidechain: true } : undefined });
      return;
    }
    if (!Array.isArray(msg.content)) return;
    (msg.content as Rec[]).forEach((b, i) => {
      if (b.type === 'text' && typeof b.text === 'string') {
        const cleaned = b.text.replace(SYSTEM_REMINDER, () => {
          reminders++;
          return '';
        });
        if (!cleaned.trim()) return;
        b = { ...b, text: cleaned.trim() };
      }
      if (b.type === 'tool_use') toolNames.set(asString(b.id), asString(b.name));
      if (b.type === 'tool_result') b = { ...b, name: toolNames.get(asString(b.tool_use_id)) ?? 'tool', content: stripReminders(b.content, () => reminders++) };
      const before = events.length;
      pushBlock(events, b, `${id}-${i}`, role, time, m);
      if (isMeta) for (let k = before; k < events.length; k++) events[k] = { ...events[k], hidden: true, meta: { ...(events[k].meta ?? {}), private: true } };
      if (o.isSidechain) for (let k = before; k < events.length; k++) events[k] = { ...events[k], meta: { ...(events[k].meta ?? {}), sidechain: true } };
    });
  });

  if (!title) {
    const firstUser = events.find((e) => e.kind === 'message' && e.role === 'user' && e.text.trim().length > 3);
    title = firstUser ? firstUser.text.split('\n')[0].slice(0, 80) : 'Claude Code session';
  }

  const loss: LossItem[] = [];
  const encrypted = events.filter((e) => e.kind === 'reasoning' && e.redactedBySource).length;
  if (encrypted) loss.push({ category: 'reasoning-depth', count: encrypted, severity: 'info', detail: 'Thinking blocks are stored as signatures only (no plaintext) in this log, so reasoning cannot be transferred. Decisions are captured in the visible messages and tool calls.' });
  if (reminders) loss.push({ category: 'harness-context', count: reminders, severity: 'info', detail: 'Harness-injected <system-reminder> blocks were removed (private runtime context, not part of the work).' });
  if (badLines) loss.push({ category: 'unreadable-lines', count: badLines, severity: 'warn', detail: 'Some JSONL lines could not be parsed and were skipped.' });
  if (sidechain) loss.push({ category: 'subagents', count: sidechain, severity: 'info', detail: 'Sub-agent (sidechain) traffic is included and tagged; it may duplicate summaries already in the main thread.' });

  return {
    title,
    source: { kind: 'claude-code', tool: 'Claude Code', conversationId: sessionId, createdAt: firstTime, updatedAt: lastTime, model, cwd, gitBranch },
    events,
    loss,
  };
}

function stripReminders(content: unknown, onHit: () => void): unknown {
  if (typeof content === 'string') return content.replace(SYSTEM_REMINDER, () => (onHit(), ''));
  if (Array.isArray(content)) return content.map((c) => (isRecord(c) && typeof c.text === 'string' ? { ...c, text: c.text.replace(SYSTEM_REMINDER, () => (onHit(), '')) } : c));
  return content;
}
