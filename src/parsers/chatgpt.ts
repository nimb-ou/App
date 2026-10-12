// ChatGPT: public share pages (HTML / turbo-stream) and official data exports (conversations.json).
// Both carry the same conversation object: { title, mapping{id:{parent,children,message}}, current_node }.

import type { BatonEvent, LossItem, ParsedConversation } from '../core/schema.ts';
import { decodeFromHtml, decodeTurboStream } from '../core/turbostream.ts';
import { asString, epochToIso, isRecord } from '../core/util.ts';

type Rec = Record<string, unknown>;
type DraftEvent = Omit<BatonEvent, 'seq' | 'hash'>;

export const REDACTED_PLACEHOLDER = 'The output of this plugin was redacted.';

/** Locate the conversation object inside a decoded share-page loader payload. */
export function findShareConversation(root: unknown): Rec {
  if (isRecord(root)) {
    const loader = root.loaderData;
    if (isRecord(loader)) {
      for (const [route, data] of Object.entries(loader)) {
        if (!route.includes('share') || !isRecord(data)) continue;
        const sr = data.serverResponse;
        if (isRecord(sr) && isRecord(sr.data) && isRecord(sr.data.mapping)) return sr.data;
      }
    }
  }
  // Fallback: depth-first search for an object with mapping + current_node.
  const seen = new Set<unknown>();
  const stack: unknown[] = [root];
  while (stack.length) {
    const v = stack.pop();
    if (!isRecord(v) && !Array.isArray(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    if (isRecord(v) && isRecord(v.mapping) && typeof v.current_node === 'string') return v;
    for (const child of Array.isArray(v) ? v : Object.values(v)) stack.push(child);
  }
  throw new Error('ChatGPT share: conversation data not found in page payload');
}

export function parseChatGPTShareHtml(html: string, url?: string): ParsedConversation {
  const root = decodeFromHtml(html);
  const conv = findShareConversation(root);
  return parseChatGPTConversation(conv, { kind: 'chatgpt-share', url });
}

export function parseChatGPTTurboStream(payload: string, url?: string): ParsedConversation {
  const conv = findShareConversation(decodeTurboStream(payload.trim().split('\n')[0]));
  return parseChatGPTConversation(conv, { kind: 'chatgpt-share', url });
}

/** conversations.json from the account export: an array of conversation objects. */
export function parseChatGPTExport(json: unknown): ParsedConversation[] {
  const list = Array.isArray(json) ? json : isRecord(json) ? [json] : [];
  return list.filter((c) => isRecord(c) && isRecord(c.mapping)).map((c) => parseChatGPTConversation(c as Rec, { kind: 'chatgpt-export' }));
}

function activePath(mapping: Rec, currentNode: string | undefined): Rec[] {
  const nodes: Rec[] = [];
  let id = currentNode;
  const guard = new Set<string>();
  if (!id || !isRecord(mapping[id])) {
    // No current node: pick the deepest leaf following the last child at each step.
    const rootId = Object.keys(mapping).find((k) => {
      const n = mapping[k];
      return isRecord(n) && !n.parent;
    });
    id = rootId;
    while (id && isRecord(mapping[id])) {
      const kids = (mapping[id] as Rec).children;
      if (!Array.isArray(kids) || kids.length === 0) break;
      id = String(kids[kids.length - 1]);
    }
  }
  while (id && isRecord(mapping[id]) && !guard.has(id)) {
    guard.add(id);
    const node = mapping[id] as Rec;
    nodes.push(node);
    id = typeof node.parent === 'string' ? node.parent : undefined;
  }
  return nodes.reverse();
}

/** Replace ChatGPT private-use entity markers (U+E200 name U+E202 args… U+E201) with readable text. */
export function cleanEntities(text: string, counters: { cites: number; images: number }): string {
  return text
    .replace(/([a-z_]+)((?:[^]*)*)/g, (_m, name: string, argStr: string) => {
      const args = argStr.split('').filter(Boolean);
      if (name === 'cite') {
        counters.cites++;
        return ` [cite: ${args.join(', ')}]`;
      }
      if (name === 'url' && args.length >= 2 && /^https?:\/\//.test(args[1])) return `[${args[0]}](${args[1]})`;
      if (name === 'image_group') {
        counters.images++;
        try {
          const q = JSON.parse(args[0] ?? '{}') as { query?: string[] };
          return `*[image: ${(q.query ?? []).join('; ')}]*`;
        } catch {
          return '*[image]*';
        }
      }
      return `[${name}${args.length ? ': ' + args.join(', ') : ''}]`;
    })
    .replace(/[-]/g, '');
}

/** Strip GenUI JSX (when no fallbackMarkdown exists) into plain Markdown. */
export function jsxToMarkdown(text: string, counters: { cites: number; images: number }): string {
  return text
    .replace(/<Cite refs=\{\[([^\]]*)\]\}\s*\/>/g, (_m, refs: string) => {
      counters.cites++;
      return ` [cite: ${refs.replace(/["\s]/g, '').split(',').join(', ')}]`;
    })
    .replace(/<AsyncImage[^>]*query="([^"]*)"[^>]*\/>/g, (_m, q: string) => {
      counters.images++;
      return `*[image: ${q}]*`;
    })
    .replace(/<button[^>]*GenUI\.openUrl\("([^"]+)"\)[^>]*>([\s\S]*?)<\/button>/g, (_m, url: string, label: string) => `[${label.replace(/<[^>]+>/g, '').trim()}](${url})`)
    .replace(/<title[^>]*>([\s\S]*?)<\/title\s*>?/g, '**$1**')
    .replace(/<badge[^>]*>([\s\S]*?)<\/badge>/g, '`$1`')
    .replace(/<\/?(?:box|grid|grid-item|row|text|divider|icon|list|list-item)\b[^>]*\/?>/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

export interface ChatGPTOptions {
  kind: 'chatgpt-share' | 'chatgpt-export';
  url?: string;
}

export function parseChatGPTConversation(conv: Rec, opts: ChatGPTOptions): ParsedConversation {
  const mapping = (conv.mapping ?? {}) as Rec;
  const path = activePath(mapping, typeof conv.current_node === 'string' ? conv.current_node : undefined);
  const counters = { cites: 0, images: 0 };
  const events: DraftEvent[] = [];
  let userAttachments = 0;
  let imageParts = 0;
  let models = new Set<string>();

  for (const node of path) {
    const msg = node.message;
    if (!isRecord(msg)) continue;
    const author = (msg.author ?? {}) as Rec;
    const role = String(author.role ?? 'assistant');
    const content = (msg.content ?? {}) as Rec;
    const ct = String(content.content_type ?? 'text');
    const md = (msg.metadata ?? {}) as Rec;
    const recipient = typeof msg.recipient === 'string' ? msg.recipient : 'all';
    const time = epochToIso(msg.create_time);
    const model = typeof md.model_slug === 'string' ? md.model_slug : typeof md.resolved_model_slug === 'string' ? md.resolved_model_slug : undefined;
    if (model) models.add(model);
    const hiddenInUi = md.is_visually_hidden_from_conversation === true;
    const titles = Array.isArray(md.reasoning_titles) ? (md.reasoning_titles as unknown[]).map(String) : [];
    const title = typeof md.reasoning_title === 'string' ? md.reasoning_title : titles[0];
    const base = { id: String(msg.id ?? node.id ?? ''), time, model };

    // Private context: system prompts, memory, custom instructions.
    if (role === 'system' || ct === 'model_editable_context' || ct === 'user_editable_context') {
      const txt = ct === 'model_editable_context' ? asString(content.model_set_context) : partsText(content);
      if (!txt.trim()) continue; // empty scaffolding; nothing to keep or to lose
      events.push({ ...base, kind: 'note', role: 'system', text: txt, hidden: true, meta: { private: true, contentType: ct } });
      continue;
    }

    if (ct === 'thoughts') {
      const thoughts = Array.isArray(content.thoughts) ? (content.thoughts as Rec[]) : [];
      const text = thoughts
        .map((t) => {
          const s = asString(t.summary).trim();
          const c = asString(t.content).trim();
          return c ? `**${s}.** ${c}` : s ? `**${s}.**` : '';
        })
        .filter(Boolean)
        .join('\n\n');
      if (text) events.push({ ...base, kind: 'reasoning', role: 'assistant', text, meta: { granularity: 'summary' } });
      continue;
    }

    if (ct === 'reasoning_recap') {
      events.push({ ...base, kind: 'note', role: 'assistant', text: asString(content.content), meta: { recap: true } });
      continue;
    }

    if (role === 'tool') {
      const text = ct === 'execution_output' ? asString(content.text) : partsText(content) || asString(content.text) || asString(content.result);
      const redacted = text.trim() === REDACTED_PLACEHOLDER;
      events.push({
        ...base,
        kind: 'tool_result',
        role: 'tool',
        text: redacted ? '' : text,
        tool: { name: String(author.name ?? recipient), title },
        redactedBySource: redacted || undefined,
        hidden: hiddenInUi || undefined,
      });
      continue;
    }

    if (role === 'assistant' && recipient !== 'all' && recipient !== 'assistant') {
      const input = ct === 'code' ? asString(content.text) : partsText(content);
      const redacted = input.trim() === REDACTED_PLACEHOLDER || input.trim() === '';
      events.push({
        ...base,
        kind: 'tool_call',
        role: 'assistant',
        text: title ?? '',
        tool: {
          name: recipient,
          title: titles.length > 1 ? titles.join(' · ') : title,
          language: ct === 'code' ? normaliseLang(asString(content.language), input) : undefined,
          input: redacted ? undefined : input,
        },
        redactedBySource: redacted || undefined,
        hidden: hiddenInUi || undefined,
      });
      continue;
    }

    // Plain prose (user or assistant).
    let text: string;
    const dil = isRecord(md.model_dil_v2) ? md.model_dil_v2 : undefined;
    if (role === 'assistant' && dil && typeof dil.fallbackMarkdown === 'string' && dil.fallbackMarkdown.trim()) {
      text = cleanEntities(dil.fallbackMarkdown, counters);
    } else {
      const parts = Array.isArray(content.parts) ? content.parts : [];
      text = parts
        .map((p) => {
          if (typeof p === 'string') return p;
          if (isRecord(p) && String(p.content_type ?? '').includes('image')) {
            imageParts++;
            return '*[image attachment, not included by source]*';
          }
          return asString(p);
        })
        .join('\n');
      text = role === 'assistant' ? jsxToMarkdown(cleanEntities(text, counters), counters) : text;
    }
    if (role === 'user' && Array.isArray(md.attachments)) {
      for (const a of md.attachments as Rec[]) {
        userAttachments++;
        events.push({ ...base, id: `${base.id}-att-${userAttachments}`, kind: 'attachment', role: 'user', text: `Attached file: ${asString(a.name) || 'unnamed'}`, meta: { name: a.name, mimeType: a.mime_type ?? a.mimeType, size: a.size } });
      }
    }
    if (!text.trim()) continue;
    events.push({
      ...base,
      kind: 'message',
      role: role === 'user' ? 'user' : 'assistant',
      text,
      hidden: hiddenInUi || undefined,
      meta: hiddenInUi ? { channel: 'commentary' } : undefined,
    });
  }

  const loss: LossItem[] = [];
  const offPath = Object.keys(mapping).length - path.length;
  if (offPath > 0) loss.push({ category: 'branches', count: offPath, severity: 'info', detail: `${offPath} message node(s) belong to edited/regenerated branches that are not on the active path and were not exported.` });
  if (counters.cites) loss.push({ category: 'citations', count: counters.cites, severity: 'warn', detail: `${counters.cites} inline citation marker(s) point to search results that the source did not include; only marker ids survive. See links for the source's URL list.` });
  if (counters.images + imageParts) loss.push({ category: 'images', count: counters.images + imageParts, severity: 'info', detail: 'Images shown in the conversation are not included; placeholders keep their search query where available.' });
  if (userAttachments) loss.push({ category: 'user-attachments', count: userAttachments, severity: 'warn', detail: 'Files the user uploaded are referenced by name only; their contents are not part of the source.' });
  if (events.some((e) => e.kind === 'reasoning')) loss.push({ category: 'reasoning-depth', count: events.filter((e) => e.kind === 'reasoning').length, severity: 'info', detail: 'Reasoning is available as the summaries ChatGPT displays, not the full internal chain of thought.' });

  const modelInfo = isRecord(conv.model) ? asString(conv.model.slug) : typeof conv.default_model_slug === 'string' ? conv.default_model_slug : undefined;
  const sourceLinks = Array.isArray(conv.safe_urls) ? (conv.safe_urls as unknown[]).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)) : [];
  const conversationId = asString(conv.conversation_id) || asString(conv.id) || undefined;

  return {
    title: asString(conv.title) || 'Untitled ChatGPT conversation',
    source: {
      kind: opts.kind,
      tool: 'ChatGPT',
      url: opts.url,
      conversationId,
      createdAt: epochToIso(conv.create_time),
      updatedAt: epochToIso(conv.update_time),
      model: modelInfo || [...models][0],
    },
    events,
    sourceLinks,
    loss,
  };
}

function partsText(content: Rec): string {
  const parts = Array.isArray(content.parts) ? content.parts : [];
  return parts.map((p) => (typeof p === 'string' ? p : asString(p))).join('\n');
}

function normaliseLang(lang: string, code: string): string {
  if (lang && lang !== 'unknown') return lang;
  if (/^\s*(bash|sh)\s+-l?c\b/.test(code) || /^\s*(cd|ls|cat|mkdir|cp|python|pip|zip)\b/.test(code)) return 'bash';
  if (/^\s*(import|from|def|print)\b/m.test(code)) return 'python';
  return '';
}
