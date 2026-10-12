// "Baton Link" content: the brief an AI reads, the prompt that starts the next chat, and the URL that opens it.
// The page itself is rendered by src/site/handoff.ts.

import type { BatonBundle } from '../core/schema.ts';
import type { FileMap } from '../core/zip.ts';
import { extractOpenThreads, lastVisibleAssistant, userPrompts } from '../render/turns.ts';

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

const clip = (s: string, n: number) => {
  const t = s.replace(/```[\s\S]*?```/g, (m) => (m.length > 600 ? m.slice(0, 560) + '\n…```' : m)).replace(/\n{3,}/g, '\n\n').trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t;
};

/**
 * What gets pre-filled in the next AI: enough to continue even if that AI cannot open links (goal, latest
 * instruction, where it stopped, open threads, files, what's missing), plus the link for everything else.
 * Kept under `max` characters: real chatgpt.com accepted a 12,000-character ?q= in testing (journal 10); the default
 * leaves room for URL encoding and for claude.ai, whose limit could not be measured from the test browser.
 */
export function continuePrompt(b: BatonBundle, url: string, max = 5000): string {
  const prompts = userPrompts(b);
  const first = prompts[0]?.text ?? '';
  const latest = prompts.length > 1 ? prompts[prompts.length - 1].text : '';
  const last = lastVisibleAssistant(b, 1)[0]?.text ?? '';
  const threads = extractOpenThreads(b, 4);
  const ok = b.artifacts.filter((a) => a.status === 'recovered' || a.status === 'attached').map((a) => a.path);
  const high = b.loss.filter((l) => l.severity === 'high').map((l) => `${l.count} ${l.category.replace(/-/g, ' ')}`);
  const head = `Continue my work from another AI chat. Baton handoff of "${b.title}" from ${b.source.tool} (${prompts.length} ${prompts.length === 1 ? 'prompt' : 'prompts'}).`;
  const tail = `Everything (full brief, file contents, transcript): ${url}\n\nFirst tell me in 2–3 lines where we left off, then carry on. If you can't open links, work from the above and ask me for anything missing.`;
  const fixed = [
    ok.length ? `FILES THAT CAME ACROSS: ${ok.slice(0, 12).join(', ')}${ok.length > 12 ? `, +${ok.length - 12} more` : ''}` : '',
    high.length ? `DID NOT TRANSFER (don't assume these exist): ${high.join(', ')}` : '',
  ].filter(Boolean);
  const threadBlock = threads.length ? `OPEN THREADS:\n${threads.map((t) => `- ${clip(t, 220)}`).join('\n')}` : '';
  // Share what's left between the goal, the latest instruction and the last reply.
  let room = max - head.length - tail.length - fixed.join('\n\n').length - threadBlock.length - 120;
  const goalN = Math.max(200, Math.min(900, Math.floor(room * 0.3)));
  const latestN = latest ? Math.max(150, Math.min(700, Math.floor(room * 0.2))) : 0;
  room -= goalN + latestN;
  const where = last ? clip(last, Math.max(200, room)) : '';
  const sections = [
    head,
    `GOAL (my first message):\n${clip(first, goalN)}`,
    latest ? `LATEST INSTRUCTION:\n${clip(latest, latestN)}` : '',
    where ? `WHERE IT STOPPED (${where.endsWith(' …') ? 'last reply, shortened' : 'last reply'}):\n${where}` : '',
    ...fixed,
    where.endsWith(' …') ? threadBlock : '', // the open threads only add something when the last reply was cut
    tail,
  ].filter(Boolean);
  return sections.join('\n\n');
}

/** What "Copy" buttons put on the clipboard: the full brief (any AI can take a long paste) plus the link. */
export function copyText(b: BatonBundle, files: FileMap, url: string): string {
  return `${aiBrief(b, files, 60000)}\n---\nThis handoff online (files, transcript, zip): ${url}\n`;
}

/** Where to send the user after a capture: straight into the chosen AI with the prompt filled in, or to the link page. */
export function continueUrl(to: string | undefined, linkUrl: string, b: BatonBundle): string {
  const q = encodeURIComponent(continuePrompt(b, linkUrl));
  if (to === 'claude') return `https://claude.ai/new?q=${q}`;
  if (to === 'chatgpt') return `https://chatgpt.com/?q=${q}`;
  if (to === 'gemini') return `${linkUrl}?to=gemini`; // Gemini has no prefill URL: the page offers copy + open
  return `${linkUrl}?new=1`;
}
