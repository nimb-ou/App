// Browser-safe end-to-end pipeline: raw input text → parsed → bundle → file map.
// Used by the CLI, the MCP server and the web app.

import { buildBundle } from './core/build.ts';
import type { BatonBundle, BuildOptions, ParsedConversation } from './core/schema.ts';
import { slugify } from './core/util.ts';
import type { FileMap } from './core/zip.ts';
import { parseAny } from './parsers/detect.ts';
import { renderBundleFiles } from './render/files.ts';
import { buildSink, type SinkName, type SinkOptions } from './sinks/index.ts';

export interface ConvertOptions extends BuildOptions {
  url?: string;
  pick?: string; // conversation id or title substring, for multi-conversation exports
  sinks?: SinkName[];
  sinkOptions?: SinkOptions;
  keepSource?: boolean;
  skill?: boolean;
  html?: boolean;
}

export interface ConvertedBundle {
  slug: string;
  bundle: BatonBundle;
  files: FileMap;
}

export function pickConversations(list: ParsedConversation[], pick?: string): ParsedConversation[] {
  if (!pick) return list;
  const q = pick.toLowerCase();
  const hit = list.filter((c) => c.source.conversationId === pick || c.title.toLowerCase().includes(q));
  if (!hit.length) throw new Error(`No conversation matches --pick "${pick}". Available: ${list.slice(0, 20).map((c) => `"${c.title}"`).join(', ')}${list.length > 20 ? ', …' : ''}`);
  return hit;
}

export function convert(text: string, filename: string, opts: ConvertOptions = {}): ConvertedBundle[] {
  const parsed = pickConversations(parseAny(text, filename, opts.url), opts.pick);
  const used = new Set<string>();
  return parsed.map((p) => {
    const { bundle, extraFiles } = buildBundle(p, opts);
    const extra: FileMap = { ...extraFiles };
    for (const s of opts.sinks ?? []) extra[`sinks/${s}.json`] = JSON.stringify(buildSink(s, bundle, opts.sinkOptions), null, 2) + '\n';
    if (opts.keepSource) extra[`source/${filename.replace(/^.*[\\/]/, '') || 'input.txt'}`] = text;
    let slug = slugify(bundle.title);
    if (used.has(slug)) slug = `${slug}-${bundle.id.slice(0, 6)}`;
    used.add(slug);
    return { slug, bundle, files: renderBundleFiles(bundle, { extraFiles: extra, skill: opts.skill, html: opts.html }) };
  });
}

/** Choose the right member of an account-export ZIP (conversations.json), given decoded members. */
export function pickExportMember(names: string[]): string | undefined {
  const pref = names.filter((n) => /(^|\/)conversations\.json$/i.test(n));
  if (pref.length) return pref[0];
  return names.find((n) => /\.jsonl?$/i.test(n)) ?? names.find((n) => /\.html?$/i.test(n));
}
