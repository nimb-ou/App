// ParsedConversation → BatonBundle: filter private context, redact, recover files, audit losses, hash.

import { bundlePath, recoverArtifacts } from '../recover/artifacts.ts';
import { chainEvents } from './integrity.ts';
import { Redactor } from './redact.ts';
import type { ArtifactStatus, BatonArtifact, BatonBundle, BatonEvent, BuildOptions, BundleStats, LossItem, ParsedConversation } from './schema.ts';
import { SCHEMA_ID, VERSION } from './schema.ts';
import { sha256Hex } from './sha256.ts';
import { base64ToBytes, extractUrls, isRecord } from './util.ts';
import type { FileMap } from './zip.ts';

export interface BuildResult {
  bundle: BatonBundle;
  /** Extra files produced alongside the bundle (e.g. replay kit). */
  extraFiles: FileMap;
}

const NOISE_URL = /^https?:\/\/(?:images\.openai\.com|cdn\.oaistatic\.com|files\.oaiusercontent\.com)\//;

export function buildBundle(parsed: ParsedConversation, options: BuildOptions = {}): BuildResult {
  const redact = options.redact !== false;
  const includeHidden = options.includeHidden === true;
  const redactor = new Redactor(redact, undefined, options.redactTerms ?? []);

  let privateDropped = 0;
  const events: BatonEvent[] = [];
  for (const draft of parsed.events) {
    const isPrivate = isRecord(draft.meta) && draft.meta.private === true;
    if (isPrivate && !includeHidden) {
      privateDropped++;
      continue;
    }
    const e: BatonEvent = { ...draft, seq: events.length + 1, id: draft.id || `e${events.length + 1}` };
    e.text = redactor.apply(e.text);
    if (e.tool) {
      e.tool = { ...e.tool };
      if (e.tool.input) e.tool.input = redactor.apply(e.tool.input);
      if (e.tool.args) e.tool.args = redactArgs(e.tool.args, redactor);
    }
    events.push(e);
  }

  // Recover files from the (already redacted) tool calls.
  const { artifacts, replay } = recoverArtifacts(events, parsed.source.kind, parsed.source.cwd);
  for (const cf of parsed.capturedFiles ?? []) {
    const binary = cf.encoding === 'base64';
    const content = binary ? cf.content : redactor.apply(cf.content);
    const bytes = binary ? base64ToBytes(content) : new TextEncoder().encode(content);
    const path = bundlePath(cf.path, parsed.source.kind, parsed.source.cwd);
    const prior = artifacts.findIndex((a) => a.path === path);
    const captured: BatonArtifact = {
      path,
      originalPath: cf.path,
      status: 'recovered',
      content,
      encoding: binary ? 'base64' : undefined,
      mimeType: cf.mimeType,
      bytes: bytes.length,
      sha256: sha256Hex(bytes),
      recoveredFrom: cf.eventId ? [cf.eventId] : undefined,
      note: cf.note ?? 'captured from the source (exact bytes)',
    };
    if (prior >= 0) artifacts[prior] = { ...captured, versions: artifacts[prior].versions, modifiedBy: undefined };
    else artifacts.push(captured);
  }
  for (const att of parsed.attachments ?? []) {
    const content = redactor.apply(att.content);
    artifacts.push({ path: att.path, originalPath: att.path, status: 'attached', content, bytes: new TextEncoder().encode(content).length, sha256: sha256Hex(content), note: att.note });
  }
  artifacts.sort((a, b) => a.path.localeCompare(b.path));

  const links = collectLinks(events, parsed.sourceLinks ?? []);
  const stats = computeStats(events, artifacts);
  const loss = auditLoss(parsed, events, artifacts, privateDropped, redactor.counts, Boolean(replay));

  const now = options.now ?? new Date().toISOString();
  const idSeed = [parsed.source.kind, parsed.source.conversationId ?? parsed.source.url ?? '', parsed.title, events[0]?.text ?? ''].join('\u0000');
  const root = chainEvents(events, artifacts);

  const bundle: BatonBundle = {
    schema: SCHEMA_ID,
    id: sha256Hex(idSeed).slice(0, 16),
    title: redactor.apply(parsed.title),
    source: parsed.source,
    events,
    artifacts,
    loss,
    links,
    redaction: { enabled: redact, counts: { ...redactor.counts } },
    integrity: { algorithm: 'sha256-chain', root, count: events.length },
    stats,
    generator: { name: 'baton', version: VERSION, generatedAt: now },
  };
  return { bundle, extraFiles: replay ?? {} };
}

function redactArgs(args: Record<string, unknown>, r: Redactor): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string') out[k] = r.apply(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => (isRecord(x) ? redactArgs(x, r) : typeof x === 'string' ? r.apply(x) : x));
    else if (isRecord(v)) out[k] = redactArgs(v, r);
    else out[k] = v;
  }
  return out;
}

