export function slugify(s: string, max = 48): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || 'conversation';
}

export function epochToIso(t: unknown): string | undefined {
  if (typeof t === 'number' && Number.isFinite(t) && t > 0) {
    return new Date(t < 1e12 ? t * 1000 : t).toISOString();
  }
  if (typeof t === 'string' && t) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]}]+/g;

export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.match(URL_RE) ?? []) out.push(m.replace(/[.,;:!?]+$/, ''));
  return out;
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + '…';
}

export function firstLine(s: string): string {
  return (s.split('\n').find((l) => l.trim()) ?? '').trim();
}

/** Deterministic JSON with sorted keys, used for hashing. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v as Record<string, unknown>)
    .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify((v as Record<string, unknown>)[k])).join(',') + '}';
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v, null, 2);
}

/** Pick a Markdown code fence that does not collide with the content. */
export function fence(content: string, lang = ''): string {
  let ticks = '```';
  while (content.includes(ticks)) ticks += '`';
  return `${ticks}${lang}\n${content.replace(/\n$/, '')}\n${ticks}`;
}

export function plural(n: number, word: string, pluralWord = word + 's'): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Raw bytes of an artifact's content, honouring its encoding. */
export function artifactBytes(a: { content?: string; encoding?: string }): Uint8Array | undefined {
  if (a.content === undefined) return undefined;
  return a.encoding === 'base64' ? base64ToBytes(a.content) : new TextEncoder().encode(a.content);
}
