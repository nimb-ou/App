// Detect the format of an input and dispatch to the right parser.

import type { ParsedConversation, SourceKind } from '../core/schema.ts';
import { isRecord } from '../core/util.ts';
import { parseChatGPTExport, parseChatGPTShareHtml, parseChatGPTTurboStream } from './chatgpt.ts';
import { parseClaudeCodeJsonl, parseClaudeExport } from './claude.ts';
import { looksLikeMessages, parseMessagesLog } from './generic.ts';

export interface DetectResult {
  kind: SourceKind | 'baton-bundle';
  reason: string;
}

export function detectFormat(text: string, filename = ''): DetectResult {
  const t = text.trimStart();
  const name = filename.toLowerCase();
  if (t.startsWith('<') || name.endsWith('.html') || name.endsWith('.htm')) {
    if (t.includes('streamController.enqueue')) return { kind: 'chatgpt-share', reason: 'HTML with React Router stream (ChatGPT share page)' };
    return { kind: 'unknown', reason: 'HTML without a recognised conversation payload' };
  }
  if (name.endsWith('.jsonl') || isJsonl(t)) {
    if (/"type"\s*:\s*"(?:user|assistant|summary)"/.test(t.slice(0, 200000)) && /"sessionId"|"parentUuid"/.test(t.slice(0, 200000))) {
      return { kind: 'claude-code', reason: 'JSON Lines with Claude Code session records' };
    }
  }
  if (t.startsWith('[{"_') || /^\[\{"_\d+":/.test(t)) return { kind: 'chatgpt-share', reason: 'raw turbo-stream payload' };
  let json: unknown;
  try {
    json = JSON.parse(t);
  } catch {
    return { kind: 'unknown', reason: 'not JSON, JSONL or a recognised HTML page' };
  }
  const first = Array.isArray(json) ? json[0] : json;
  if (isRecord(first)) {
    if (first.schema === 'baton.bundle/v1') return { kind: 'baton-bundle', reason: 'already a Baton bundle' };
    if (isRecord(first.mapping)) return { kind: 'chatgpt-export', reason: 'conversation objects with a `mapping` tree (ChatGPT export)' };
    if (Array.isArray(first.chat_messages)) return { kind: 'claude-export', reason: 'conversation objects with `chat_messages` (Claude export)' };
  }
  if (looksLikeMessages(json)) return { kind: 'openai-messages', reason: '[{role, content}] message list' };
  return { kind: 'unknown', reason: 'JSON, but no known conversation shape' };
}

function isJsonl(t: string): boolean {
  const lines = t.split('\n', 3).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.every((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
}

/** Parse any supported input into one or more conversations. */
export function parseAny(text: string, filename = '', url?: string): ParsedConversation[] {
  const d = detectFormat(text, filename);
  switch (d.kind) {
    case 'chatgpt-share':
      return [text.trimStart().startsWith('<') ? parseChatGPTShareHtml(text, url) : parseChatGPTTurboStream(text, url)];
    case 'chatgpt-export':
      return parseChatGPTExport(JSON.parse(text));
    case 'claude-export':
      return parseClaudeExport(JSON.parse(text));
    case 'claude-code':
      return [parseClaudeCodeJsonl(text)];
    case 'openai-messages':
      return [parseMessagesLog(JSON.parse(text), filename.replace(/\.[^.]+$/, '') || undefined)];
    default:
      throw new Error(`Unsupported input${filename ? ` (${filename})` : ''}: ${d.reason}`);
  }
}
