// Decoder for React Router "turbo-stream" payloads, the format chatgpt.com share pages embed as
// window.__reactRouterContext.streamController.enqueue("<json>").
//
// Encoding (reverse-engineered, see docs/research/02-source-formats.md):
//  - the payload is a JSON array; element 0 is the root value
//  - objects are {"_<keyIdx>": <valueIdx>}: keys and values are indices into the same array
//  - arrays hold value indices; arrays starting with a single-letter tag are typed values
//  - negative integers are sentinels (undefined / null / NaN / ±Infinity / -0)

const SENTINELS: Record<number, unknown> = {
  [-1]: undefined, // HOLE
  [-2]: Number.NaN,
  [-3]: Number.POSITIVE_INFINITY,
  [-4]: Number.NEGATIVE_INFINITY,
  [-5]: undefined,
  [-6]: -0,
  [-7]: null,
};

const TYPE_TAGS = new Set(['D', 'P', 'Y', 'R', 'E', 'S', 'M', 'Z', 'U', 'B']);

export function decodeTurboStream(payload: string | unknown[]): unknown {
  const arr = typeof payload === 'string' ? (JSON.parse(payload) as unknown[]) : payload;
  if (!Array.isArray(arr)) throw new Error('turbo-stream: payload is not an array');
  const cache = new Map<number, unknown>();

  const decode = (idx: unknown): unknown => {
    if (typeof idx !== 'number') return idx;
    if (idx < 0) return SENTINELS[idx];
    if (cache.has(idx)) return cache.get(idx);
    const v = arr[idx];
    if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === 'string' && TYPE_TAGS.has(v[0])) {
        const tagged = decodeTagged(v as [string, ...unknown[]]);
        cache.set(idx, tagged);
        return tagged;
      }
      const out: unknown[] = [];
      cache.set(idx, out);
      for (const item of v) out.push(decode(item));
      return out;
    }
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      cache.set(idx, out);
      for (const [k, vi] of Object.entries(v as Record<string, unknown>)) {
        const key = k.startsWith('_') ? String(arr[Number(k.slice(1))]) : k;
        out[key] = decode(vi);
      }
      return out;
    }
    cache.set(idx, v);
    return v;
  };

  const decodeTagged = (v: [string, ...unknown[]]): unknown => {
    const [tag, a] = v;
    if (tag === 'D') return new Date(a as number).toISOString();
    if (tag === 'Y') return Symbol.for(String(a));
    // Promises/streams/errors are not needed for share pages; keep raw for debugging.
    return { $turboTag: tag, value: v.slice(1) };
  };

  return decode(0);
}

/** Extract every `streamController.enqueue("...")` string literal from an HTML page, in order. */
export function extractEnqueuedChunks(html: string): string[] {
  const out: string[] = [];
  const re = /streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1]) as string);
    } catch {
      /* ignore malformed chunk */
    }
  }
  return out;
}

/** Decode the first chunk that parses as a turbo-stream array. */
export function decodeFromHtml(html: string): unknown {
  for (const chunk of extractEnqueuedChunks(html)) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith('[')) continue;
    const line = trimmed.split('\n')[0];
    try {
      return decodeTurboStream(line);
    } catch {
      /* try next */
    }
  }
  throw new Error('No React Router turbo-stream payload found in HTML');
}
