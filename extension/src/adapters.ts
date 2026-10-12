// Site adapters: capture a conversation from INSIDE the logged-in page, where the full data lives.
// Each adapter gets a Net (same-origin JSON with the user's session; cross-origin binaries via the
// extension background), so the logic is unit-testable without a browser.

import type { CapturedFile, LossItem, ParsedConversation } from '../../src/core/schema.ts';
import { base64ToBytes, isRecord } from '../../src/core/util.ts';
import { parseChatGPTConversation, parseChatGPTShareHtml } from '../../src/parsers/chatgpt.ts';
import { parseClaudeExport } from '../../src/parsers/claude.ts';
import { extractSandboxReferences } from '../../src/recover/artifacts.ts';

export interface Net {
  json(url: string, init?: { headers?: Record<string, string> }): Promise<unknown>;
  /** Fetch bytes (cross-origin allowed via the extension). */
  binary(url: string): Promise<{ base64: string; type: string; size: number }>;
}

export interface CaptureContext {
  url: URL;
  net: Net;
  doc: Document;
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

export interface CaptureResult {
  parsed: ParsedConversation;
  captured: number; // files captured as bytes
  failed: string[]; // files we tried and could not get
}

export interface ComposerSpec {
  input: string[]; // selectors, first match wins
  file?: string[];
}

export interface Adapter {
  id: 'chatgpt' | 'claude' | 'gemini' | 'dom';
  label: string;
  newChatUrl?: string;
  hosts: string[];
  composer: ComposerSpec;
  conversationId(url: URL): string | undefined;
  capture(ctx: CaptureContext): Promise<CaptureResult>;
}

const MB = 1024 * 1024;
const TEXT_EXT = /\.(py|js|mjs|ts|tsx|jsx|json|md|txt|csv|tsv|html?|css|ya?ml|toml|ini|cfg|sh|bash|sql|r|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|swift|xml|svg|tex|bib|cff|dockerfile|gitignore|env\.example)$/i;

/** Keep text files as UTF-8 (diffable, readable, attachable); binary stays base64. */
function asCaptured(bin: { base64: string; type: string }, name = ''): { content: string; encoding?: 'base64' } {
  const textual = /^text\/|json|xml|javascript|x-python|x-sh|yaml|csv/.test(bin.type) || TEXT_EXT.test(name);
  if (textual) {
    try {
      return { content: new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(bin.base64)) };
    } catch {
      /* not valid UTF-8 after all */
    }
  }
  return { content: bin.base64, encoding: 'base64' };
}

// ───────────────────────────── ChatGPT ─────────────────────────────