function collectLinks(events: BatonEvent[], sourceLinks: string[]): string[] {
  const set = new Set<string>();
  for (const e of events) if (e.kind === 'message' || e.kind === 'reasoning') for (const u of extractUrls(e.text)) set.add(u);
  for (const u of sourceLinks) set.add(u);
  return [...set].filter((u) => !NOISE_URL.test(u) && !u.includes('{')).sort();
}

function computeStats(events: BatonEvent[], artifacts: BatonArtifact[]): BundleStats {
  const count = (f: (e: BatonEvent) => boolean) => events.filter(f).length;
  const byStatus: Record<ArtifactStatus, number> = { recovered: 0, stale: 0, lost: 0, attached: 0 };
  for (const a of artifacts) byStatus[a.status]++;
  const times = events.map((e) => (e.time ? Date.parse(e.time) : NaN)).filter((t) => Number.isFinite(t));
  return {
    userMessages: count((e) => e.kind === 'message' && e.role === 'user'),
    assistantMessages: count((e) => e.kind === 'message' && e.role === 'assistant'),
    reasoningBlocks: count((e) => e.kind === 'reasoning'),
    toolCalls: count((e) => e.kind === 'tool_call'),
    toolResults: count((e) => e.kind === 'tool_result'),
    hiddenEvents: count((e) => e.hidden === true),
    redactedBySource: count((e) => e.redactedBySource === true),
    artifacts: byStatus,
    durationSeconds: times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 1000) : undefined,
  };
}

export function auditLoss(
  parsed: ParsedConversation,
  events: BatonEvent[],
  artifacts: BatonArtifact[],
  privateDropped: number,
  redactions: Record<string, number>,
  hasReplay: boolean,
): LossItem[] {
  const items: LossItem[] = [];
  const group = (pred: (e: BatonEvent) => boolean) => {
    const m = new Map<string, number>();
    for (const e of events) if (pred(e)) m.set(e.tool?.name ?? 'tool', (m.get(e.tool?.name ?? 'tool') ?? 0) + 1);
    return m;
  };

  const outs = group((e) => e.kind === 'tool_result' && e.redactedBySource === true);
  const outTotal = [...outs.values()].reduce((a, b) => a + b, 0);
  if (outTotal) {
    items.push({ category: 'tool-outputs', count: outTotal, severity: 'high', detail: `The source replaced ${outTotal} tool output(s) with a placeholder (${fmtGroup(outs)}). Results of searches, code runs and connector calls are not available. The receiving agent must re-run them if needed.` });
  }
  const ins = group((e) => e.kind === 'tool_call' && e.redactedBySource === true);
  const inTotal = [...ins.values()].reduce((a, b) => a + b, 0);
  if (inTotal) {
    items.push({ category: 'tool-inputs', count: inTotal, severity: 'high', detail: `${inTotal} tool call(s) have no input in the source (${fmtGroup(ins)}). The code or arguments they ran cannot be recovered.` });
  }
  const lost = artifacts.filter((a) => a.status === 'lost');
  if (lost.length) {
    items.push({ category: 'files-lost', count: lost.length, severity: 'high', detail: `${lost.length} file(s) were created or linked but their contents are not in the source: ${lost.slice(0, 8).map((a) => a.path).join(', ')}${lost.length > 8 ? ', …' : ''}.${hasReplay ? ' Some derived outputs can be regenerated with replay/.' : ''}` });
  }
  const stale = artifacts.filter((a) => a.status === 'stale');
  if (stale.length) {
    items.push({ category: 'files-stale', count: stale.length, severity: 'warn', detail: `${stale.length} file(s) were recovered exactly as last written, but later code changed them in ways that cannot be replayed statically: ${stale.slice(0, 8).map((a) => a.path).join(', ')}${stale.length > 8 ? ', …' : ''}.` });
  }
  const recovered = artifacts.filter((a) => a.status === 'recovered').length;
  if (recovered) items.push({ category: 'files-recovered', count: recovered, severity: 'info', detail: `${recovered} file(s) were reconstructed byte-for-byte from the code that created them.` });
  items.push(...(parsed.loss ?? []));
  if (privateDropped) items.push({ category: 'private-context', count: privateDropped, severity: 'info', detail: `${privateDropped} private context item(s) (system prompts, memory, custom instructions, harness metadata) were excluded. Use --include-hidden to keep them.` });
  const redTotal = Object.values(redactions).reduce((a, b) => a + b, 0);
  if (redTotal) items.push({ category: 'baton-redactions', count: redTotal, severity: 'info', detail: `Baton redacted ${redTotal} secret/PII match(es) before export (${Object.entries(redactions).map(([k, v]) => `${k}: ${v}`).join(', ')}). Use --no-redact to disable.` });

  const order = { high: 0, warn: 1, info: 2 } as const;
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

function fmtGroup(m: Map<string, number>): string {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(', ');
}
