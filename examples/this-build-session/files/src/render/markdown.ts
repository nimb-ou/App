// TRANSCRIPT.md and LOSS_AUDIT.md

import type { BatonBundle, BatonEvent } from '../core/schema.ts';
import { fence } from '../core/util.ts';
import { fmtBytes, fmtDuration, fmtTime, sourceLabel, splitTurns } from './turns.ts';

const SEVERITY_LABEL = { high: 'HIGH', warn: 'WARN', info: 'info' } as const;

export function renderTranscript(b: BatonBundle): string {
  const out: string[] = [];
  out.push(`# Transcript: ${b.title}`, '');
  out.push(`*${sourceLabel(b)}${b.source.url ? ` · <${b.source.url}>` : ''} · ${b.stats.userMessages} prompts · ${b.events.length} events · exported by Baton ${b.generator.version}*`, '');
  out.push('Reasoning, tool calls and tool outputs are folded into `<details>` blocks. Placeholders mark content the source did not include. See `LOSS_AUDIT.md`.', '');

  for (const t of splitTurns(b.events)) {
    out.push('---', '');
    if (t.prompt) {
      out.push(`## Turn ${t.index}`, '');
      out.push(`### User${t.prompt.time ? ` · ${fmtTime(t.prompt.time)}` : ''}`, '', t.prompt.text.trim(), '');
    } else {
      out.push('## Preamble', '');
    }
    for (const e of t.events) out.push(...renderEvent(e), '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}

function renderEvent(e: BatonEvent): string[] {
  const when = e.time ? ` · ${fmtTime(e.time)}` : '';
  switch (e.kind) {
    case 'message': {
      const label = e.role === 'user' ? 'User' : e.hidden ? 'Assistant (progress update)' : 'Assistant';
      return [`### ${label}${e.model ? ` · ${e.model}` : ''}${when}`, '', e.text.trim()];
    }
    case 'reasoning': {
      const body = e.redactedBySource && !e.text.trim() ? '*Reasoning was produced but the source stores it in encrypted form only.*' : e.text.trim();
      return ['<details><summary>Reasoning' + (e.meta?.granularity === 'summary' ? ' (summary)' : '') + '</summary>', '', body, '', '</details>'];
    }
    case 'tool_call': {
      const name = e.tool?.name ?? 'tool';
      const title = e.tool?.title ? ` · ${e.tool.title}` : e.text && e.text !== name ? ` · ${e.text}` : '';
      const lines = [`<details><summary>Tool call: <code>${name}</code>${escapeSummary(title)}</summary>`, ''];
      if (e.redactedBySource) lines.push('*Input not included by the source.*');
      else if (e.tool?.input) lines.push(fence(e.tool.input, e.tool.language ?? ''));
      lines.push('', '</details>');
      return lines;
    }
    case 'tool_result': {
      const name = e.tool?.name ?? 'tool';
      if (e.redactedBySource) return [`> Output of \`${name}\`: *redacted by source*`];
      const text = e.text.length > 20000 ? e.text.slice(0, 20000) + `\n… [${e.text.length - 20000} more characters in bundle.json]` : e.text;
      return [`<details><summary>Output: <code>${name}</code></summary>`, '', fence(text), '', '</details>'];
    }
    case 'attachment':
      return [`> Attachment: ${e.text}`];
    case 'note':
      return [`*${e.text.trim()}*`];
  }
}

function escapeSummary(s: string): string {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderLossAudit(b: BatonBundle): string {
  const out: string[] = [];
  out.push(`# Loss audit: ${b.title}`, '');
  out.push('A transfer is only trustworthy if it says what it could **not** carry. This report lists everything the source dropped,');
  out.push('everything Baton reconstructed, and everything Baton removed on purpose (private context, secrets).', '');
  out.push('| Severity | Category | Count | Detail |', '|---|---|---|---|');
  for (const l of b.loss) out.push(`| ${SEVERITY_LABEL[l.severity]} | ${l.category} | ${l.count} | ${l.detail.replace(/\|/g, '\\|')} |`);
  out.push('');
  out.push('## Files', '');
  if (!b.artifacts.length) out.push('_No files were created or referenced._');
  else {
    out.push('| Status | Path | Size | Versions | Notes |', '|---|---|---|---|---|');
    for (const a of b.artifacts) out.push(`| ${a.status} | \`${a.path}\` | ${fmtBytes(a.bytes)} | ${a.versions ?? ''} | ${(a.note ?? '').replace(/\|/g, '\\|')} |`);
    out.push('');
    out.push('- **recovered**: reconstructed byte for byte from the code that wrote it. Its SHA-256 is in `bundle.json`.');
    out.push('- **stale**: exactly the last full write, but later code modified it in a way that cannot be replayed statically.');
    out.push('- **lost**: the conversation created or linked it, but its contents are not in the source.');
    out.push('- **attached**: shipped with the source export (e.g. uploaded file with extracted text).');
  }
  out.push('');
  out.push('## Integrity', '');
  out.push(`Hash chain root (SHA-256 over ${b.integrity.count} events + ${b.artifacts.length} artifact digests): \`${b.integrity.root}\``, '');
  out.push('Run `baton verify <bundle-dir>` to recompute it. Any edit to an event or a recovered file changes the root.', '');
  out.push('## Stats', '');
  const s = b.stats;
  out.push(`- Prompts: ${s.userMessages} · assistant messages: ${s.assistantMessages} · reasoning blocks: ${s.reasoningBlocks}`);
  out.push(`- Tool calls: ${s.toolCalls} · tool results: ${s.toolResults} · items the source redacted: ${s.redactedBySource}`);
  if (s.durationSeconds) out.push(`- Wall-clock span: ${fmtDuration(s.durationSeconds)}`);
  return out.join('\n') + '\n';
}
