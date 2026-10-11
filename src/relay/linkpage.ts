// "Baton Link" content: the brief an AI reads, and the prompt/URL that starts the next chat.
// The page itself is rendered by src/site/handoff.ts.

import type { BatonBundle } from '../core/schema.ts';
import type { FileMap } from '../core/zip.ts';

/** Everything an AI needs, as Markdown: instructions, the handoff brief, and file contents (budgeted). */
export function aiBrief(b: BatonBundle, files: FileMap, budget = 90000): string {
  const handoff = String(files['HANDOFF.md'] ?? '').replace(/^---[\s\S]*?---\n/, '');
  const parts: string[] = [
    `# Baton handoff: ${b.title}`,
    '',
    `> **To the AI reading this:** a user moved this work here from ${b.source.tool}. Read the brief, restate the goal and where`,
    '> the work stopped in 2–3 sentences, list anything marked lost, then continue from the latest instruction (§3).',
    '> Do not assume lost files exist.',
    '',
    handoff,
  ];
  let room = budget - parts.join('\n').length;
  const inline: string[] = [];
  for (const a of b.artifacts) {
    if (a.content === undefined || a.encoding === 'base64') continue;
    const block = `### files/${a.path}\n\n\`\`\`\n${a.content.replace(/```/g, '`\u200b``')}\n\`\`\``;
    if (block.length > room) {
      inline.push(`### files/${a.path}\n\n*(${a.bytes} bytes, not inlined here: download the .zip)*`);
      continue;
    }
    room -= block.length;
    inline.push(block);
  }
  if (inline.length) parts.push('', '## File contents', '', ...inline);
  return parts.join('\n') + '\n';
}

/** What gets pre-filled in the next AI. Short on purpose: the link carries the content. */
export function continuePrompt(title: string, url: string, tool: string): string {
  return `Please continue my work from this Baton handoff: ${url}\n\nIt holds "${title}" from ${tool}: my prompts, the previous answers, files, and a list of anything that did not transfer. Open the link, tell me in 2–3 lines where we left off, then carry on.`;
}

/** Where to send the user after a capture: straight into the chosen AI with the prompt filled in, or to the link page. */
export function continueUrl(to: string | undefined, linkUrl: string, title: string, tool: string): string {
  const q = encodeURIComponent(continuePrompt(title, linkUrl, tool));
  if (to === 'claude') return `https://claude.ai/new?q=${q}`;
  if (to === 'chatgpt') return `https://chatgpt.com/?q=${q}`;
  if (to === 'gemini') return `${linkUrl}?to=gemini`; // Gemini has no prefill URL: the page offers copy + open
  return `${linkUrl}?new=1`;
}
