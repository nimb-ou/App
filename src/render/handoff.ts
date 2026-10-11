// HANDOFF.md (agent + human brief), PROMPT.md (one paste-ready block), SKILL.md, AGENTS.md.

import type { BatonBundle } from '../core/schema.ts';
import { slugify, truncate } from '../core/util.ts';
import {
  activityTitles,
  extractOpenThreads,
  fmtBytes,
  fmtDuration,
  fmtTime,
  lastVisibleAssistant,
  reasoningHeadlines,
  sourceLabel,
  splitTurns,
  toolUsage,
  userPrompts,
} from './turns.ts';

function quote(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
}

export function renderHandoff(b: BatonBundle): string {
  const prompts = userPrompts(b);
  const first = prompts[0];
  const last = prompts[prompts.length - 1];
  const lastReply = lastVisibleAssistant(b)[0];
  const threads = extractOpenThreads(b);
  const tools = toolUsage(b);
  const s = b.stats;
  const a = s.artifacts;
  const high = b.loss.filter((l) => l.severity === 'high');
  const times = b.events.map((e) => e.time).filter(Boolean) as string[];
  const out: string[] = [];

  out.push('---');
  out.push(`baton: ${b.schema}`);
  out.push(`id: ${b.id}`);
  out.push(`title: ${JSON.stringify(b.title)}`);
  out.push(`source: ${JSON.stringify(sourceLabel(b))}`);
  if (b.source.url) out.push(`source_url: ${b.source.url}`);
  out.push(`root_hash: ${b.integrity.root}`);
  out.push(`generated: ${b.generator.generatedAt}`);
  out.push('---', '');
  out.push(`# Handoff: ${b.title}`, '');
  out.push(`> **If you are an AI agent picking this up:** this folder is an audited transfer of work done in ${b.source.tool}.`);
  out.push('> Read this file first and open `TRANSCRIPT.md` only for the turns you need. `files/` holds the files the source created,');
  out.push('> with the status of each listed in §6. **Do not assume anything in §7 exists.** It was lost in transit and must be rebuilt or re-run.');
  out.push('> Confirm the latest instruction (§3) with the user before large actions.', '');

  out.push('## At a glance', '');
  out.push('| | |', '|---|---|');
  out.push(`| Source | ${sourceLabel(b)}${b.source.url ? ` · <${b.source.url}>` : ''} |`);
  if (times.length) out.push(`| Span | ${fmtTime(times[0])} → ${fmtTime(times[times.length - 1])}${s.durationSeconds ? ` (${fmtDuration(s.durationSeconds)})` : ''} |`);
  out.push(`| Conversation | ${s.userMessages} prompts · ${s.assistantMessages} assistant messages · ${s.reasoningBlocks} reasoning blocks · ${s.toolCalls} tool calls |`);
  out.push(`| Files | ${a.recovered} recovered · ${a.stale} stale · ${a.lost} lost${a.attached ? ` · ${a.attached} attached` : ''} |`);
  out.push(`| Loss | ${high.length ? high.map((l) => `${l.count} ${l.category}`).join(' · ') : 'no high-severity loss'} |`);
  out.push(`| Integrity | \`${b.integrity.root.slice(0, 16)}…\` (run \`baton verify\`) |`, '');

  out.push('## 1. Original goal', '');
  out.push(first ? quote(first.text) : '_No user prompt found._', '');

  out.push('## 2. How the ask evolved (every prompt, verbatim)', '');
  prompts.forEach((p, i) => out.push(`${i + 1}. ${p.time ? `*${fmtTime(p.time)}*: ` : ''}${p.text.trim().replace(/\n+/g, ' ⏎ ')}`));
  out.push('');

  out.push('## 3. Where it left off', '');
  if (last) out.push('**Latest user instruction:**', '', quote(last.text), '');
  if (lastReply) out.push('**Last assistant response (excerpt):**', '', quote(truncate(lastReply.text, 1800)), '');

  out.push('## 4. Open threads and blockers', '');
  out.push('*Heuristically extracted from the final assistant messages. Verify before acting.*', '');
  if (threads.length) for (const t of threads) out.push(`- ${t}`);
  else out.push('- None detected.');
  out.push('');

  out.push('## 5. Reasoning trail (per turn)', '');
  for (const t of splitTurns(b.events)) {
    if (!t.prompt) continue;
    const heads = reasoningHeadlines(t);
    const calls = t.events.filter((e) => e.kind === 'tool_call').length;
    const head = truncate(t.prompt.text.replace(/\s+/g, ' ').trim(), 90);
    out.push(`- **Turn ${t.index}** (“${head}”): ${heads.length ? heads.join(' → ') : 'no reasoning summary'}${calls ? ` · ${calls} tool calls` : ''}`);
  }
  out.push('');

  out.push('## 6. Files', '');
  if (!b.artifacts.length) out.push('_None._');
  else {
    out.push('| Status | Path | Size | Notes |', '|---|---|---|---|');
    const rank = { recovered: 0, attached: 1, stale: 2, lost: 3 } as const;
    for (const f of [...b.artifacts].sort((x, y) => rank[x.status] - rank[y.status] || x.path.localeCompare(y.path))) {
      const link = f.content !== undefined ? `[\`${f.path}\`](files/${encodeURI(f.path)})` : `\`${f.path}\``;
      out.push(`| ${f.status} | ${link} | ${fmtBytes(f.bytes)} | ${(f.note ?? '').replace(/\|/g, '\\|')} |`);
    }
  }
  out.push('');

  out.push('## 7. What the source dropped', '');
  for (const l of b.loss.filter((x) => x.severity !== 'info')) out.push(`- **${l.severity.toUpperCase()} · ${l.category} (${l.count})**: ${l.detail}`);
  if (!b.loss.some((x) => x.severity !== 'info')) out.push('- Nothing significant.');
  out.push('- Full detail: `LOSS_AUDIT.md`.', '');

  if (tools.length) {
    out.push('## 8. Tool activity', '');
    out.push('| Tool | Calls | Inputs available | Outputs available |', '|---|---|---|---|');
    for (const u of tools) out.push(`| \`${u.name}\` | ${u.calls} | ${u.inputsAvailable}/${u.calls} | ${u.outputsAvailable}/${u.outputsTotal} |`);
    const titles = activityTitles(b, 25);
    if (titles.length) out.push('', '**What the tools were used for:** ' + titles.join(' · '));
    out.push('');
  }

  if (b.links.length) {
    out.push('## 9. References seen in the conversation', '');
    for (const u of b.links.slice(0, 40)) out.push(`- <${u}>`);
    if (b.links.length > 40) out.push(`- … ${b.links.length - 40} more in \`bundle.json\``);
    out.push('');
  }

  out.push('## 10. How to continue', '');
  const steps = ['Restate the goal and the latest instruction back to the user in two sentences, and ask whether anything changed.'];
  if (a.recovered + a.stale) steps.push(`Copy \`files/\` into the workspace as the starting tree.${a.stale ? ` Re-check the ${a.stale} stale file(s) against the transcript.` : ''}`);
  if (a.lost) steps.push(`Rebuild the ${a.lost} lost file(s) from their descriptions in \`TRANSCRIPT.md\`. Do not pretend they exist.`);
  if (b.events.some((e) => e.tool?.name === 'container.exec' && e.tool.input)) steps.push('Optionally regenerate derived outputs (PDFs, archives) with `replay/run-in-docker.sh` after reviewing the cells.');
  steps.push('Write `STATE.md` with your understanding (goal, decisions, next steps) so the next handoff starts from it.');
  steps.forEach((st, i) => out.push(`${i + 1}. ${st}`));
  out.push('', '---', `*Generated by Baton ${b.generator.version} · bundle id \`${b.id}\` · \`bundle.json\` is the canonical record.*`);
  return out.join('\n') + '\n';
}

