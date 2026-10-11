// Generic chat-completions style logs: [{role, content}] or {messages: [...]}.
// Covers OpenAI/Anthropic API request logs, LangChain dumps, Open WebUI exports, etc.

import type { BatonEvent, ParsedConversation } from '../core/schema.ts';
import { asString, isRecord } from '../core/util.ts';

type Rec = Record<string, unknown>;

export function looksLikeMessages(json: unknown): boolean {
  const list = isRecord(json) && Array.isArray(json.messages) ? json.messages : json;
  return Array.isArray(list) && list.length > 0 && list.every((m) => isRecord(m) && typeof m.role === 'string' && 'content' in m);
}

export function parseMessagesLog(json: unknown, title = 'Imported conversation'): ParsedConversation {
  const root = isRecord(json) ? json : {};
  const list = (Array.isArray(json) ? json : (root.messages as unknown[])) as Rec[];
  const events: Omit<BatonEvent, 'seq' | 'hash'>[] = [];
  list.forEach((m, i) => {
    const role = m.role === 'user' || m.role === 'assistant' || m.role === 'tool' ? m.role : 'system';
    const id = `m${i + 1}`;
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls as Rec[]) {
        const fn = isRecord(tc.function) ? tc.function : {};
        events.push({ id: `${id}-${asString(tc.id)}`, kind: 'tool_call', role: 'assistant', text: asString(fn.name), tool: { name: asString(fn.name) || 'tool', input: asString(fn.arguments), callId: asString(tc.id), language: 'json' } });
      }
    }
    const content = Array.isArray(m.content)
      ? (m.content as Rec[]).map((c) => (typeof c === 'string' ? c : asString(c.text ?? c))).join('\n')
      : asString(m.content);
    if (!content.trim()) return;
    if (role === 'tool') {
      events.push({ id, kind: 'tool_result', role: 'tool', text: content, tool: { name: asString(m.name) || 'tool', callId: asString(m.tool_call_id) || undefined } });
    } else {
      events.push({ id, kind: role === 'system' ? 'note' : 'message', role, text: content, hidden: role === 'system' || undefined, meta: role === 'system' ? { private: true } : undefined });
    }
  });
  return {
    title: asString(root.title) || title,
    source: { kind: 'openai-messages', tool: 'Chat log', model: asString(root.model) || undefined },
    events,
  };
}
