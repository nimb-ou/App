// Assemble the on-disk / in-zip layout of a bundle.
//
//   HANDOFF.md      start here (agents and humans)
//   PROMPT.md       one paste-ready block for chat apps
//   TRANSCRIPT.md   full chronological record
//   LOSS_AUDIT.md   what did not transfer, file statuses, integrity
//   index.html      offline viewer
//   bundle.json     canonical machine-readable record (baton.bundle/v1)
//   SKILL.md        makes the folder an Agent Skill ("continue this work")
//   AGENTS.md       pointer for Codex / Cursor / other agents
//   files/…         recovered artifacts
//   replay/…        re-run captured code cells in a sandbox (when available)
//   sinks/…         business-system payloads (optional)

import type { BatonBundle } from '../core/schema.ts';
import type { FileMap } from '../core/zip.ts';
import { renderAgentsMd, renderHandoff, renderPastePrompt, renderSkill } from './handoff.ts';
import { renderHtml } from './html.ts';
import { renderLossAudit, renderTranscript } from './markdown.ts';

export interface RenderOptions {
  skill?: boolean; // default true
  html?: boolean; // default true
  extraFiles?: FileMap; // replay kit, sinks, raw source…
}

export function renderBundleFiles(b: BatonBundle, opts: RenderOptions = {}): FileMap {
  const files: FileMap = {
    'HANDOFF.md': renderHandoff(b),
    'PROMPT.md': renderPastePrompt(b),
    'TRANSCRIPT.md': renderTranscript(b),
    'LOSS_AUDIT.md': renderLossAudit(b),
    'AGENTS.md': renderAgentsMd(b),
    'bundle.json': JSON.stringify(b, null, 2) + '\n',
  };
  if (opts.html !== false) files['index.html'] = renderHtml(b);
  if (opts.skill !== false) files['SKILL.md'] = renderSkill(b);
  for (const a of b.artifacts) if (a.content !== undefined) files[`files/${a.path}`] = a.content;
  Object.assign(files, opts.extraFiles ?? {});
  return files;
}