/** A single block a user can paste into any chat UI that cannot read folders. Budgeted to ~12k chars. */
export function renderPastePrompt(b: BatonBundle, budget = 12000): string {
  const prompts = userPrompts(b);
  const lastReply = lastVisibleAssistant(b)[0];
  const threads = extractOpenThreads(b, 6);
  const head: string[] = [];
  head.push(`I'm continuing a piece of work I started in ${b.source.tool}. Below is an exported handoff (made with Baton). Please read it, restate the goal and the current state in a few sentences, list what is missing, and then continue from the latest instruction.`, '');
  head.push(`TITLE: ${b.title}`);
  head.push(`SOURCE: ${sourceLabel(b)}${b.source.url ? ` (${b.source.url})` : ''}`, '');
  head.push('MY PROMPTS SO FAR (verbatim, in order):');
  prompts.forEach((p, i) => head.push(`${i + 1}. ${p.text.trim().replace(/\s+/g, ' ')}`));
  head.push('');
  const files = b.artifacts.map((a) => `- ${a.path} [${a.status}]`).join('\n');
  const loss = b.loss.filter((l) => l.severity !== 'info').map((l) => `- ${l.category} (${l.count}): ${l.detail}`).join('\n');
  const tail: string[] = [];
  if (threads.length) tail.push('OPEN THREADS / BLOCKERS:', ...threads.map((t) => `- ${t}`), '');
  if (files) tail.push('FILES FROM THE PREVIOUS SESSION (status):', files, '');
  if (loss) tail.push('WHAT DID NOT TRANSFER:', loss, '');
  tail.push('Please do not assume lost files exist. Ask me for anything you need.');

  const fixed = head.join('\n').length + tail.join('\n').length + 200;
  const room = Math.max(800, budget - fixed);
  const mid = lastReply ? ['WHERE THE ASSISTANT LEFT OFF (last reply):', truncate(lastReply.text.trim(), room), ''] : [];
  return [...head, ...mid, ...tail].join('\n') + '\n';
}