export const chatgpt: Adapter = {
  id: 'chatgpt',
  label: 'ChatGPT',
  newChatUrl: 'https://chatgpt.com/',
  hosts: ['chatgpt.com', 'chat.openai.com'],
  composer: { input: ['#prompt-textarea', 'div[contenteditable="true"]', 'textarea'], file: ['input[type="file"]:not([accept^="image"])', 'input[type="file"]'] },
  conversationId: (u) => u.pathname.match(/\/c\/([0-9a-f-]{20,})/i)?.[1],
  async capture({ url, net, doc, maxFileBytes = 20 * MB, maxTotalBytes = 80 * MB }) {
    // Shared chats (/share/<id>): the page already carries the whole conversation; files are rebuilt from the code.
    if (/^\/share\//.test(url.pathname) && typeof doc?.documentElement?.outerHTML === 'string') {
      return { parsed: parseChatGPTShareHtml(doc.documentElement.outerHTML, url.href), captured: 0, failed: [] };
    }
    const id = this.conversationId(url);
    if (!id) throw new Error('Open a saved ChatGPT conversation (URL /c/<id>) or a shared chat to capture it.');
    const session = (await net.json('/api/auth/session')) as { accessToken?: string };
    if (!session?.accessToken) throw new Error('Not signed in to ChatGPT in this tab.');
    const headers: Record<string, string> = { authorization: `Bearer ${session.accessToken}` };
    // Team / Enterprise workspaces select the account with this header (value from the _account cookie).
    const account = typeof doc?.cookie === 'string' ? doc.cookie.match(/(?:^|;\s*)_account=([^;]+)/)?.[1] : undefined;
    if (account) headers['chatgpt-account-id'] = decodeURIComponent(account);
    const conv = (await net.json(`/backend-api/conversation/${id}`, { headers })) as Record<string, unknown>;
    const parsed = parseChatGPTConversation(conv, { kind: 'chatgpt-export', url: url.href });
    parsed.source = { ...parsed.source, kind: 'chatgpt-export', tool: 'ChatGPT (captured in page)', url: url.href };

    // Generated files: every sandbox path the conversation links to, fetched while the sandbox is alive.
    const wanted = new Map<string, string>(); // path -> message id
    for (const e of parsed.events) for (const op of extractSandboxReferences(e.text, e.id)) if (!wanted.has(op.path)) wanted.set(op.path, e.id);
    const capturedFiles: CapturedFile[] = [];
    const failed: string[] = [];
    let total = 0;
    for (const [path, messageId] of wanted) {
      try {
        const r = (await net.json(`/backend-api/conversation/${id}/interpreter/download?message_id=${encodeURIComponent(messageId)}&sandbox_path=${encodeURIComponent(path)}`, { headers })) as { download_url?: string; error_code?: string };
        if (!r?.download_url) throw new Error(r?.error_code ?? 'no download_url (sandbox expired?)');
        const bin = await net.binary(r.download_url);
        if (bin.size > maxFileBytes || total + bin.size > maxTotalBytes) throw new Error(`too large (${(bin.size / MB).toFixed(1)} MB)`);
        total += bin.size;
        capturedFiles.push({ path, ...asCaptured(bin, path), mimeType: bin.type, eventId: messageId, note: 'captured from the ChatGPT sandbox (exact bytes)' });
      } catch (err) {
        failed.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // User uploads (attachments / image parts) by file id.
    for (const m of Object.values((conv.mapping ?? {}) as Record<string, { message?: Record<string, unknown> }>)) {
      const atts = (m.message?.metadata as Record<string, unknown> | undefined)?.attachments;
      if (!Array.isArray(atts)) continue;
      for (const a of atts as Record<string, unknown>[]) {
        const fid = String(a.id ?? '');
        if (!fid) continue;
        const name = String(a.name ?? fid);
        try {
          const r = (await net.json(`/backend-api/files/${encodeURIComponent(fid)}/download`, { headers })) as { download_url?: string };
          if (!r?.download_url) throw new Error('no download_url');
          const bin = await net.binary(r.download_url);
          if (bin.size > maxFileBytes || total + bin.size > maxTotalBytes) throw new Error('too large');
          total += bin.size;
          capturedFiles.push({ path: `uploads/${name}`, ...asCaptured(bin, name), mimeType: bin.type, note: 'file the user uploaded (captured in page)' });
        } catch (err) {
          failed.push(`uploads/${name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    parsed.capturedFiles = capturedFiles;
    parsed.loss = [...(parsed.loss ?? []), ...captureLoss(failed)];
    return { parsed, captured: capturedFiles.length, failed };
  },
};

// ───────────────────────────── Claude ─────────────────────────────

export const claude: Adapter = {
  id: 'claude',
  label: 'Claude',
  newChatUrl: 'https://claude.ai/new',
  hosts: ['claude.ai'],
  composer: { input: ['div.ProseMirror[contenteditable="true"]', 'div[contenteditable="true"]', 'textarea'], file: ['input[data-testid="file-upload"]', 'input[type="file"]'] },
  conversationId: (u) => u.pathname.match(/\/chat\/([0-9a-f-]{20,})/i)?.[1],
  async capture({ url, net }) {
    const id = this.conversationId(url);
    if (!id) throw new Error('Open a Claude conversation (URL /chat/<id>) to capture it.');
    const orgs = (await net.json('/api/organizations')) as { uuid: string; capabilities?: string[] }[];
    const org = (Array.isArray(orgs) ? orgs.find((o) => o.capabilities?.includes('chat')) ?? orgs[0] : undefined)?.uuid;
    if (!org) throw new Error('Not signed in to Claude in this tab.');
    const conv = await net.json(`/api/organizations/${org}/chat_conversations/${id}?tree=True&rendering_mode=messages&render_all_tools=true`);
    const [parsed] = parseClaudeExport([conv]);
    if (!parsed) throw new Error('Unexpected conversation format from claude.ai');
    parsed.source = { ...parsed.source, tool: 'Claude (captured in page)', url: url.href };
    parsed.loss = (parsed.loss ?? []).filter((l) => l.category !== 'memory');
    return { parsed, captured: 0, failed: [] };
  },
};

// ───────────────────────────── Gemini and other sites (DOM) ─────────────────────────────

function textOf(el: Element, prefer?: string): string {
  const inner = prefer ? el.querySelector(prefer) : null;
  const clone = (inner ?? el).cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, svg, [aria-hidden="true"], .sr-only, .cdk-visually-hidden, .visually-hidden').forEach((n) => n.remove());
  clone.querySelectorAll('pre').forEach((pre) => {
    const code = pre.textContent ?? '';
    pre.replaceWith(Object.assign(el.ownerDocument.createElement('div'), { textContent: `\n\`\`\`\n${code.replace(/\n$/, '')}\n\`\`\`\n` }));
  });
  return (clone.innerText ?? clone.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export interface DomSpec {
  user: string;
  assistant: string;
  userText?: string; // preferred inner element for the text
  assistantText?: string;
}

export function domTurns(doc: Document, spec: DomSpec): { role: 'user' | 'assistant'; text: string }[] {
  const all = [...doc.querySelectorAll(`${spec.user}, ${spec.assistant}`)];
  // Keep outermost matches only (selectors can match nested wrappers of the same turn).
  const nodes = all.filter((n) => !all.some((o) => o !== n && o.contains(n)));
  return nodes
    .map((n) => {
      const role = (n.matches(spec.user) ? 'user' : 'assistant') as 'user' | 'assistant';
      return { role, text: textOf(n, role === 'user' ? spec.userText : spec.assistantText) };
    })
    .filter((t) => t.text);
}

function domCapture(label: string, spec: DomSpec, why?: string) {
  return async ({ url, doc }: CaptureContext): Promise<CaptureResult> => {
    const turns = domTurns(doc, spec);
    if (!turns.length) throw new Error(`No conversation found on this ${label} page${why ? ` (and the data API failed: ${why})` : ''}.`);
    const title = (doc.title || label).replace(/\s*[-|–]\s*(Gemini|Google|ChatGPT|Claude).*$/i, '').trim() || `${label} conversation`;
    const loss: LossItem[] = [{ category: 'dom-capture', count: turns.length, severity: 'warn', detail: `${label} was captured from the rendered page: visible text and code only. Tool outputs, files and hidden reasoning are not in the DOM.${why ? ` Fell back to the page because the data API failed: ${why}` : ''}` }];
    return {
      parsed: { title, source: { kind: 'unknown', tool: `${label} (captured in page)`, url: url.href }, events: turns.map((t, i) => ({ id: `d${i + 1}`, kind: 'message', role: t.role, text: t.text })), loss },
      captured: 0,
      failed: [],
    };
  };
}

const GEMINI_DOM: DomSpec = { user: 'user-query', assistant: 'model-response', userText: '.query-text', assistantText: 'message-content' };

export const gemini: Adapter = {
  id: 'gemini',
  label: 'Gemini',
  newChatUrl: 'https://gemini.google.com/app',
  hosts: ['gemini.google.com'],
  composer: { input: ['rich-textarea .ql-editor', 'div[contenteditable="true"]', 'textarea'], file: ['input[type="file"]'] },
  conversationId: (u) => u.pathname.match(/\/app\/([0-9a-f]+)/i)?.[1],
  capture: domCapture('Gemini', GEMINI_DOM),
};

/** Fallback for any chat page that marks roles in the DOM (many ChatGPT-like UIs do). */
export const dom: Adapter = {
  id: 'dom',
  label: 'This page',
  hosts: [],
  composer: { input: ['div[contenteditable="true"]', 'textarea'] },
  conversationId: () => undefined,
  capture: domCapture('this site', { user: '[data-message-author-role="user"], [data-role="user"]', assistant: '[data-message-author-role="assistant"], [data-role="assistant"]' }),
};

// Rendered-page selectors (fallbacks when a site's data API changes). Kept together so they are easy to update.
const CHATGPT_DOM: DomSpec = { user: '[data-message-author-role="user"]', assistant: '[data-message-author-role="assistant"]' };
const CLAUDE_DOM: DomSpec = { user: '[data-testid="user-message"]', assistant: '.font-claude-response, .font-claude-message' };

/** API capture first; if the site's internal API fails (changed, blocked), capture the rendered page instead. */
function withDomFallback(a: Adapter, label: string, spec: DomSpec): Adapter {
  const api = a.capture.bind(a);
  return {
    ...a,
    async capture(ctx) {
      try {
        return await api(ctx);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/^Open a /.test(msg) || typeof ctx.doc?.querySelectorAll !== 'function') throw err;
        return domCapture(label, spec, msg)(ctx);
      }
    },
  };
}

export const ADAPTERS: Adapter[] = [withDomFallback(chatgpt, 'ChatGPT', CHATGPT_DOM), withDomFallback(claude, 'Claude', CLAUDE_DOM), gemini];

export function adapterFor(url: URL, override?: string | null): Adapter {
  if (override) return ADAPTERS.find((a) => a.id === override) ?? dom;
  return ADAPTERS.find((a) => a.hosts.includes(url.hostname)) ?? dom;
}

function captureLoss(failed: string[]): LossItem[] {
  return failed.length
    ? [{ category: 'files-not-captured', count: failed.length, severity: 'warn', detail: `Some files could not be fetched from the source (${failed.slice(0, 5).join('; ')}${failed.length > 5 ? '; …' : ''}). ChatGPT sandboxes expire, so capture soon after the work.` }]
    : [];
}

export { isRecord };
