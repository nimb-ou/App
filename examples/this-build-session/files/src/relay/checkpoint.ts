// Relay records: checkpoints written by models from inside an AI, plus bundles captured by the extension/CLI.
// A record renders to a normal Baton bundle, so every surface (HANDOFF.md, viewer, sinks) works unchanged.

import { buildBundle } from '../core/build.ts';
import type { BatonBundle, BatonEvent, CapturedFile, ParsedConversation } from '../core/schema.ts';
import type { FileMap } from '../core/zip.ts';
import { renderBundleFiles } from '../render/files.ts';

export interface CheckpointFile {
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export interface ToolOutput {
  tool: string;
  input?: string;
  output: string;
}

/** What a model writes when it checkpoints its work. Everything except `state` is optional. */
export interface Checkpoint {
  seq: number;
  at: string;
  from: string; // MCP client name (e.g. "ChatGPT", "claude-ai", "cursor") or "extension"/"cli"
  title?: string;
  goal?: string;
  state: string; // where the work stands, in the model's words
  decisions?: string[];
  next_steps?: string[];
  open_questions?: string[];
  user_prompts?: string[]; // verbatim prompts the model can see in its context
  files?: CheckpointFile[];
  tool_outputs?: ToolOutput[];
  notes?: string;
}

export interface SealedPayload {
  iv: string; // base64
  data: string; // base64 AES-GCM ciphertext
  alg: 'AES-GCM-256';
}

export interface RelayRecord {
  code: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  from: string[]; // surfaces that contributed
  bundle?: BatonBundle; // captured bundle (extension, CLI)
  checkpoints: Checkpoint[];
  sealed?: SealedPayload; // end-to-end encrypted bundle (server cannot read)
}

type Draft = Omit<BatonEvent, 'seq' | 'hash'>;

function bullets(title: string, items?: string[]): string {
  return items && items.length ? `**${title}**\n${items.map((i) => `- ${i}`).join('\n')}\n` : '';
}

export function checkpointToEvents(c: Checkpoint, seenPrompts: Set<string>): { events: Draft[]; files: CapturedFile[] } {
  const events: Draft[] = [];
  const id = `cp${c.seq}`;
  events.push({ id: `${id}-note`, kind: 'note', role: 'assistant', time: c.at, text: `Checkpoint ${c.seq} from ${c.from}` });
  (c.user_prompts ?? []).forEach((p, i) => {
    const key = p.trim();
    if (!key || seenPrompts.has(key)) return;
    seenPrompts.add(key);
    events.push({ id: `${id}-u${i + 1}`, kind: 'message', role: 'user', time: c.at, text: p, meta: { recalledBy: c.from } });
  });
  const body = [
    c.goal ? `**Goal.** ${c.goal}\n` : '',
    `**State.** ${c.state}\n`,
    bullets('Decisions', c.decisions),
    bullets('Next steps', c.next_steps),
    bullets('Open questions', c.open_questions),
    c.notes ? `**Notes.** ${c.notes}\n` : '',
  ]
    .filter(Boolean)
    .join('\n');
  events.push({ id: `${id}-state`, kind: 'message', role: 'assistant', time: c.at, text: body, meta: { checkpoint: c.seq, from: c.from } });
  (c.tool_outputs ?? []).forEach((t, i) => {
    events.push({ id: `${id}-t${i + 1}`, kind: 'tool_call', role: 'assistant', time: c.at, text: t.tool, tool: { name: t.tool, input: t.input } });
    events.push({ id: `${id}-r${i + 1}`, kind: 'tool_result', role: 'tool', time: c.at, text: t.output, tool: { name: t.tool } });
  });
  const files: CapturedFile[] = (c.files ?? []).map((f) => ({ path: f.path, content: f.content, encoding: f.encoding, eventId: `${id}-state`, note: `written by the model at checkpoint ${c.seq} (${c.from})` }));
  return { events, files };
}

/** Re-open a stored bundle as a parsed conversation so checkpoints can extend it. */
export function bundleToParsed(b: BatonBundle): ParsedConversation {
  return {
    title: b.title,
    source: b.source,
    events: b.events.map(({ seq: _s, hash: _h, ...e }) => e),
    capturedFiles: b.artifacts
      .filter((a) => a.content !== undefined)
      .map((a) => ({ path: a.originalPath, content: a.content!, encoding: a.encoding, mimeType: a.mimeType, note: a.note })),
    loss: b.loss.filter((l) => !['files-recovered', 'files-lost', 'files-stale', 'tool-outputs', 'tool-inputs', 'baton-redactions', 'private-context'].includes(l.category)),
    sourceLinks: b.links,
  };
}

export function recordToParsed(r: RelayRecord): ParsedConversation {
  const base: ParsedConversation = r.bundle
    ? bundleToParsed(r.bundle)
    : { title: r.title, source: { kind: 'baton-relay', tool: r.from.join(' + ') || 'Baton relay', conversationId: r.code, createdAt: r.createdAt, updatedAt: r.updatedAt }, events: [], capturedFiles: [] };
  const seen = new Set(base.events.filter((e) => e.kind === 'message' && e.role === 'user').map((e) => e.text.trim()));
  for (const c of r.checkpoints) {
    const { events, files } = checkpointToEvents(c, seen);
    base.events.push(...events);
    base.capturedFiles = [...(base.capturedFiles ?? []), ...files];
  }
  const goal = [...r.checkpoints].reverse().find((c) => c.goal)?.goal;
  if (!base.events.some((e) => e.kind === 'message' && e.role === 'user') && goal) {
    base.events.unshift({ id: 'goal', kind: 'message', role: 'user', text: goal, meta: { recalledBy: 'checkpoint goal' } });
  }
  if (r.checkpoints.length) {
    base.loss = [
      ...(base.loss ?? []),
      { category: 'model-reported', count: r.checkpoints.length, severity: 'info', detail: `${r.checkpoints.length} checkpoint(s) were written by the model from inside ${[...new Set(r.checkpoints.map((c) => c.from))].join(', ')}. They reflect what the model held in context. Prompts marked "recalled" are the model's copy of them.` },
    ];
  }
  base.title = r.title || base.title;
  return base;
}

export function renderRecord(r: RelayRecord, now?: string): { bundle: BatonBundle; files: FileMap } {
  const { bundle, extraFiles } = buildBundle(recordToParsed(r), { now: now ?? r.updatedAt });
  return { bundle, files: renderBundleFiles(bundle, { extraFiles }) };
}
