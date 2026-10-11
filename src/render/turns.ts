// Shared analysis used by the renderers: turns, next steps, tool usage, timing.

import type { BatonBundle, BatonEvent } from '../core/schema.ts';

export interface Turn {
  index: number; // 1-based
  prompt?: BatonEvent; // the user message that opened the turn
  events: BatonEvent[];
}

export function splitTurns(events: BatonEvent[]): Turn[] {
  const turns: Turn[] = [];
  let cur: Turn = { index: 0, events: [] };
  for (const e of events) {
    if (e.kind === 'message' && e.role === 'user') {
      if (cur.events.length || cur.prompt) turns.push(cur);
      cur = { index: turns.length + 1, prompt: e, events: [] };
    } else {
      cur.events.push(e);
    }
  }
  if (cur.events.length || cur.prompt) turns.push(cur);
  // A preamble without a user prompt keeps index 0; renumber the rest from 1.
  let n = 0;
  for (const t of turns) if (t.prompt) t.index = ++n;
  return turns;
}

export function userPrompts(b: BatonBundle): BatonEvent[] {
  return b.events.filter((e) => e.kind === 'message' && e.role === 'user');
}

export function lastVisibleAssistant(b: BatonBundle, n = 1): BatonEvent[] {
  return b.events.filter((e) => e.kind === 'message' && e.role === 'assistant' && !e.hidden).slice(-n);
}

const NEXT_RE = /\b(next(?: step| milestone)?s?|not (?:yet|built|live|verified)|haven'?t|hasn'?t|still (?:need|to)|to ?do|remaining|need(?:s)? to|once you|after (?:you|that)|blocker|cannot|can'?t|couldn'?t|rejected|403|fail(?:ed|s)?|missing|pending|follow[- ]up|roadmap)\b/i;

/** Heuristic: sentences/bullets from the final assistant messages that describe open work or blockers. */
export function extractOpenThreads(b: BatonBundle, max = 10): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of lastVisibleAssistant(b, 2).reverse()) {
    const pieces = e.text
      .replace(/```[\s\S]*?```/g, ' ')
      .split(/\n+|(?<=[.!?])\s+(?=[A-Z*])/)
      .map((s) => s.replace(/^[\s>*#\-\d.)]+/, '').replace(/\*\*/g, '').trim())
      .filter((s) => s.length > 25 && s.length < 400);
    for (const p of pieces) {
      if (!NEXT_RE.test(p)) continue;
      const key = p.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
      if (out.length >= max) return out;
    }
  }
  return out;
}

export interface ToolUsage {
  name: string;
  calls: number;
  inputsAvailable: number;
  outputsAvailable: number;
  outputsTotal: number;
}

export function toolUsage(b: BatonBundle): ToolUsage[] {
  const m = new Map<string, ToolUsage>();
  const get = (n: string) => {
    let u = m.get(n);
    if (!u) m.set(n, (u = { name: n, calls: 0, inputsAvailable: 0, outputsAvailable: 0, outputsTotal: 0 }));
    return u;
  };
  for (const e of b.events) {
    if (e.kind === 'tool_call' && e.tool) {
      const u = get(e.tool.name);
      u.calls++;
      if (!e.redactedBySource && (e.tool.input || e.tool.args)) u.inputsAvailable++;
    } else if (e.kind === 'tool_result' && e.tool) {
      const u = get(e.tool.name);
      u.outputsTotal++;
      if (!e.redactedBySource) u.outputsAvailable++;
    }
  }
  return [...m.values()].sort((a, b) => b.calls + b.outputsTotal - (a.calls + a.outputsTotal));
}

/** Labels such as "Searching OpenAlex…" that describe what tools were used for. */
export function activityTitles(b: BatonBundle, max = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of b.events) {
    if (e.kind !== 'tool_call' || !e.tool?.title) continue;
    for (const t of e.tool.title.split(' · ')) {
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, max);
}

export function fmtTime(iso?: string): string {
  if (!iso) return '';
  return iso.replace('T', ' ').replace(/:\d\d(\.\d+)?Z$/, ' UTC');
}

export function fmtDuration(sec?: number): string {
  if (!sec || sec < 1) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}

export function fmtBytes(n?: number): string {
  if (n === undefined) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Bold lead phrases from reasoning summaries in a turn ("**Modeling cricket stumping.** …"). */
export function reasoningHeadlines(t: Turn, max = 6): string[] {
  const out: string[] = [];
  for (const e of t.events) {
    if (e.kind !== 'reasoning') continue;
    for (const m of e.text.matchAll(/\*\*([^*]{3,120}?)\.?\*\*/g)) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
  }
  return out.slice(0, max);
}

export function sourceLabel(b: BatonBundle): string {
  const k = b.source.kind;
  const how = k === 'chatgpt-share' ? 'public share link' : k.endsWith('export') ? 'account data export' : k === 'claude-code' ? 'session log' : 'chat log';
  return `${b.source.tool}${b.source.model ? ` (${b.source.model})` : ''} · ${how}`;
}
