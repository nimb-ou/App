// Pasted chat text: what you get from "Select all → Copy" in an AI app, or a hand-labelled transcript.
// Works on phones, where bookmarks and extensions don't. Speaker labels are taken from the real copy formats
// (fixtures/pasted/): ChatGPT "You said:" / "ChatGPT said:", Gemini "You said <text>" (+ a duplicate line) / "Gemini said".
// Falls back to "User:" / "Assistant:" style labels, then to one unlabelled block. The app chrome around a
// select-all copy (menus, "Sign in", disclaimers) is dropped.

import type { BatonEvent, ParsedConversation } from '../core/schema.ts';

type Role = 'user' | 'assistant';
type Draft = Omit<BatonEvent, 'seq' | 'hash'>;

const SAID = /^(you|chatgpt|gemini|claude|copilot|perplexity|deepseek|grok|meta ai|mistral|le chat)\s+said:?\s*(.*)$/i;
const LABEL = /^\s*(?:\*\*)?(user|human|me|you|q|question|assistant|ai|a|answer|chatgpt|gpt|claude|gemini|bard|copilot|bot|model)(?:\*\*)?\s*:(?:\*\*)?\s*(.*)$/i;
const ASSISTANT_NAMES = /^(chatgpt|gemini|claude|copilot|perplexity|deepseek|grok|meta ai|mistral|le chat|assistant|ai|a|answer|gpt|bard|bot|model)$/i;

/** Lines that appear around a select-all copy but are not conversation. Only stripped at the edges of turns. */
const CHROME = /^(?:(?:chatgpt|gemini|claude|copilot) (?:is ai and )?can make mistakes.*|.*can make mistakes\. check important info.*|sign in.*|log in|sign up.*|new chat|share|copy|edit|retry|regenerate|report conversation|get (?:the )?gemini app|subscriptions|for business|about gemini|images|flash(?:-lite)?|pro|thinking|show thinking|conversation with gemini|this is a copy of a shared chatgpt chat.*|today(?: \d.*)?|yesterday|\d{1,2}:\d{2}\s?(?:am|pm)?|voice|search|tools|ask anything|message chatgpt|reply to claude.*|how can i help you today\??|sources)$/i;

export interface PastedTurn {
  role: Role;
  text: string;
}

const nextNonEmpty = (lines: string[], i: number): string => {
  for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return lines[j].trim();
  return '';
};

function splitBy(lines: string[], classify: (line: string, i: number) => { role: Role; inline: string } | null): PastedTurn[] {
  const turns: PastedTurn[] = [];
  let cur: { role: Role; buf: string[] } | null = null;
  lines.forEach((line, i) => {
    const m = classify(line, i);
    if (m) {
      if (cur) turns.push({ role: cur.role, text: cur.buf.join('\n') });
      cur = { role: m.role, buf: m.inline ? [m.inline] : [] };
    } else if (cur) cur.buf.push(line);
  });
  if (cur) turns.push({ role: (cur as { role: Role }).role, text: (cur as { buf: string[] }).buf.join('\n') });
  return turns;
}

function trimChrome(text: string, edge: 'end' | 'both'): string {
  const ls = text.split('\n');
  const junk = (l: string) => !l.trim() || CHROME.test(l.trim());
  while (ls.length && junk(ls[ls.length - 1])) ls.pop();
  if (edge === 'both') while (ls.length && junk(ls[0])) ls.shift();
  return ls.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Split pasted text into turns. Returns [] when no speaker labels are found. */
export function splitPastedChat(text: string): PastedTurn[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ').split('\n');

  // 1. "X said" markers (ChatGPT, Gemini and others' copy format). Gemini repeats the prompt on the next line.
  const said = (line: string, i: number) => {
    const m = line.trim().match(SAID);
    if (!m) return null;
    const role: Role = m[1].toLowerCase() === 'you' ? 'user' : 'assistant';
    const rest = m[2].trim();
    if (!rest) return { role, inline: '' };
    if (role === 'user' && rest === nextNonEmpty(lines, i)) return { role, inline: '' }; // Gemini: "You said <prompt>" + "<prompt>"
    return null; // a sentence like "You said it would…" inside a reply
  };
  let turns = splitBy(lines, said);
  if (!(turns.some((t) => t.role === 'user') && turns.some((t) => t.role === 'assistant'))) {
    // 2. "User:" / "Assistant:" style labels.
    turns = splitBy(lines, (line) => {
      const m = line.match(LABEL);
      if (!m) return null;
      return { role: ASSISTANT_NAMES.test(m[1]) ? 'assistant' : 'user', inline: m[2] };
    });
    if (!(turns.some((t) => t.role === 'user') && turns.some((t) => t.role === 'assistant'))) return [];
  }
  return turns
    .map((t) => ({ role: t.role, text: trimChrome(t.text, 'both') }))
    .filter((t) => t.text);
}

function titleFrom(s: string): string {
  const first = s.split('\n').find((l) => l.trim())?.trim() ?? 'Pasted conversation';
  return first.length > 70 ? first.slice(0, 67).replace(/\s+\S*$/, '') + '…' : first;
}

export function guessTool(text: string): string {
  const said = text.match(/^(ChatGPT|Gemini|Claude|Copilot|Perplexity|DeepSeek|Grok) said/im)?.[1];
  if (said) return said;
  if (/Gemini is AI and can make mistakes|Conversation with Gemini/i.test(text)) return 'Gemini';
  if (/ChatGPT (is AI and )?can make mistakes|shared ChatGPT chat/i.test(text)) return 'ChatGPT';
  if (/Claude can make mistakes/i.test(text)) return 'Claude';
  return '';
}

export function parsePastedChat(text: string, opts: { title?: string; tool?: string; url?: string } = {}): ParsedConversation {
  const turns = splitPastedChat(text);
  const tool = opts.tool || guessTool(text);
  const label = `${tool || 'An AI chat'} (pasted)`;
  if (!turns.length) {
    const body = text.trim();
    if (!body) throw new Error('Nothing to read: the pasted text is empty.');
    return {
      title: opts.title || titleFrom(body),
      source: { kind: 'pasted-text', tool: label, url: opts.url },
      events: [{ id: 'p1', kind: 'message', role: 'user', text: body }],
      loss: [{ category: 'unlabelled-paste', count: 1, severity: 'warn', detail: 'No speaker labels were found, so the whole paste is kept as one block. The next AI can still read it.' }],
    };
  }
  const events: Draft[] = turns.map((t, i) => ({ id: `p${i + 1}`, kind: 'message', role: t.role, text: t.text }));
  const firstUser = turns.find((t) => t.role === 'user');
  return {
    title: opts.title || titleFrom(firstUser?.text ?? turns[0].text),
    source: { kind: 'pasted-text', tool: label, url: opts.url },
    events,
    loss: [{ category: 'pasted-text', count: events.length, severity: 'warn', detail: 'Pasted as text: messages and visible code only. Files, tool outputs and hidden reasoning are not in a copy. Use the Baton bookmark on the chat to capture more.' }],
  };
}