export function skillName(b: BatonBundle): string {
  return `continue-${slugify(b.title, 50)}`.slice(0, 64).replace(/-+$/, '');
}

export function renderSkill(b: BatonBundle): string {
  const first = truncate(userPrompts(b)[0]?.text.replace(/\s+/g, ' ').trim() ?? b.title, 320).replace(/[.!?…]+$/, '');
  const desc = truncate(
    `Resume the "${b.title}" work handed off from ${b.source.tool}${b.source.createdAt ? ` (${b.source.createdAt.slice(0, 10)})` : ''}. Original goal: ${first}. Use when the user asks to continue, resume, rebuild, review or extend this work.`,
    1000,
  ).replace(/"/g, "'");
  const last = userPrompts(b).slice(-1)[0];
  return `---
name: ${skillName(b)}
description: "${desc}"
---

# Continue: ${b.title}

This skill folder is a **Baton handoff bundle**: an audited transfer of work done in ${b.source.tool}.
Everything needed to resume is next to this file.

## Steps

1. Read \`HANDOFF.md\` first. It has the goal, every user prompt, where the work stopped, open threads, files and losses.
2. Open \`TRANSCRIPT.md\` only for the turns you need. It is long, and reasoning and tool calls are folded.
3. Treat \`files/\` as the recovered working tree. Only **recovered** files are exact. **stale** files need checking.
   **lost** files do not exist and must be rebuilt (see \`LOSS_AUDIT.md\`).
4. Confirm the latest instruction with the user before large changes${last ? `:\n   > ${truncate(last.text.replace(/\s+/g, ' ').trim(), 300)}` : '.'}
5. When you finish a chunk of work, write \`STATE.md\` (goal, decisions, next steps) next to this file.

## Integrity

\`bundle.json\` is the canonical record. Hash-chain root: \`${b.integrity.root}\`.
If \`baton\` is installed, run \`baton verify .\` to check nothing was altered.
`;
}

export function renderAgentsMd(b: BatonBundle): string {
  return `# AGENTS.md: handoff context

This directory carries work transferred from ${b.source.tool} with Baton (\`${b.schema}\`).

- **Start with \`HANDOFF.md\`.** It has the goal, the verbatim prompts, the current state, open threads and the file status.
- \`TRANSCRIPT.md\` has the full chronological record, and \`bundle.json\` is the canonical machine-readable version.
- \`files/\` is the recovered working tree. Respect the status column (recovered / stale / lost).
- \`LOSS_AUDIT.md\` lists what the source did not include. Never assume a lost file exists.
- Ask the user to confirm the latest instruction before large changes.
`;
}
