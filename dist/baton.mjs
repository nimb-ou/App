#!/usr/bin/env node

// src/cli.ts
import { cpSync, existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync4 } from "node:fs";
import { join as join4, resolve as resolve3 } from "node:path";

// src/core/schema.ts
var SCHEMA_ID = "baton.bundle/v1";
var VERSION = "0.4.0";

// src/core/sha256.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var encoder = new TextEncoder();
function sha256Bytes(input) {
  const msg = typeof input === "string" ? encoder.encode(input) : input;
  const bitLen = msg.length * 8;
  const padded = new Uint8Array(msg.length + 9 + 63 >> 6 << 6);
  padded.set(msg);
  padded[msg.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296), false);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  const h = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a2 = w[i - 15], b2 = w[i - 2];
      const s0 = (a2 >>> 7 | a2 << 25) ^ (a2 >>> 18 | a2 << 14) ^ a2 >>> 3;
      const s1 = (b2 >>> 17 | b2 << 15) ^ (b2 >>> 19 | b2 << 13) ^ b2 >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = e & f ^ ~e & g;
      const t1 = hh + S1 + ch + K[i] + w[i] >>> 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i], false);
  return out;
}
function sha256Hex(input) {
  const b = sha256Bytes(input);
  let s2 = "";
  for (let i = 0; i < b.length; i++) s2 += b[i].toString(16).padStart(2, "0");
  return s2;
}

// src/core/util.ts
function slugify(s2, max = 48) {
  const slug = s2.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
  return slug || "conversation";
}
function epochToIso(t) {
  if (typeof t === "number" && Number.isFinite(t) && t > 0) {
    return new Date(t < 1e12 ? t * 1e3 : t).toISOString();
  }
  if (typeof t === "string" && t) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? void 0 : d.toISOString();
  }
  return void 0;
}
var URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]}]+/g;
function extractUrls(text2) {
  const out = [];
  for (const m of text2.match(URL_RE) ?? []) out.push(m.replace(/[.,;:!?]+$/, ""));
  return out;
}
function truncate(s2, n) {
  if (s2.length <= n) return s2;
  return s2.slice(0, Math.max(0, n - 1)).trimEnd() + "\u2026";
}
function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== void 0).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}
function isRecord(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function asString(v) {
  if (typeof v === "string") return v;
  if (v === null || v === void 0) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v, null, 2);
}
function fence(content, lang = "") {
  let ticks = "```";
  while (content.includes(ticks)) ticks += "`";
  return `${ticks}${lang}
${content.replace(/\n$/, "")}
${ticks}`;
}
function plural(n, word, pluralWord = word + "s") {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
function escapeHtml(s2) {
  return s2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function base64ToBytes(b64) {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
}
function artifactBytes(a) {
  if (a.content === void 0) return void 0;
  return a.encoding === "base64" ? base64ToBytes(a.content) : new TextEncoder().encode(a.content);
}

// src/core/integrity.ts
function eventPayload(e) {
  const { hash: _ignored, ...rest } = e;
  return stableStringify(rest);
}
function artifactPayload(a) {
  return stableStringify({ path: a.path, status: a.status, sha256: a.sha256 ?? null });
}
function chainEvents(events, artifacts) {
  let h = sha256Hex(SCHEMA_ID);
  for (const e of events) {
    h = sha256Hex(h + eventPayload(e));
    e.hash = h;
  }
  for (const a of [...artifacts].sort((x, y) => x.path.localeCompare(y.path))) {
    h = sha256Hex(h + artifactPayload(a));
  }
  return h;
}
function verifyBundle(bundle, files) {
  let h = sha256Hex(SCHEMA_ID);
  let firstBad;
  for (const e of bundle.events) {
    h = sha256Hex(h + eventPayload(e));
    if (!firstBad && e.hash && e.hash !== h) firstBad = e.id;
  }
  const badArtifacts = [];
  for (const a of [...bundle.artifacts].sort((x, y) => x.path.localeCompare(y.path))) {
    const onDisk = files?.[a.path];
    const shipped = onDisk !== void 0 ? typeof onDisk === "string" ? new TextEncoder().encode(onDisk) : onDisk : artifactBytes(a);
    const actual = shipped !== void 0 ? sha256Hex(shipped) : a.sha256;
    if (a.sha256 && actual !== a.sha256) badArtifacts.push(a.path);
    h = sha256Hex(h + artifactPayload({ ...a, sha256: actual }));
  }
  return {
    ok: h === bundle.integrity.root && !firstBad && badArtifacts.length === 0,
    root: h,
    expectedRoot: bundle.integrity.root,
    firstBadEvent: firstBad,
    badArtifacts
  };
}

// src/core/turbostream.ts
var SENTINELS = {
  [-1]: void 0,
  // HOLE
  [-2]: Number.NaN,
  [-3]: Number.POSITIVE_INFINITY,
  [-4]: Number.NEGATIVE_INFINITY,
  [-5]: void 0,
  [-6]: -0,
  [-7]: null
};
var TYPE_TAGS = /* @__PURE__ */ new Set(["D", "P", "Y", "R", "E", "S", "M", "Z", "U", "B"]);
function decodeTurboStream(payload) {
  const arr = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!Array.isArray(arr)) throw new Error("turbo-stream: payload is not an array");
  const cache = /* @__PURE__ */ new Map();
  const decode = (idx) => {
    if (typeof idx !== "number") return idx;
    if (idx < 0) return SENTINELS[idx];
    if (cache.has(idx)) return cache.get(idx);
    const v = arr[idx];
    if (Array.isArray(v)) {
      if (v.length > 0 && typeof v[0] === "string" && TYPE_TAGS.has(v[0])) {
        const tagged = decodeTagged(v);
        cache.set(idx, tagged);
        return tagged;
      }
      const out = [];
      cache.set(idx, out);
      for (const item of v) out.push(decode(item));
      return out;
    }
    if (v !== null && typeof v === "object") {
      const out = {};
      cache.set(idx, out);
      for (const [k, vi] of Object.entries(v)) {
        const key = k.startsWith("_") ? String(arr[Number(k.slice(1))]) : k;
        out[key] = decode(vi);
      }
      return out;
    }
    cache.set(idx, v);
    return v;
  };
  const decodeTagged = (v) => {
    const [tag, a] = v;
    if (tag === "D") return new Date(a).toISOString();
    if (tag === "Y") return Symbol.for(String(a));
    return { $turboTag: tag, value: v.slice(1) };
  };
  return decode(0);
}
function extractEnqueuedChunks(html) {
  const out = [];
  const re = /streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1]));
    } catch {
    }
  }
  return out;
}
function decodeFromHtml(html) {
  for (const chunk of extractEnqueuedChunks(html)) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith("[")) continue;
    const line = trimmed.split("\n")[0];
    try {
      return decodeTurboStream(line);
    } catch {
    }
  }
  throw new Error("No React Router turbo-stream payload found in HTML");
}

// src/parsers/chatgpt.ts
var REDACTED_PLACEHOLDER = "The output of this plugin was redacted.";
function findShareConversation(root) {
  if (isRecord(root)) {
    const loader = root.loaderData;
    if (isRecord(loader)) {
      for (const [route, data] of Object.entries(loader)) {
        if (!route.includes("share") || !isRecord(data)) continue;
        const sr = data.serverResponse;
        if (isRecord(sr) && isRecord(sr.data) && isRecord(sr.data.mapping)) return sr.data;
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const stack = [root];
  while (stack.length) {
    const v = stack.pop();
    if (!isRecord(v) && !Array.isArray(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    if (isRecord(v) && isRecord(v.mapping) && typeof v.current_node === "string") return v;
    for (const child of Array.isArray(v) ? v : Object.values(v)) stack.push(child);
  }
  throw new Error("ChatGPT share: conversation data not found in page payload");
}
function parseChatGPTShareHtml(html, url) {
  const root = decodeFromHtml(html);
  const conv = findShareConversation(root);
  return parseChatGPTConversation(conv, { kind: "chatgpt-share", url });
}
function parseChatGPTTurboStream(payload, url) {
  const conv = findShareConversation(decodeTurboStream(payload.trim().split("\n")[0]));
  return parseChatGPTConversation(conv, { kind: "chatgpt-share", url });
}
function parseChatGPTExport(json) {
  const list = Array.isArray(json) ? json : isRecord(json) ? [json] : [];
  return list.filter((c) => isRecord(c) && isRecord(c.mapping)).map((c) => parseChatGPTConversation(c, { kind: "chatgpt-export" }));
}
function activePath(mapping, currentNode) {
  const nodes = [];
  let id = currentNode;
  const guard = /* @__PURE__ */ new Set();
  if (!id || !isRecord(mapping[id])) {
    const rootId = Object.keys(mapping).find((k) => {
      const n = mapping[k];
      return isRecord(n) && !n.parent;
    });
    id = rootId;
    while (id && isRecord(mapping[id])) {
      const kids = mapping[id].children;
      if (!Array.isArray(kids) || kids.length === 0) break;
      id = String(kids[kids.length - 1]);
    }
  }
  while (id && isRecord(mapping[id]) && !guard.has(id)) {
    guard.add(id);
    const node = mapping[id];
    nodes.push(node);
    id = typeof node.parent === "string" ? node.parent : void 0;
  }
  return nodes.reverse();
}
function cleanEntities(text2, counters) {
  return text2.replace(/([a-z_]+)((?:[^]*)*)/g, (_m, name, argStr) => {
    const args = argStr.split("\uE202").filter(Boolean);
    if (name === "cite") {
      counters.cites++;
      return ` [cite: ${args.join(", ")}]`;
    }
    if (name === "url" && args.length >= 2 && /^https?:\/\//.test(args[1])) return `[${args[0]}](${args[1]})`;
    if (name === "image_group") {
      counters.images++;
      try {
        const q = JSON.parse(args[0] ?? "{}");
        return `*[image: ${(q.query ?? []).join("; ")}]*`;
      } catch {
        return "*[image]*";
      }
    }
    return `[${name}${args.length ? ": " + args.join(", ") : ""}]`;
  }).replace(/[-]/g, "");
}
function jsxToMarkdown(text2, counters) {
  return text2.replace(/<Cite refs=\{\[([^\]]*)\]\}\s*\/>/g, (_m, refs) => {
    counters.cites++;
    return ` [cite: ${refs.replace(/["\s]/g, "").split(",").join(", ")}]`;
  }).replace(/<AsyncImage[^>]*query="([^"]*)"[^>]*\/>/g, (_m, q) => {
    counters.images++;
    return `*[image: ${q}]*`;
  }).replace(/<button[^>]*GenUI\.openUrl\("([^"]+)"\)[^>]*>([\s\S]*?)<\/button>/g, (_m, url, label) => `[${label.replace(/<[^>]+>/g, "").trim()}](${url})`).replace(/<title[^>]*>([\s\S]*?)<\/title\s*>?/g, "**$1**").replace(/<badge[^>]*>([\s\S]*?)<\/badge>/g, "`$1`").replace(/<\/?(?:box|grid|grid-item|row|text|divider|icon|list|list-item)\b[^>]*\/?>/g, "").replace(/\n{3,}/g, "\n\n");
}
function parseChatGPTConversation(conv, opts) {
  const mapping = conv.mapping ?? {};
  const path = activePath(mapping, typeof conv.current_node === "string" ? conv.current_node : void 0);
  const counters = { cites: 0, images: 0 };
  const events = [];
  let userAttachments = 0;
  let imageParts = 0;
  let models = /* @__PURE__ */ new Set();
  for (const node of path) {
    const msg = node.message;
    if (!isRecord(msg)) continue;
    const author = msg.author ?? {};
    const role = String(author.role ?? "assistant");
    const content = msg.content ?? {};
    const ct = String(content.content_type ?? "text");
    const md = msg.metadata ?? {};
    const recipient = typeof msg.recipient === "string" ? msg.recipient : "all";
    const time = epochToIso(msg.create_time);
    const model = typeof md.model_slug === "string" ? md.model_slug : typeof md.resolved_model_slug === "string" ? md.resolved_model_slug : void 0;
    if (model) models.add(model);
    const hiddenInUi = md.is_visually_hidden_from_conversation === true;
    const titles = Array.isArray(md.reasoning_titles) ? md.reasoning_titles.map(String) : [];
    const title = typeof md.reasoning_title === "string" ? md.reasoning_title : titles[0];
    const base = { id: String(msg.id ?? node.id ?? ""), time, model };
    if (role === "system" || ct === "model_editable_context" || ct === "user_editable_context") {
      const txt = ct === "model_editable_context" ? asString(content.model_set_context) : partsText(content);
      if (!txt.trim()) continue;
      events.push({ ...base, kind: "note", role: "system", text: txt, hidden: true, meta: { private: true, contentType: ct } });
      continue;
    }
    if (ct === "thoughts") {
      const thoughts = Array.isArray(content.thoughts) ? content.thoughts : [];
      const text3 = thoughts.map((t) => {
        const s2 = asString(t.summary).trim();
        const c = asString(t.content).trim();
        return c ? `**${s2}.** ${c}` : s2 ? `**${s2}.**` : "";
      }).filter(Boolean).join("\n\n");
      if (text3) events.push({ ...base, kind: "reasoning", role: "assistant", text: text3, meta: { granularity: "summary" } });
      continue;
    }
    if (ct === "reasoning_recap") {
      events.push({ ...base, kind: "note", role: "assistant", text: asString(content.content), meta: { recap: true } });
      continue;
    }
    if (role === "tool") {
      const text3 = ct === "execution_output" ? asString(content.text) : partsText(content) || asString(content.text) || asString(content.result);
      const redacted = text3.trim() === REDACTED_PLACEHOLDER;
      events.push({
        ...base,
        kind: "tool_result",
        role: "tool",
        text: redacted ? "" : text3,
        tool: { name: String(author.name ?? recipient), title },
        redactedBySource: redacted || void 0,
        hidden: hiddenInUi || void 0
      });
      continue;
    }
    if (role === "assistant" && recipient !== "all" && recipient !== "assistant") {
      const input = ct === "code" ? asString(content.text) : partsText(content);
      const redacted = input.trim() === REDACTED_PLACEHOLDER || input.trim() === "";
      events.push({
        ...base,
        kind: "tool_call",
        role: "assistant",
        text: title ?? "",
        tool: {
          name: recipient,
          title: titles.length > 1 ? titles.join(" \xB7 ") : title,
          language: ct === "code" ? normaliseLang(asString(content.language), input) : void 0,
          input: redacted ? void 0 : input
        },
        redactedBySource: redacted || void 0,
        hidden: hiddenInUi || void 0
      });
      continue;
    }
    let text2;
    const dil = isRecord(md.model_dil_v2) ? md.model_dil_v2 : void 0;
    if (role === "assistant" && dil && typeof dil.fallbackMarkdown === "string" && dil.fallbackMarkdown.trim()) {
      text2 = cleanEntities(dil.fallbackMarkdown, counters);
    } else {
      const parts = Array.isArray(content.parts) ? content.parts : [];
      text2 = parts.map((p) => {
        if (typeof p === "string") return p;
        if (isRecord(p) && String(p.content_type ?? "").includes("image")) {
          imageParts++;
          return "*[image attachment, not included by source]*";
        }
        return asString(p);
      }).join("\n");
      text2 = role === "assistant" ? jsxToMarkdown(cleanEntities(text2, counters), counters) : text2;
    }
    if (role === "user" && Array.isArray(md.attachments)) {
      for (const a of md.attachments) {
        userAttachments++;
        events.push({ ...base, id: `${base.id}-att-${userAttachments}`, kind: "attachment", role: "user", text: `Attached file: ${asString(a.name) || "unnamed"}`, meta: { name: a.name, mimeType: a.mime_type ?? a.mimeType, size: a.size } });
      }
    }
    if (!text2.trim()) continue;
    events.push({
      ...base,
      kind: "message",
      role: role === "user" ? "user" : "assistant",
      text: text2,
      hidden: hiddenInUi || void 0,
      meta: hiddenInUi ? { channel: "commentary" } : void 0
    });
  }
  const loss = [];
  const offPath = Object.keys(mapping).length - path.length;
  if (offPath > 0) loss.push({ category: "branches", count: offPath, severity: "info", detail: `${offPath} message node(s) belong to edited/regenerated branches that are not on the active path and were not exported.` });
  if (counters.cites) loss.push({ category: "citations", count: counters.cites, severity: "warn", detail: `${counters.cites} inline citation marker(s) point to search results that the source did not include; only marker ids survive. See links for the source's URL list.` });
  if (counters.images + imageParts) loss.push({ category: "images", count: counters.images + imageParts, severity: "info", detail: "Images shown in the conversation are not included; placeholders keep their search query where available." });
  if (userAttachments) loss.push({ category: "user-attachments", count: userAttachments, severity: "warn", detail: "Files the user uploaded are referenced by name only; their contents are not part of the source." });
  if (events.some((e) => e.kind === "reasoning")) loss.push({ category: "reasoning-depth", count: events.filter((e) => e.kind === "reasoning").length, severity: "info", detail: "Reasoning is available as the summaries ChatGPT displays, not the full internal chain of thought." });
  const modelInfo = isRecord(conv.model) ? asString(conv.model.slug) : typeof conv.default_model_slug === "string" ? conv.default_model_slug : void 0;
  const sourceLinks = Array.isArray(conv.safe_urls) ? conv.safe_urls.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)) : [];
  const conversationId = asString(conv.conversation_id) || asString(conv.id) || void 0;
  return {
    title: asString(conv.title) || "Untitled ChatGPT conversation",
    source: {
      kind: opts.kind,
      tool: "ChatGPT",
      url: opts.url,
      conversationId,
      createdAt: epochToIso(conv.create_time),
      updatedAt: epochToIso(conv.update_time),
      model: modelInfo || [...models][0]
    },
    events,
    sourceLinks,
    loss
  };
}
function partsText(content) {
  const parts = Array.isArray(content.parts) ? content.parts : [];
  return parts.map((p) => typeof p === "string" ? p : asString(p)).join("\n");
}
function normaliseLang(lang, code) {
  if (lang && lang !== "unknown") return lang;
  if (/^\s*(bash|sh)\s+-l?c\b/.test(code) || /^\s*(cd|ls|cat|mkdir|cp|python|pip|zip)\b/.test(code)) return "bash";
  if (/^\s*(import|from|def|print)\b/m.test(code)) return "python";
  return "";
}

// src/parsers/claude.ts
function parseClaudeExport(json) {
  const list = Array.isArray(json) ? json : isRecord(json) ? [json] : [];
  return list.filter((c) => isRecord(c) && Array.isArray(c.chat_messages)).map((c) => parseClaudeConversation(c));
}
function parseClaudeConversation(conv) {
  const events = [];
  const attachments = [];
  let filesWithoutContent = 0;
  let n = 0;
  for (const m of conv.chat_messages) {
    const role = m.sender === "human" ? "user" : "assistant";
    const time = epochToIso(m.created_at);
    const baseId = asString(m.uuid) || `m${++n}`;
    const blocks = Array.isArray(m.content) ? m.content : [];
    if (blocks.length) {
      blocks.forEach((b, i) => pushBlock(events, b, `${baseId}-${i}`, role, time));
    } else if (asString(m.text).trim()) {
      events.push({ id: baseId, kind: "message", role, time, text: asString(m.text) });
    }
    for (const a of Array.isArray(m.attachments) ? m.attachments : []) {
      const name = asString(a.file_name) || "attachment.txt";
      const extracted = asString(a.extracted_content);
      events.push({ id: `${baseId}-att-${name}`, kind: "attachment", role: "user", time, text: `Attached file: ${name}`, meta: { size: a.file_size, type: a.file_type } });
      if (extracted) attachments.push({ path: `attachments/${name}`, content: extracted, note: "text extracted by Claude at upload time" });
      else filesWithoutContent++;
    }
    for (const f of Array.isArray(m.files) ? m.files : []) {
      filesWithoutContent++;
      events.push({ id: `${baseId}-file-${asString(f.file_name)}`, kind: "attachment", role: "user", time, text: `Attached file: ${asString(f.file_name) || "file"}` });
    }
  }
  const loss = [];
  if (filesWithoutContent) loss.push({ category: "user-attachments", count: filesWithoutContent, severity: "warn", detail: "Uploaded files without extracted text (images, binaries) are referenced by name only." });
  loss.push({ category: "memory", count: 1, severity: "info", detail: "Claude exports do not include memory or project knowledge; only conversation messages." });
  return {
    title: asString(conv.name) || "Untitled Claude conversation",
    source: { kind: "claude-export", tool: "Claude", conversationId: asString(conv.uuid) || void 0, createdAt: epochToIso(conv.created_at), updatedAt: epochToIso(conv.updated_at) },
    events,
    attachments,
    loss
  };
}
function pushBlock(events, b, id, role, time, model) {
  const type = asString(b.type);
  if (type === "text") {
    const text2 = asString(b.text);
    if (text2.trim()) events.push({ id, kind: "message", role, time, model, text: text2 });
  } else if (type === "thinking" || type === "redacted_thinking") {
    const text2 = asString(b.thinking);
    events.push({
      id,
      kind: "reasoning",
      role: "assistant",
      time,
      model,
      text: text2,
      redactedBySource: !text2.trim() || type === "redacted_thinking" || void 0,
      meta: { granularity: "full" }
    });
  } else if (type === "tool_use" || type === "server_tool_use") {
    const input = b.input;
    const name = asString(b.name) || "tool";
    const args = FILE_TOOLS.has(name) && isRecord(input) ? input : void 0;
    events.push({ id, kind: "tool_call", role: "assistant", time, model, text: describeToolCall(name, input), tool: { name, callId: asString(b.id) || void 0, input: toolInputText(name, input), language: toolLang(name), args } });
  } else if (type === "tool_result" || type.endsWith("_tool_result")) {
    const text2 = toolResultText(b.content);
    events.push({ id, kind: "tool_result", role: "tool", time, text: text2, tool: { name: asString(b.name) || "tool", callId: asString(b.tool_use_id) || void 0 }, meta: b.is_error ? { isError: true } : void 0 });
  } else if (type === "image" || type === "document") {
    events.push({ id, kind: "attachment", role, time, text: `*[${type} attachment, binary content not included]*` });
  }
}
function describeToolCall(name, input) {
  if (!isRecord(input)) return name;
  const hint = input.description ?? input.file_path ?? input.path ?? input.query ?? input.url ?? input.pattern ?? input.command;
  return hint ? `${name}: ${asString(hint).split("\n")[0].slice(0, 160)}` : name;
}
var FILE_TOOLS = /* @__PURE__ */ new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "artifacts", "create_file", "str_replace"]);
function toolInputText(name, input) {
  if (isRecord(input)) {
    if ((name === "Bash" || name === "bash_tool") && typeof input.command === "string") return input.command;
    if (name === "artifacts") return `${asString(input.command)} ${asString(input.id)}${input.title ? ` "${asString(input.title)}"` : ""}  (${asString(input.content || input.new_str).length} chars \u2192 recovered file)`;
    if (name === "create_file") return `${asString(input.path)}  (${asString(input.file_text).length} chars \u2192 recovered file)`;
    if (name === "Write" && typeof input.content === "string") return `${asString(input.file_path)}  (${input.content.length} chars \u2192 recovered file)`;
    if (name === "Edit") return `${asString(input.file_path)}  (edit: ${asString(input.old_string).length} \u2192 ${asString(input.new_string).length} chars)`;
  }
  return asString(input);
}
function toolLang(name) {
  if (name === "Bash" || name === "bash_tool") return "bash";
  return "json";
}
function toolResultText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return asString(content);
  return content.map((c) => {
    if (c.type === "text") return asString(c.text);
    if (c.type === "image") return "*[image output]*";
    if (c.type === "tool_reference") return `(tool loaded: ${asString(c.tool_name)})`;
    return asString(c);
  }).join("\n");
}
var SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
function parseClaudeCodeJsonl(text2) {
  const events = [];
  let title = "";
  let sessionId;
  let cwd;
  let gitBranch;
  let model;
  let firstTime;
  let lastTime;
  let reminders = 0;
  let badLines = 0;
  let sidechain = 0;
  const toolNames = /* @__PURE__ */ new Map();
  const lines = text2.split("\n");
  lines.forEach((line, li) => {
    if (!line.trim()) return;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      badLines++;
      return;
    }
    if (o.type === "summary" && typeof o.summary === "string" && !title) title = o.summary;
    if (o.type !== "user" && o.type !== "assistant") return;
    const msg = o.message;
    if (!isRecord(msg)) return;
    sessionId ??= asString(o.sessionId) || void 0;
    cwd ??= asString(o.cwd) || void 0;
    gitBranch ??= asString(o.gitBranch) || void 0;
    const time = epochToIso(o.timestamp);
    if (time) {
      firstTime ??= time;
      lastTime = time;
    }
    if (o.isSidechain) sidechain++;
    const id = asString(o.uuid) || `l${li}`;
    const role = o.type === "user" ? "user" : "assistant";
    const m = typeof msg.model === "string" ? msg.model : void 0;
    if (m && !m.startsWith("<")) model = m;
    const isMeta = o.isMeta === true;
    if (typeof msg.content === "string") {
      const cleaned = msg.content.replace(SYSTEM_REMINDER, () => {
        reminders++;
        return "";
      });
      if (!cleaned.trim()) return;
      const priv = isMeta || /^<(?:command-|local-command-)/.test(cleaned.trim());
      events.push({ id, kind: priv ? "note" : "message", role, time, text: cleaned.trim(), hidden: priv || void 0, meta: priv ? { private: isMeta } : o.isSidechain ? { sidechain: true } : void 0 });
      return;
    }
    if (!Array.isArray(msg.content)) return;
    msg.content.forEach((b, i) => {
      if (b.type === "text" && typeof b.text === "string") {
        const cleaned = b.text.replace(SYSTEM_REMINDER, () => {
          reminders++;
          return "";
        });
        if (!cleaned.trim()) return;
        b = { ...b, text: cleaned.trim() };
      }
      if (b.type === "tool_use") toolNames.set(asString(b.id), asString(b.name));
      if (b.type === "tool_result") b = { ...b, name: toolNames.get(asString(b.tool_use_id)) ?? "tool", content: stripReminders(b.content, () => reminders++) };
      const before = events.length;
      pushBlock(events, b, `${id}-${i}`, role, time, m);
      if (isMeta) for (let k = before; k < events.length; k++) events[k] = { ...events[k], hidden: true, meta: { ...events[k].meta ?? {}, private: true } };
      if (o.isSidechain) for (let k = before; k < events.length; k++) events[k] = { ...events[k], meta: { ...events[k].meta ?? {}, sidechain: true } };
    });
  });
  if (!title) {
    const firstUser = events.find((e) => e.kind === "message" && e.role === "user" && e.text.trim().length > 3);
    title = firstUser ? firstUser.text.split("\n")[0].slice(0, 80) : "Claude Code session";
  }
  const loss = [];
  const encrypted = events.filter((e) => e.kind === "reasoning" && e.redactedBySource).length;
  if (encrypted) loss.push({ category: "reasoning-depth", count: encrypted, severity: "info", detail: "Thinking blocks are stored as signatures only (no plaintext) in this log, so reasoning cannot be transferred. Decisions are captured in the visible messages and tool calls." });
  if (reminders) loss.push({ category: "harness-context", count: reminders, severity: "info", detail: "Harness-injected <system-reminder> blocks were removed (private runtime context, not part of the work)." });
  if (badLines) loss.push({ category: "unreadable-lines", count: badLines, severity: "warn", detail: "Some JSONL lines could not be parsed and were skipped." });
  if (sidechain) loss.push({ category: "subagents", count: sidechain, severity: "info", detail: "Sub-agent (sidechain) traffic is included and tagged; it may duplicate summaries already in the main thread." });
  return {
    title,
    source: { kind: "claude-code", tool: "Claude Code", conversationId: sessionId, createdAt: firstTime, updatedAt: lastTime, model, cwd, gitBranch },
    events,
    loss
  };
}
function stripReminders(content, onHit) {
  if (typeof content === "string") return content.replace(SYSTEM_REMINDER, () => (onHit(), ""));
  if (Array.isArray(content)) return content.map((c) => isRecord(c) && typeof c.text === "string" ? { ...c, text: c.text.replace(SYSTEM_REMINDER, () => (onHit(), "")) } : c);
  return content;
}

// src/parsers/generic.ts
function looksLikeMessages(json) {
  const list = isRecord(json) && Array.isArray(json.messages) ? json.messages : json;
  return Array.isArray(list) && list.length > 0 && list.every((m) => isRecord(m) && typeof m.role === "string" && "content" in m);
}
function parseMessagesLog(json, title = "Imported conversation") {
  const root = isRecord(json) ? json : {};
  const list = Array.isArray(json) ? json : root.messages;
  const events = [];
  list.forEach((m, i) => {
    const role = m.role === "user" || m.role === "assistant" || m.role === "tool" ? m.role : "system";
    const id = `m${i + 1}`;
    if (Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        const fn = isRecord(tc.function) ? tc.function : {};
        events.push({ id: `${id}-${asString(tc.id)}`, kind: "tool_call", role: "assistant", text: asString(fn.name), tool: { name: asString(fn.name) || "tool", input: asString(fn.arguments), callId: asString(tc.id), language: "json" } });
      }
    }
    const content = Array.isArray(m.content) ? m.content.map((c) => typeof c === "string" ? c : asString(c.text ?? c)).join("\n") : asString(m.content);
    if (!content.trim()) return;
    if (role === "tool") {
      events.push({ id, kind: "tool_result", role: "tool", text: content, tool: { name: asString(m.name) || "tool", callId: asString(m.tool_call_id) || void 0 } });
    } else {
      events.push({ id, kind: role === "system" ? "note" : "message", role, text: content, hidden: role === "system" || void 0, meta: role === "system" ? { private: true } : void 0 });
    }
  });
  return {
    title: asString(root.title) || title,
    source: { kind: "openai-messages", tool: "Chat log", model: asString(root.model) || void 0 },
    events
  };
}

// src/parsers/detect.ts
function detectFormat(text2, filename = "") {
  const t = text2.trimStart();
  const name = filename.toLowerCase();
  if (t.startsWith("<") || name.endsWith(".html") || name.endsWith(".htm")) {
    if (t.includes("streamController.enqueue")) return { kind: "chatgpt-share", reason: "HTML with React Router stream (ChatGPT share page)" };
    return { kind: "unknown", reason: "HTML without a recognised conversation payload" };
  }
  if (name.endsWith(".jsonl") || isJsonl(t)) {
    if (/"type"\s*:\s*"(?:user|assistant|summary)"/.test(t.slice(0, 2e5)) && /"sessionId"|"parentUuid"/.test(t.slice(0, 2e5))) {
      return { kind: "claude-code", reason: "JSON Lines with Claude Code session records" };
    }
  }
  if (t.startsWith('[{"_') || /^\[\{"_\d+":/.test(t)) return { kind: "chatgpt-share", reason: "raw turbo-stream payload" };
  let json;
  try {
    json = JSON.parse(t);
  } catch {
    return { kind: "unknown", reason: "not JSON, JSONL or a recognised HTML page" };
  }
  const first = Array.isArray(json) ? json[0] : json;
  if (isRecord(first)) {
    if (first.schema === "baton.bundle/v1") return { kind: "baton-bundle", reason: "already a Baton bundle" };
    if (isRecord(first.mapping)) return { kind: "chatgpt-export", reason: "conversation objects with a `mapping` tree (ChatGPT export)" };
    if (Array.isArray(first.chat_messages)) return { kind: "claude-export", reason: "conversation objects with `chat_messages` (Claude export)" };
  }
  if (looksLikeMessages(json)) return { kind: "openai-messages", reason: "[{role, content}] message list" };
  return { kind: "unknown", reason: "JSON, but no known conversation shape" };
}
function isJsonl(t) {
  const lines = t.split("\n", 3).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.every((l) => l.trim().startsWith("{") && l.trim().endsWith("}"));
}
function parseAny(text2, filename = "", url) {
  const d = detectFormat(text2, filename);
  switch (d.kind) {
    case "chatgpt-share":
      return [text2.trimStart().startsWith("<") ? parseChatGPTShareHtml(text2, url) : parseChatGPTTurboStream(text2, url)];
    case "chatgpt-export":
      return parseChatGPTExport(JSON.parse(text2));
    case "claude-export":
      return parseClaudeExport(JSON.parse(text2));
    case "claude-code":
      return [parseClaudeCodeJsonl(text2)];
    case "openai-messages":
      return [parseMessagesLog(JSON.parse(text2), filename.replace(/\.[^.]+$/, "") || void 0)];
    default:
      throw new Error(`Unsupported input${filename ? ` (${filename})` : ""}: ${d.reason}`);
  }
}

// src/recover/artifacts.ts
var IGNORED_PREFIXES = ["/tmp/", "/dev/", "/proc/", "/sys/", "/etc/", "/usr/", "/home/oai/", "/root/."];
var IGNORED_PARTS = ["/node_modules/", "/.git/", "/__pycache__/"];
function ignorable(p) {
  if (/[$`*?{}]/.test(p)) return true;
  return IGNORED_PREFIXES.some((x) => p.startsWith(x)) || IGNORED_PARTS.some((x) => p.includes(x)) || p === "/dev/null";
}
function resolvePath(p, cwd) {
  const unq = p.replace(/^['"]|['"]$/g, "");
  if (unq.startsWith("/")) return normaliseDots(unq);
  if (unq.startsWith("~")) return unq;
  return normaliseDots(`${cwd.replace(/\/$/, "")}/${unq}`);
}
function normaliseDots(p) {
  const out = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return "/" + out.join("/");
}
var HEREDOC_RE = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/g;
var pathToken = (q) => `(['"]?)([^\\s'"<>|;&()]+)\\${q}`;
function unwrapShell(input) {
  const t = input.trim();
  if (t.startsWith("{")) {
    try {
      const o = JSON.parse(t);
      if (Array.isArray(o.cmd) && typeof o.cmd[o.cmd.length - 1] === "string") return o.cmd[o.cmd.length - 1];
    } catch {
    }
  }
  return t.replace(/^(?:bash|sh)\s+-l?c\s+/, "");
}
function segmentAt(line, index) {
  const seps = /&&|\|\||;|\|/g;
  let start = 0;
  let end = line.length;
  let m;
  while ((m = seps.exec(line)) !== null) {
    if (m.index < index) start = m.index + m[0].length;
    else {
      end = m.index;
      break;
    }
  }
  return line.slice(start, end);
}
function extractShellOps(input, eventId, initialCwd = "/") {
  const script = unwrapShell(input);
  const lines = script.split("\n");
  const ops = [];
  let cwd = initialCwd;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lineCwd = cwd;
    const cds = [...line.matchAll(/(?:^|&&|;|\|\|)\s*cd\s+(['"]?)([^\s'";&|]+)\1/g)];
    const cwdAt = (idx) => cds.reduce((c, m) => (m.index ?? 0) < idx ? resolvePath(m[2], c) : c, lineCwd);
    const heredocs = [...line.matchAll(HEREDOC_RE)];
    for (const seg of line.matchAll(/[^;&|]+/g)) {
      const start = seg.index ?? 0;
      const end = start + seg[0].length;
      if (heredocs.some((h) => (h.index ?? 0) >= start && (h.index ?? 0) < end)) continue;
      ops.push(...shellModifications(seg[0], eventId, cwdAt(start)));
    }
    cwd = cwdAt(line.length);
    let j = i + 1;
    for (const h of heredocs) {
      const strip = h[1] === "-";
      const quoted = h[2] !== "";
      const delim = h[3];
      const body = [];
      while (j < lines.length) {
        const raw = lines[j];
        const cmp = strip ? raw.replace(/^\t+/, "") : raw;
        j++;
        if (cmp === delim) break;
        body.push(strip ? cmp : raw);
      }
      const seg = segmentAt(line, h.index ?? 0);
      const catT = seg.match(new RegExp(String.raw`\bcat\b[^>]*?(>>?)\s*` + pathToken(2)));
      const teeT = seg.match(new RegExp(String.raw`\btee\s+(-a\s+)?` + pathToken(2)));
      const content = body.length ? body.join("\n") + "\n" : "";
      if (catT || teeT) {
        const append = catT ? catT[1] === ">>" : Boolean(teeT && teeT[1]);
        const path = resolvePath(catT ? catT[3] : teeT[3], cwdAt(h.index ?? 0));
        if (!ignorable(path)) {
          const expands = !quoted && /[$`\\]/.test(content);
          ops.push({ kind: append ? "append" : "write", path, eventId, content, note: expands ? "unquoted heredoc: shell expansions ($VAR, `cmd`) were not evaluated" : void 0 });
        }
      } else {
        ops.push(...pythonModifications(content, eventId, cwdAt(h.index ?? 0)));
      }
    }
    i = j;
  }
  return ops;
}
function shellModifications(line, eventId, cwd) {
  const ops = [];
  const add = (p, note) => {
    if (!/[./]/.test(p)) return;
    const path = resolvePath(p, cwd);
    if (!ignorable(path) && !/^-/.test(p)) ops.push({ kind: "touch", path, eventId, note });
  };
  for (const m of line.matchAll(new RegExp(String.raw`(?<![0-9&<>=-])(>>?)\s*` + pathToken(2), "g"))) add(m[3], m[1] === ">>" ? "appended by shell redirect" : "overwritten by shell redirect");
  for (const m of line.matchAll(new RegExp(String.raw`(?<![\w./-])sed\s+-i\S*\s+(?:'[^']*'|"[^"]*"|\S+)\s+` + pathToken(1), "g"))) add(m[2], "edited in place by sed -i");
  for (const m of line.matchAll(new RegExp(String.raw`(?<![\w./-])(?:cp|mv)\s+(?:-\S+\s+)*\S+\s+` + pathToken(1), "g"))) add(m[2], "replaced by cp/mv");
  for (const m of line.matchAll(new RegExp(String.raw`(?<![\w./-])zip\s+(?:-\S+\s+)*` + pathToken(1), "g"))) add(m[2], "archive produced by zip");
  return ops;
}
function pythonModifications(code, eventId, cwd) {
  const ops = [];
  const vars = /* @__PURE__ */ new Map();
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\s*=\s*(?:Path\(\s*)?(['"])([^'"\n]+)\2/g)) {
    if (m[3].includes("/") || /\.\w{1,6}$/.test(m[3])) vars.set(m[1], m[3]);
  }
  const touch = (raw, note) => {
    const lit = raw.match(/^(['"])(.+)\1$/);
    const p = lit ? lit[2] : vars.get(raw);
    if (!p || !/\.\w{1,6}$/.test(p)) return;
    const path = resolvePath(p, cwd);
    if (!ignorable(path)) ops.push({ kind: "touch", path, eventId, note });
  };
  for (const m of code.matchAll(/open\(\s*([A-Za-z_]\w*|(['"])[^'"\n]+\2)\s*,\s*['"](?:w|a|wb|ab|w\+|a\+)['"]/g)) touch(m[1], 'rewritten by Python open(\u2026, "w")');
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\.write_(?:text|bytes)\(/g)) touch(m[1], "rewritten by Python write_text");
  for (const m of code.matchAll(/Path\(\s*((['"])[^'"\n]+\2)\s*\)\.write_(?:text|bytes)\(/g)) touch(m[1], "rewritten by Python write_text");
  for (const m of code.matchAll(/\.(?:save|savefig|to_csv|to_json|to_excel|write_pdf)\(\s*([A-Za-z_]\w*|(['"])[^'"\n]+\2)/g)) touch(m[1], "generated by Python (binary or derived output)");
  return ops;
}
var ARTIFACT_EXT = {
  "application/vnd.ant.code": "",
  "text/markdown": ".md",
  "text/html": ".html",
  "image/svg+xml": ".svg",
  "application/vnd.ant.react": ".jsx",
  "application/vnd.ant.mermaid": ".mmd"
};
var LANG_EXT = { python: ".py", javascript: ".js", typescript: ".ts", tsx: ".tsx", jsx: ".jsx", html: ".html", css: ".css", json: ".json", bash: ".sh", shell: ".sh", sql: ".sql", rust: ".rs", go: ".go", java: ".java", markdown: ".md", yaml: ".yaml" };
function artifactOps(args, eventId, paths) {
  const id = asString(args.id) || "artifact";
  const type = asString(args.type);
  const ext = ARTIFACT_EXT[type] || LANG_EXT[asString(args.language).toLowerCase()] || (type ? "" : ".txt");
  const known = paths.get(id);
  const path = known && (args.command === "update" || !type) ? known : `/claude-artifacts/${id}${ext || ".txt"}`;
  paths.set(id, path);
  const cmd = asString(args.command);
  if (cmd === "update") return [{ kind: "replace", path, eventId, old: asString(args.old_str), new: asString(args.new_str) }];
  if (cmd === "create" || cmd === "rewrite") return [{ kind: "write", path, eventId, content: asString(args.content) }];
  return [];
}
function extractToolArgOps(name, args, eventId, artifactPaths = /* @__PURE__ */ new Map()) {
  if (name === "artifacts") return artifactOps(args, eventId, artifactPaths);
  const path = asString(args.file_path || args.notebook_path || args.path);
  if (!path) return [];
  if (name === "Write") return [{ kind: "write", path, eventId, content: asString(args.content) }];
  if (name === "create_file") return [{ kind: "write", path, eventId, content: asString(args.file_text) }];
  if (name === "str_replace") return [{ kind: "replace", path, eventId, old: asString(args.old_str), new: asString(args.new_str) }];
  if (name === "Edit") return [{ kind: "replace", path, eventId, old: asString(args.old_string), new: asString(args.new_string), all: args.replace_all === true }];
  if (name === "MultiEdit" && Array.isArray(args.edits)) {
    return args.edits.filter(isRecord).map((e) => ({ kind: "replace", path, eventId, old: asString(e.old_string), new: asString(e.new_string), all: e.replace_all === true }));
  }
  return [{ kind: "touch", path, eventId, note: `modified by ${name}` }];
}
function extractSandboxReferences(text2, eventId) {
  const ops = [];
  for (const m of text2.matchAll(/sandbox:(\/mnt\/data\/[^\s)\]"'>`]+)/g)) {
    const p = m[1].replace(/[.,;:]+$/, "");
    if (!p.endsWith("/")) ops.push({ kind: "reference", path: decodeURI(p), eventId });
  }
  return ops;
}
var SANDBOX_ROOTS = ["/mnt/data/", "/mnt/user-data/outputs/", "/home/claude/", "/claude-artifacts/"];
function bundlePath(original, kind, cwd) {
  let p = original.replace(/^sandbox:/, "");
  if (p.startsWith("/")) p = normaliseDots(p);
  const sandboxRoot = SANDBOX_ROOTS.find((r) => p.startsWith(r));
  if (sandboxRoot) p = p.slice(sandboxRoot.length);
  else if (cwd && p.startsWith(cwd.replace(/\/$/, "") + "/")) p = p.slice(cwd.replace(/\/$/, "").length + 1);
  else if (p.startsWith("/")) p = "_abs" + p;
  const safe = p.split("/").filter((s2) => s2 && s2 !== "." && s2 !== "..").join("/");
  return safe || (kind === "unknown" ? "file" : "unnamed");
}
var BINARY_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|gif|webp|svg|mp4|mov|wav|mp3|pkl|npy|npz|parquet|sqlite|db)$/i;
function collectOps(events, kind, cwd) {
  const ops = [];
  const artifactPaths = /* @__PURE__ */ new Map();
  for (const e of events) {
    if (e.kind === "tool_call" && e.tool) {
      const { name, input, args } = e.tool;
      if (args && isRecord(args)) ops.push(...extractToolArgOps(name, args, e.id, artifactPaths));
      else if (input && (name === "container.exec" || name === "python" || name === "Bash" || name === "bash_tool" || e.tool.language === "bash")) {
        ops.push(...extractShellOps(input, e.id, kind === "claude-code" && cwd ? cwd : "/"));
      }
    }
    if ((kind === "chatgpt-share" || kind === "chatgpt-export") && (e.kind === "message" || e.kind === "tool_call")) {
      ops.push(...extractSandboxReferences(e.text, e.id));
    }
  }
  return ops;
}
function foldOps(ops, kind, cwd) {
  const state = /* @__PURE__ */ new Map();
  const get = (p) => {
    let s2 = state.get(p);
    if (!s2) {
      s2 = { original: p, versions: 0, status: "lost", from: [], modified: [], notes: /* @__PURE__ */ new Set() };
      state.set(p, s2);
    }
    return s2;
  };
  for (const op of ops) {
    const s2 = get(op.path);
    switch (op.kind) {
      case "write":
        s2.content = op.content ?? "";
        s2.versions++;
        s2.status = "recovered";
        s2.from.push(op.eventId);
        s2.modified = [];
        s2.notes.clear();
        if (op.note) s2.notes.add(op.note);
        break;
      case "append":
        if (s2.content !== void 0) {
          s2.content += op.content ?? "";
          s2.versions++;
          s2.from.push(op.eventId);
        } else {
          s2.content = op.content ?? "";
          s2.status = "stale";
          s2.notes.add("appended to a file whose earlier content is not in the source");
          s2.from.push(op.eventId);
        }
        break;
      case "replace":
        if (s2.content !== void 0 && op.old !== void 0 && s2.content.includes(op.old)) {
          s2.content = op.all ? s2.content.split(op.old).join(op.new ?? "") : s2.content.replace(op.old, () => op.new ?? "");
          s2.versions++;
          s2.from.push(op.eventId);
        } else {
          if (s2.content === void 0) s2.notes.add(kind === "claude-code" ? "pre-existing file edited during the session; only the edit hunks are in the transcript" : "edit target content unknown");
          else s2.notes.add("an edit did not match the reconstructed content");
          s2.status = s2.content === void 0 ? "lost" : "stale";
          s2.modified.push(op.eventId);
        }
        break;
      case "touch":
        if (s2.content !== void 0) s2.status = "stale";
        s2.modified.push(op.eventId);
        if (op.note) s2.notes.add(op.note);
        break;
      case "reference":
        break;
    }
  }
  const artifacts = [];
  for (const [p, s2] of state) {
    if (s2.content === void 0) {
      if (kind === "chatgpt-share" || kind === "chatgpt-export") {
        s2.notes.add(BINARY_EXT.test(p) ? "binary/derived output; regenerate with replay/" : "created by code the source did not include");
      } else {
        s2.notes.add("exists in the original working directory; contents not reconstructable from the log");
      }
    }
    artifacts.push({
      path: bundlePath(p, kind, cwd),
      originalPath: s2.original,
      status: s2.content === void 0 ? "lost" : s2.status,
      content: s2.content,
      bytes: s2.content === void 0 ? void 0 : new TextEncoder().encode(s2.content).length,
      sha256: s2.content === void 0 ? void 0 : sha256Hex(s2.content),
      versions: s2.versions || void 0,
      recoveredFrom: s2.from.length ? s2.from : void 0,
      modifiedBy: s2.modified.length ? s2.modified : void 0,
      note: s2.notes.size ? [...s2.notes].join("; ") : void 0
    });
  }
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}
function recoverArtifacts(events, kind, cwd) {
  const artifacts = foldOps(collectOps(events, kind, cwd), kind, cwd);
  const seen = /* @__PURE__ */ new Map();
  for (const a of artifacts) {
    const n = seen.get(a.path) ?? 0;
    seen.set(a.path, n + 1);
    if (n) a.path = a.path.replace(/(\.[^./]+)?$/, `~${n}$1`);
  }
  return { artifacts, replay: buildReplay(events) };
}
function buildReplay(events) {
  const cells = events.filter((e) => e.kind === "tool_call" && e.tool?.name === "container.exec" && e.tool.input);
  if (!cells.length) return void 0;
  const files = {};
  cells.forEach((e, i) => {
    const n = String(i + 1).padStart(3, "0");
    files[`replay/cells/${n}.sh`] = `# Cell ${n} \xB7 source event ${e.id}${e.time ? " \xB7 " + e.time : ""}
# ${e.tool?.title ?? ""}
${unwrapShell(e.tool.input)}
`;
  });
  files["replay/run-in-docker.sh"] = REPLAY_SH;
  files["replay/README.md"] = replayReadme(cells.length);
  return files;
}
var REPLAY_SH = `#!/usr/bin/env bash
# Re-run the code cells captured from the source conversation, in order, inside ONE throwaway container.
# The cells expect the ChatGPT sandbox layout, so the work dir is mounted at /mnt/data.
#
#   REVIEW cells/*.sh FIRST. They are third-party code captured from another AI's sandbox.
#
# Usage: ./run-in-docker.sh [workdir]
#   BATON_REPLAY_IMAGE    container image (default python:3.12-slim)
#   BATON_REPLAY_SETUP    shell run before the cells, e.g. "pip install numpy matplotlib python-docx"
#   BATON_REPLAY_NETWORK  docker network (default none; set to "bridge" if setup needs to download)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mkdir -p "\${1:-$HERE/workdir}" && cd "\${1:-$HERE/workdir}" && pwd)"
IMAGE="\${BATON_REPLAY_IMAGE:-python:3.12-slim}"
NET="\${BATON_REPLAY_NETWORK:-none}"
SETUP="\${BATON_REPLAY_SETUP:-true}"
exec docker run --rm --network "$NET" -v "$WORK:/mnt/data" -v "$HERE/cells:/cells:ro" -w /mnt/data "$IMAGE" \\
  bash -c "$SETUP; for c in /cells/*.sh; do echo \\"\u2500\u2500 \\$(basename \\$c)\\"; bash \\"\\$c\\" || echo '   (cell failed, continuing)'; done"
`;
function replayReadme(n) {
  return `# Replay kit

The source conversation ran **${n} code cell(s)** in its own sandbox. The source did not include their
outputs: tool results were redacted, and files could not be downloaded. These cells are the exact code that ran, in order.
Re-running them in a sandbox you control can regenerate derived outputs such as PDFs, figures and archives.

\`\`\`bash
# 1. Read every cell first. This is third-party code.
ls cells/ && less cells/*.sh
# 2. Run in an isolated container (no network by default)
BATON_REPLAY_NETWORK=bridge BATON_REPLAY_SETUP="pip install numpy matplotlib python-docx reportlab pypdf" ./run-in-docker.sh
# 3. Outputs land in ./workdir (mounted at /mnt/data inside the container)
\`\`\`

Known limits:
- Cells that call vendor-internal helpers (for example \`/home/oai/skills/...\`) will fail outside the vendor sandbox.
- Cells whose input the source blanked (for example ChatGPT \`functions.exec\`) are not here. Files they made are listed as **lost** in \`LOSS_AUDIT.md\`.
- Baton never runs these cells itself.
`;
}

// src/core/redact.ts
var DEFAULT_RULES = [
  { id: "private_key", label: "PRIVATE KEY", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { id: "anthropic_key", label: "ANTHROPIC KEY", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: "openai_key", label: "OPENAI KEY", re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g },
  { id: "github_token", label: "GITHUB TOKEN", re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g },
  { id: "aws_access_key", label: "AWS KEY", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: "google_api_key", label: "GOOGLE KEY", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: "cloudflare_token", label: "CLOUDFLARE TOKEN", re: /\bcf(?:at|ut|k)_[A-Za-z0-9_-]{30,}/g },
  { id: "slack_token", label: "SLACK TOKEN", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { id: "stripe_key", label: "STRIPE KEY", re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { id: "jwt", label: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { id: "bearer", label: "BEARER TOKEN", re: /\b(Bearer\s+)[A-Za-z0-9._~+/-]{20,}=*/g },
  { id: "password_assign", label: "PASSWORD", re: /\b((?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*)(["']?)[^\s"']{6,}\2/gi },
  { id: "email", label: "EMAIL", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // Cards run before phones so a Luhn-valid card is not mislabelled as a phone number.
  { id: "card", label: "CARD", re: /(?<![\w.-])\d(?:[ -]?\d){12,18}(?![\w.-])/g },
  // Not inside identifiers (UUIDs, hashes, version strings): no word char, dot or hyphen on either side.
  { id: "phone", label: "PHONE", re: /(?<![\w.-]|\d\s)\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}(?![\w.-]|\s\d)/g }
];
var EMAIL_ALLOW = /^(?:noreply|no-reply|donotreply|example|user|test)@|@(?:example\.(?:com|org|net)|anthropic\.com|users\.noreply\.github\.com)$/i;
var Redactor = class {
  counts = {};
  rules;
  enabled;
  constructor(enabled = true, rules = DEFAULT_RULES, terms = []) {
    this.enabled = enabled;
    const custom = terms.map((t) => t.trim()).filter((t) => t.length >= 3).map((t, i) => ({ id: "custom", label: `TERM${i + 1}`, re: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") }));
    this.rules = [...custom, ...rules];
  }
  apply(text2) {
    if (!this.enabled || !text2) return text2;
    let out = text2;
    for (const rule of this.rules) {
      out = out.replace(rule.re, (match, ...groups) => {
        if (rule.id === "email" && EMAIL_ALLOW.test(match)) return match;
        if (rule.id === "card" && !luhn(match)) return match;
        if (rule.id === "phone" && match.replace(/\D/g, "").length < 9) return match;
        this.counts[rule.id] = (this.counts[rule.id] ?? 0) + 1;
        const prefix = (rule.id === "bearer" || rule.id === "password_assign") && typeof groups[0] === "string" ? groups[0] : "";
        return `${prefix}[REDACTED:${rule.label}]`;
      });
    }
    return out;
  }
};
function luhn(s2) {
  const digits = s2.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

// src/core/build.ts
var NOISE_URL = /^https?:\/\/(?:images\.openai\.com|cdn\.oaistatic\.com|files\.oaiusercontent\.com)\//;
function buildBundle(parsed, options = {}) {
  const redact = options.redact !== false;
  const includeHidden = options.includeHidden === true;
  const redactor = new Redactor(redact, void 0, options.redactTerms ?? []);
  let privateDropped = 0;
  const events = [];
  for (const draft of parsed.events) {
    const isPrivate = isRecord(draft.meta) && draft.meta.private === true;
    if (isPrivate && !includeHidden) {
      privateDropped++;
      continue;
    }
    const e = { ...draft, seq: events.length + 1, id: draft.id || `e${events.length + 1}` };
    e.text = redactor.apply(e.text);
    if (e.tool) {
      e.tool = { ...e.tool };
      if (e.tool.input) e.tool.input = redactor.apply(e.tool.input);
      if (e.tool.args) e.tool.args = redactArgs(e.tool.args, redactor);
    }
    events.push(e);
  }
  const { artifacts, replay } = recoverArtifacts(events, parsed.source.kind, parsed.source.cwd);
  for (const cf of parsed.capturedFiles ?? []) {
    const binary = cf.encoding === "base64";
    const content = binary ? cf.content : redactor.apply(cf.content);
    const bytes = binary ? base64ToBytes(content) : new TextEncoder().encode(content);
    const path = bundlePath(cf.path, parsed.source.kind, parsed.source.cwd);
    const prior = artifacts.findIndex((a) => a.path === path);
    const captured = {
      path,
      originalPath: cf.path,
      status: "recovered",
      content,
      encoding: binary ? "base64" : void 0,
      mimeType: cf.mimeType,
      bytes: bytes.length,
      sha256: sha256Hex(bytes),
      recoveredFrom: cf.eventId ? [cf.eventId] : void 0,
      note: cf.note ?? "captured from the source (exact bytes)"
    };
    if (prior >= 0) artifacts[prior] = { ...captured, versions: artifacts[prior].versions, modifiedBy: void 0 };
    else artifacts.push(captured);
  }
  for (const att of parsed.attachments ?? []) {
    const content = redactor.apply(att.content);
    artifacts.push({ path: att.path, originalPath: att.path, status: "attached", content, bytes: new TextEncoder().encode(content).length, sha256: sha256Hex(content), note: att.note });
  }
  artifacts.sort((a, b) => a.path.localeCompare(b.path));
  const links = collectLinks(events, parsed.sourceLinks ?? []);
  const stats = computeStats(events, artifacts);
  const loss = auditLoss(parsed, events, artifacts, privateDropped, redactor.counts, Boolean(replay));
  const now = options.now ?? (/* @__PURE__ */ new Date()).toISOString();
  const idSeed = [parsed.source.kind, parsed.source.conversationId ?? parsed.source.url ?? "", parsed.title, events[0]?.text ?? ""].join("\0");
  const root = chainEvents(events, artifacts);
  const bundle = {
    schema: SCHEMA_ID,
    id: sha256Hex(idSeed).slice(0, 16),
    title: redactor.apply(parsed.title),
    source: parsed.source,
    events,
    artifacts,
    loss,
    links,
    redaction: { enabled: redact, counts: { ...redactor.counts } },
    integrity: { algorithm: "sha256-chain", root, count: events.length },
    stats,
    generator: { name: "baton", version: VERSION, generatedAt: now }
  };
  return { bundle, extraFiles: replay ?? {} };
}
function redactArgs(args, r) {
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string") out[k] = r.apply(v);
    else if (Array.isArray(v)) out[k] = v.map((x) => isRecord(x) ? redactArgs(x, r) : typeof x === "string" ? r.apply(x) : x);
    else if (isRecord(v)) out[k] = redactArgs(v, r);
    else out[k] = v;
  }
  return out;
}
function collectLinks(events, sourceLinks) {
  const set = /* @__PURE__ */ new Set();
  for (const e of events) if (e.kind === "message" || e.kind === "reasoning") for (const u of extractUrls(e.text)) set.add(u);
  for (const u of sourceLinks) set.add(u);
  return [...set].filter((u) => !NOISE_URL.test(u) && !u.includes("{")).sort();
}
function computeStats(events, artifacts) {
  const count = (f) => events.filter(f).length;
  const byStatus = { recovered: 0, stale: 0, lost: 0, attached: 0 };
  for (const a of artifacts) byStatus[a.status]++;
  const times = events.map((e) => e.time ? Date.parse(e.time) : NaN).filter((t) => Number.isFinite(t));
  return {
    userMessages: count((e) => e.kind === "message" && e.role === "user"),
    assistantMessages: count((e) => e.kind === "message" && e.role === "assistant"),
    reasoningBlocks: count((e) => e.kind === "reasoning"),
    toolCalls: count((e) => e.kind === "tool_call"),
    toolResults: count((e) => e.kind === "tool_result"),
    hiddenEvents: count((e) => e.hidden === true),
    redactedBySource: count((e) => e.redactedBySource === true),
    artifacts: byStatus,
    durationSeconds: times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 1e3) : void 0
  };
}
function auditLoss(parsed, events, artifacts, privateDropped, redactions, hasReplay) {
  const items = [];
  const group = (pred) => {
    const m = /* @__PURE__ */ new Map();
    for (const e of events) if (pred(e)) m.set(e.tool?.name ?? "tool", (m.get(e.tool?.name ?? "tool") ?? 0) + 1);
    return m;
  };
  const outs = group((e) => e.kind === "tool_result" && e.redactedBySource === true);
  const outTotal = [...outs.values()].reduce((a, b) => a + b, 0);
  if (outTotal) {
    items.push({ category: "tool-outputs", count: outTotal, severity: "high", detail: `The source replaced ${outTotal} tool output(s) with a placeholder (${fmtGroup(outs)}). Results of searches, code runs and connector calls are not available. The receiving agent must re-run them if needed.` });
  }
  const ins = group((e) => e.kind === "tool_call" && e.redactedBySource === true);
  const inTotal = [...ins.values()].reduce((a, b) => a + b, 0);
  if (inTotal) {
    items.push({ category: "tool-inputs", count: inTotal, severity: "high", detail: `${inTotal} tool call(s) have no input in the source (${fmtGroup(ins)}). The code or arguments they ran cannot be recovered.` });
  }
  const lost = artifacts.filter((a) => a.status === "lost");
  if (lost.length) {
    items.push({ category: "files-lost", count: lost.length, severity: "high", detail: `${lost.length} file(s) were created or linked but their contents are not in the source: ${lost.slice(0, 8).map((a) => a.path).join(", ")}${lost.length > 8 ? ", \u2026" : ""}.${hasReplay ? " Some derived outputs can be regenerated with replay/." : ""}` });
  }
  const stale = artifacts.filter((a) => a.status === "stale");
  if (stale.length) {
    items.push({ category: "files-stale", count: stale.length, severity: "warn", detail: `${stale.length} file(s) were recovered exactly as last written, but later code changed them in ways that cannot be replayed statically: ${stale.slice(0, 8).map((a) => a.path).join(", ")}${stale.length > 8 ? ", \u2026" : ""}.` });
  }
  const recovered = artifacts.filter((a) => a.status === "recovered").length;
  if (recovered) items.push({ category: "files-recovered", count: recovered, severity: "info", detail: `${recovered} file(s) were reconstructed byte-for-byte from the code that created them.` });
  items.push(...parsed.loss ?? []);
  if (privateDropped) items.push({ category: "private-context", count: privateDropped, severity: "info", detail: `${privateDropped} private context item(s) (system prompts, memory, custom instructions, harness metadata) were excluded. Use --include-hidden to keep them.` });
  const redTotal = Object.values(redactions).reduce((a, b) => a + b, 0);
  if (redTotal) items.push({ category: "baton-redactions", count: redTotal, severity: "info", detail: `Baton redacted ${redTotal} secret/PII match(es) before export (${Object.entries(redactions).map(([k, v]) => `${k}: ${v}`).join(", ")}). Use --no-redact to disable.` });
  const order = { high: 0, warn: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}
function fmtGroup(m) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} \xD7${v}`).join(", ");
}

// src/render/turns.ts
function splitTurns(events) {
  const turns = [];
  let cur = { index: 0, events: [] };
  for (const e of events) {
    if (e.kind === "message" && e.role === "user") {
      if (cur.events.length || cur.prompt) turns.push(cur);
      cur = { index: turns.length + 1, prompt: e, events: [] };
    } else {
      cur.events.push(e);
    }
  }
  if (cur.events.length || cur.prompt) turns.push(cur);
  let n = 0;
  for (const t of turns) if (t.prompt) t.index = ++n;
  return turns;
}
function userPrompts(b) {
  return b.events.filter((e) => e.kind === "message" && e.role === "user");
}
function lastVisibleAssistant(b, n = 1) {
  return b.events.filter((e) => e.kind === "message" && e.role === "assistant" && !e.hidden).slice(-n);
}
var NEXT_RE = /\b(next(?: step| milestone)?s?|not (?:yet|built|live|verified)|haven'?t|hasn'?t|still (?:need|to)|to ?do|remaining|need(?:s)? to|once you|after (?:you|that)|blocker|cannot|can'?t|couldn'?t|rejected|403|fail(?:ed|s)?|missing|pending|follow[- ]up|roadmap)\b/i;
function extractOpenThreads(b, max = 10) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const e of lastVisibleAssistant(b, 2).reverse()) {
    const pieces = e.text.replace(/```[\s\S]*?```/g, " ").split(/\n+|(?<=[.!?])\s+(?=[A-Z*])/).map((s2) => s2.replace(/^[\s>*#\-\d.)]+/, "").replace(/\*\*/g, "").trim()).filter((s2) => s2.length > 25 && s2.length < 400);
    for (const p of pieces) {
      if (!NEXT_RE.test(p)) continue;
      const key = p.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
      if (out.length >= max) return out;
    }
  }
  return out;
}
function toolUsage(b) {
  const m = /* @__PURE__ */ new Map();
  const get = (n) => {
    let u = m.get(n);
    if (!u) m.set(n, u = { name: n, calls: 0, inputsAvailable: 0, outputsAvailable: 0, outputsTotal: 0 });
    return u;
  };
  for (const e of b.events) {
    if (e.kind === "tool_call" && e.tool) {
      const u = get(e.tool.name);
      u.calls++;
      if (!e.redactedBySource && (e.tool.input || e.tool.args)) u.inputsAvailable++;
    } else if (e.kind === "tool_result" && e.tool) {
      const u = get(e.tool.name);
      u.outputsTotal++;
      if (!e.redactedBySource) u.outputsAvailable++;
    }
  }
  return [...m.values()].sort((a, b2) => b2.calls + b2.outputsTotal - (a.calls + a.outputsTotal));
}
function activityTitles(b, max = 40) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const e of b.events) {
    if (e.kind !== "tool_call" || !e.tool?.title) continue;
    for (const t of e.tool.title.split(" \xB7 ")) {
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out.slice(0, max);
}
function fmtTime(iso) {
  if (!iso) return "";
  return iso.replace("T", " ").replace(/:\d\d(\.\d+)?Z$/, " UTC");
}
function fmtDuration(sec) {
  if (!sec || sec < 1) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  return h ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}
function fmtBytes(n) {
  if (n === void 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function reasoningHeadlines(t, max = 6) {
  const out = [];
  for (const e of t.events) {
    if (e.kind !== "reasoning") continue;
    for (const m of e.text.matchAll(/\*\*([^*]{3,120}?)\.?\*\*/g)) {
      if (!out.includes(m[1])) out.push(m[1]);
    }
  }
  return out.slice(0, max);
}
function sourceLabel(b) {
  const k = b.source.kind;
  const how = k === "chatgpt-share" ? "public share link" : k.endsWith("export") ? "account data export" : k === "claude-code" ? "session log" : "chat log";
  return `${b.source.tool}${b.source.model ? ` (${b.source.model})` : ""} \xB7 ${how}`;
}

// src/render/handoff.ts
function quote(text2) {
  return text2.trim().split("\n").map((l) => `> ${l}`).join("\n");
}
function renderHandoff(b) {
  const prompts = userPrompts(b);
  const first = prompts[0];
  const last = prompts[prompts.length - 1];
  const lastReply = lastVisibleAssistant(b)[0];
  const threads = extractOpenThreads(b);
  const tools = toolUsage(b);
  const s2 = b.stats;
  const a = s2.artifacts;
  const high = b.loss.filter((l) => l.severity === "high");
  const times = b.events.map((e) => e.time).filter(Boolean);
  const out = [];
  out.push("---");
  out.push(`baton: ${b.schema}`);
  out.push(`id: ${b.id}`);
  out.push(`title: ${JSON.stringify(b.title)}`);
  out.push(`source: ${JSON.stringify(sourceLabel(b))}`);
  if (b.source.url) out.push(`source_url: ${b.source.url}`);
  out.push(`root_hash: ${b.integrity.root}`);
  out.push(`generated: ${b.generator.generatedAt}`);
  out.push("---", "");
  out.push(`# Handoff: ${b.title}`, "");
  out.push(`> **If you are an AI agent picking this up:** this folder is an audited transfer of work done in ${b.source.tool}.`);
  out.push("> Read this file first and open `TRANSCRIPT.md` only for the turns you need. `files/` holds the files the source created,");
  out.push("> with the status of each listed in \xA76. **Do not assume anything in \xA77 exists.** It was lost in transit and must be rebuilt or re-run.");
  out.push("> Confirm the latest instruction (\xA73) with the user before large actions.", "");
  out.push("## At a glance", "");
  out.push("| | |", "|---|---|");
  out.push(`| Source | ${sourceLabel(b)}${b.source.url ? ` \xB7 <${b.source.url}>` : ""} |`);
  if (times.length) out.push(`| Span | ${fmtTime(times[0])} \u2192 ${fmtTime(times[times.length - 1])}${s2.durationSeconds ? ` (${fmtDuration(s2.durationSeconds)})` : ""} |`);
  out.push(`| Conversation | ${s2.userMessages} prompts \xB7 ${s2.assistantMessages} assistant messages \xB7 ${s2.reasoningBlocks} reasoning blocks \xB7 ${s2.toolCalls} tool calls |`);
  out.push(`| Files | ${a.recovered} recovered \xB7 ${a.stale} stale \xB7 ${a.lost} lost${a.attached ? ` \xB7 ${a.attached} attached` : ""} |`);
  out.push(`| Loss | ${high.length ? high.map((l) => `${l.count} ${l.category}`).join(" \xB7 ") : "no high-severity loss"} |`);
  out.push(`| Integrity | \`${b.integrity.root.slice(0, 16)}\u2026\` (run \`baton verify\`) |`, "");
  out.push("## 1. Original goal", "");
  out.push(first ? quote(first.text) : "_No user prompt found._", "");
  out.push("## 2. How the ask evolved (every prompt, verbatim)", "");
  prompts.forEach((p, i) => out.push(`${i + 1}. ${p.time ? `*${fmtTime(p.time)}*: ` : ""}${p.text.trim().replace(/\n+/g, " \u23CE ")}`));
  out.push("");
  out.push("## 3. Where it left off", "");
  if (last) out.push("**Latest user instruction:**", "", quote(last.text), "");
  if (lastReply) out.push("**Last assistant response (excerpt):**", "", quote(truncate(lastReply.text, 1800)), "");
  out.push("## 4. Open threads and blockers", "");
  out.push("*Heuristically extracted from the final assistant messages. Verify before acting.*", "");
  if (threads.length) for (const t of threads) out.push(`- ${t}`);
  else out.push("- None detected.");
  out.push("");
  out.push("## 5. Reasoning trail (per turn)", "");
  for (const t of splitTurns(b.events)) {
    if (!t.prompt) continue;
    const heads = reasoningHeadlines(t);
    const calls = t.events.filter((e) => e.kind === "tool_call").length;
    const head = truncate(t.prompt.text.replace(/\s+/g, " ").trim(), 90);
    out.push(`- **Turn ${t.index}** (\u201C${head}\u201D): ${heads.length ? heads.join(" \u2192 ") : "no reasoning summary"}${calls ? ` \xB7 ${calls} tool calls` : ""}`);
  }
  out.push("");
  out.push("## 6. Files", "");
  if (!b.artifacts.length) out.push("_None._");
  else {
    out.push("| Status | Path | Size | Notes |", "|---|---|---|---|");
    const rank = { recovered: 0, attached: 1, stale: 2, lost: 3 };
    for (const f of [...b.artifacts].sort((x, y) => rank[x.status] - rank[y.status] || x.path.localeCompare(y.path))) {
      const link = f.content !== void 0 ? `[\`${f.path}\`](files/${encodeURI(f.path)})` : `\`${f.path}\``;
      out.push(`| ${f.status} | ${link} | ${fmtBytes(f.bytes)} | ${(f.note ?? "").replace(/\|/g, "\\|")} |`);
    }
  }
  out.push("");
  out.push("## 7. What the source dropped", "");
  for (const l of b.loss.filter((x) => x.severity !== "info")) out.push(`- **${l.severity.toUpperCase()} \xB7 ${l.category} (${l.count})**: ${l.detail}`);
  if (!b.loss.some((x) => x.severity !== "info")) out.push("- Nothing significant.");
  out.push("- Full detail: `LOSS_AUDIT.md`.", "");
  if (tools.length) {
    out.push("## 8. Tool activity", "");
    out.push("| Tool | Calls | Inputs available | Outputs available |", "|---|---|---|---|");
    for (const u of tools) out.push(`| \`${u.name}\` | ${u.calls} | ${u.inputsAvailable}/${u.calls} | ${u.outputsAvailable}/${u.outputsTotal} |`);
    const titles = activityTitles(b, 25);
    if (titles.length) out.push("", "**What the tools were used for:** " + titles.join(" \xB7 "));
    out.push("");
  }
  if (b.links.length) {
    out.push("## 9. References seen in the conversation", "");
    for (const u of b.links.slice(0, 40)) out.push(`- <${u}>`);
    if (b.links.length > 40) out.push(`- \u2026 ${b.links.length - 40} more in \`bundle.json\``);
    out.push("");
  }
  out.push("## 10. How to continue", "");
  const steps = ["Restate the goal and the latest instruction back to the user in two sentences, and ask whether anything changed."];
  if (a.recovered + a.stale) steps.push(`Copy \`files/\` into the workspace as the starting tree.${a.stale ? ` Re-check the ${a.stale} stale file(s) against the transcript.` : ""}`);
  if (a.lost) steps.push(`Rebuild the ${a.lost} lost file(s) from their descriptions in \`TRANSCRIPT.md\`. Do not pretend they exist.`);
  if (b.events.some((e) => e.tool?.name === "container.exec" && e.tool.input)) steps.push("Optionally regenerate derived outputs (PDFs, archives) with `replay/run-in-docker.sh` after reviewing the cells.");
  steps.push("Write `STATE.md` with your understanding (goal, decisions, next steps) so the next handoff starts from it.");
  steps.forEach((st, i) => out.push(`${i + 1}. ${st}`));
  out.push("", "---", `*Generated by Baton ${b.generator.version} \xB7 bundle id \`${b.id}\` \xB7 \`bundle.json\` is the canonical record.*`);
  return out.join("\n") + "\n";
}
function renderPastePrompt(b, budget = 12e3) {
  const prompts = userPrompts(b);
  const lastReply = lastVisibleAssistant(b)[0];
  const threads = extractOpenThreads(b, 6);
  const head = [];
  head.push(`I'm continuing a piece of work I started in ${b.source.tool}. Below is an exported handoff (made with Baton). Please read it, restate the goal and the current state in a few sentences, list what is missing, and then continue from the latest instruction.`, "");
  head.push(`TITLE: ${b.title}`);
  head.push(`SOURCE: ${sourceLabel(b)}${b.source.url ? ` (${b.source.url})` : ""}`, "");
  head.push("MY PROMPTS SO FAR (verbatim, in order):");
  prompts.forEach((p, i) => head.push(`${i + 1}. ${p.text.trim().replace(/\s+/g, " ")}`));
  head.push("");
  const files = b.artifacts.map((a) => `- ${a.path} [${a.status}]`).join("\n");
  const loss = b.loss.filter((l) => l.severity !== "info").map((l) => `- ${l.category} (${l.count}): ${l.detail}`).join("\n");
  const tail = [];
  if (threads.length) tail.push("OPEN THREADS / BLOCKERS:", ...threads.map((t) => `- ${t}`), "");
  if (files) tail.push("FILES FROM THE PREVIOUS SESSION (status):", files, "");
  if (loss) tail.push("WHAT DID NOT TRANSFER:", loss, "");
  tail.push("Please do not assume lost files exist. Ask me for anything you need.");
  const fixed = head.join("\n").length + tail.join("\n").length + 200;
  const room = Math.max(800, budget - fixed);
  const mid = lastReply ? ["WHERE THE ASSISTANT LEFT OFF (last reply):", truncate(lastReply.text.trim(), room), ""] : [];
  return [...head, ...mid, ...tail].join("\n") + "\n";
}
function skillName(b) {
  return `continue-${slugify(b.title, 50)}`.slice(0, 64).replace(/-+$/, "");
}
function renderSkill(b) {
  const first = truncate(userPrompts(b)[0]?.text.replace(/\s+/g, " ").trim() ?? b.title, 320).replace(/[.!?…]+$/, "");
  const desc = truncate(
    `Resume the "${b.title}" work handed off from ${b.source.tool}${b.source.createdAt ? ` (${b.source.createdAt.slice(0, 10)})` : ""}. Original goal: ${first}. Use when the user asks to continue, resume, rebuild, review or extend this work.`,
    1e3
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
4. Confirm the latest instruction with the user before large changes${last ? `:
   > ${truncate(last.text.replace(/\s+/g, " ").trim(), 300)}` : "."}
5. When you finish a chunk of work, write \`STATE.md\` (goal, decisions, next steps) next to this file.

## Integrity

\`bundle.json\` is the canonical record. Hash-chain root: \`${b.integrity.root}\`.
If \`baton\` is installed, run \`baton verify .\` to check nothing was altered.
`;
}
function renderAgentsMd(b) {
  return `# AGENTS.md: handoff context

This directory carries work transferred from ${b.source.tool} with Baton (\`${b.schema}\`).

- **Start with \`HANDOFF.md\`.** It has the goal, the verbatim prompts, the current state, open threads and the file status.
- \`TRANSCRIPT.md\` has the full chronological record, and \`bundle.json\` is the canonical machine-readable version.
- \`files/\` is the recovered working tree. Respect the status column (recovered / stale / lost).
- \`LOSS_AUDIT.md\` lists what the source did not include. Never assume a lost file exists.
- Ask the user to confirm the latest instruction before large changes.
`;
}

// src/render/markdown.ts
var SEVERITY_LABEL = { high: "HIGH", warn: "WARN", info: "info" };
function renderTranscript(b) {
  const out = [];
  out.push(`# Transcript: ${b.title}`, "");
  out.push(`*${sourceLabel(b)}${b.source.url ? ` \xB7 <${b.source.url}>` : ""} \xB7 ${b.stats.userMessages} prompts \xB7 ${b.events.length} events \xB7 exported by Baton ${b.generator.version}*`, "");
  out.push("Reasoning, tool calls and tool outputs are folded into `<details>` blocks. Placeholders mark content the source did not include. See `LOSS_AUDIT.md`.", "");
  for (const t of splitTurns(b.events)) {
    out.push("---", "");
    if (t.prompt) {
      out.push(`## Turn ${t.index}`, "");
      out.push(`### User${t.prompt.time ? ` \xB7 ${fmtTime(t.prompt.time)}` : ""}`, "", t.prompt.text.trim(), "");
    } else {
      out.push("## Preamble", "");
    }
    for (const e of t.events) out.push(...renderEvent(e), "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}
function renderEvent(e) {
  const when = e.time ? ` \xB7 ${fmtTime(e.time)}` : "";
  switch (e.kind) {
    case "message": {
      const label = e.role === "user" ? "User" : e.hidden ? "Assistant (progress update)" : "Assistant";
      return [`### ${label}${e.model ? ` \xB7 ${e.model}` : ""}${when}`, "", e.text.trim()];
    }
    case "reasoning": {
      const body = e.redactedBySource && !e.text.trim() ? "*Reasoning was produced but the source stores it in encrypted form only.*" : e.text.trim();
      return ["<details><summary>Reasoning" + (e.meta?.granularity === "summary" ? " (summary)" : "") + "</summary>", "", body, "", "</details>"];
    }
    case "tool_call": {
      const name = e.tool?.name ?? "tool";
      const title = e.tool?.title ? ` \xB7 ${e.tool.title}` : e.text && e.text !== name ? ` \xB7 ${e.text}` : "";
      const lines = [`<details><summary>Tool call: <code>${name}</code>${escapeSummary(title)}</summary>`, ""];
      if (e.redactedBySource) lines.push("*Input not included by the source.*");
      else if (e.tool?.input) lines.push(fence(e.tool.input, e.tool.language ?? ""));
      lines.push("", "</details>");
      return lines;
    }
    case "tool_result": {
      const name = e.tool?.name ?? "tool";
      if (e.redactedBySource) return [`> Output of \`${name}\`: *redacted by source*`];
      const text2 = e.text.length > 2e4 ? e.text.slice(0, 2e4) + `
\u2026 [${e.text.length - 2e4} more characters in bundle.json]` : e.text;
      return [`<details><summary>Output: <code>${name}</code></summary>`, "", fence(text2), "", "</details>"];
    }
    case "attachment":
      return [`> Attachment: ${e.text}`];
    case "note":
      return [`*${e.text.trim()}*`];
  }
}
function escapeSummary(s2) {
  return s2.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderLossAudit(b) {
  const out = [];
  out.push(`# Loss audit: ${b.title}`, "");
  out.push("A transfer is only trustworthy if it says what it could **not** carry. This report lists everything the source dropped,");
  out.push("everything Baton reconstructed, and everything Baton removed on purpose (private context, secrets).", "");
  out.push("| Severity | Category | Count | Detail |", "|---|---|---|---|");
  for (const l of b.loss) out.push(`| ${SEVERITY_LABEL[l.severity]} | ${l.category} | ${l.count} | ${l.detail.replace(/\|/g, "\\|")} |`);
  out.push("");
  out.push("## Files", "");
  if (!b.artifacts.length) out.push("_No files were created or referenced._");
  else {
    out.push("| Status | Path | Size | Versions | Notes |", "|---|---|---|---|---|");
    for (const a of b.artifacts) out.push(`| ${a.status} | \`${a.path}\` | ${fmtBytes(a.bytes)} | ${a.versions ?? ""} | ${(a.note ?? "").replace(/\|/g, "\\|")} |`);
    out.push("");
    out.push("- **recovered**: reconstructed byte for byte from the code that wrote it. Its SHA-256 is in `bundle.json`.");
    out.push("- **stale**: exactly the last full write, but later code modified it in a way that cannot be replayed statically.");
    out.push("- **lost**: the conversation created or linked it, but its contents are not in the source.");
    out.push("- **attached**: shipped with the source export (e.g. uploaded file with extracted text).");
  }
  out.push("");
  out.push("## Integrity", "");
  out.push(`Hash chain root (SHA-256 over ${b.integrity.count} events + ${b.artifacts.length} artifact digests): \`${b.integrity.root}\``, "");
  out.push("Run `baton verify <bundle-dir>` to recompute it. Any edit to an event or a recovered file changes the root.", "");
  out.push("## Stats", "");
  const s2 = b.stats;
  out.push(`- Prompts: ${s2.userMessages} \xB7 assistant messages: ${s2.assistantMessages} \xB7 reasoning blocks: ${s2.reasoningBlocks}`);
  out.push(`- Tool calls: ${s2.toolCalls} \xB7 tool results: ${s2.toolResults} \xB7 items the source redacted: ${s2.redactedBySource}`);
  if (s2.durationSeconds) out.push(`- Wall-clock span: ${fmtDuration(s2.durationSeconds)}`);
  return out.join("\n") + "\n";
}

// src/render/mdlite.ts
function inline(s2) {
  let t = escapeHtml(s2);
  const codes = [];
  t = t.replace(/`([^`\n]+)`/g, (_m, c) => {
    codes.push(`<code>${c}</code>`);
    return `\0${codes.length - 1}\0`;
  });
  t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|[A-Za-z0-9_./%-]+)\)/g, (_m, label, href) => `<a href="${href}" rel="noopener noreferrer" target="_blank">${label}</a>`);
  t = t.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_m, u) => `<a href="${u}" rel="noopener noreferrer" target="_blank">${u}</a>`);
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
  t = t.replace(/\u0000(\d+)\u0000/g, (_m, i) => codes[Number(i)]);
  return t;
}
function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let para2 = [];
  const flush = () => {
    if (para2.length) out.push(`<p>${para2.map(inline).join("<br>")}</p>`);
    para2 = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    const fenceM = line.match(/^(`{3,}|~{3,})\s*([\w+-]*)\s*$/);
    if (fenceM) {
      flush();
      const close = fenceM[1];
      const body = [];
      i++;
      while (i < lines.length && lines[i].trim() !== close) body.push(lines[i++]);
      i++;
      out.push(`<pre><code${fenceM[2] ? ` class="lang-${escapeHtml(fenceM[2])}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }
    const det = line.match(/^<details><summary>(.*)<\/summary>$/);
    if (det) {
      flush();
      const summary = det[1].replace(/<code>(.*?)<\/code>/g, (_m, c) => `${c}`);
      out.push(`<details><summary>${escapeHtml(summary).replace(/&amp;lt;/g, "&lt;").replace(/&amp;gt;/g, "&gt;").replace(/\u0001(.*?)\u0002/g, "<code>$1</code>")}</summary>`);
      i++;
      continue;
    }
    if (line.trim() === "</details>") {
      flush();
      out.push("</details>");
      i++;
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^(?:---|\*\*\*|___)\s*$/.test(line)) {
      flush();
      out.push("<hr>");
      i++;
      continue;
    }
    if (line.startsWith(">")) {
      flush();
      const body = [];
      while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${markdownToHtml(body.join("\n"))}</blockquote>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flush();
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, "|")));
      const headCells = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="tbl"><table><thead><tr>${headCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (m) {
          items.push(m[3]);
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += " " + lines[i].trim();
          i++;
        } else break;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    para2.push(line);
    i++;
  }
  flush();
  return out.join("\n");
}

// src/render/html.ts
var CSS = `
:root{--bg:#fbfaf7;--fg:#1d1d1f;--muted:#6b6b70;--card:#fff;--line:#e6e3dc;--accent:#b4521f;--code:#f3f1ec;--hi:#fde7da;--ok:#2f7d4f;--warn:#a46a00;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#141413;--fg:#ecebe6;--muted:#a3a29c;--card:#1d1d1b;--line:#33322f;--accent:#e08a5a;--code:#262522;--hi:#3a2a20;--ok:#6cc08f;--warn:#e0b04a;--bad:#f08a80}}
:root[data-theme=dark]{--bg:#141413;--fg:#ecebe6;--muted:#a3a29c;--card:#1d1d1b;--line:#33322f;--accent:#e08a5a;--code:#262522;--hi:#3a2a20;--ok:#6cc08f;--warn:#e0b04a;--bad:#f08a80}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--fg)}
body{font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:28px 16px 8px;max-width:980px;margin:auto}
header h1{font-size:26px;line-height:1.25;margin:0 0 6px}
.meta{color:var(--muted);font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
.chip{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:12.5px}
.chip b{font-variant-numeric:tabular-nums}
nav{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line)}
nav .in{max-width:980px;margin:auto;display:flex;gap:4px;padding:8px 16px;overflow-x:auto;align-items:center}
nav button{font:inherit;font-size:14px;border:0;background:none;color:var(--muted);padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap}
nav button[aria-selected=true]{background:var(--card);color:var(--fg);box-shadow:0 0 0 1px var(--line)}
nav input{margin-left:auto;font:inherit;font-size:14px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);min-width:160px}
main{max-width:980px;margin:auto;padding:8px 16px 80px}
section{display:none}section.on{display:block}
h2{font-size:19px;margin:28px 0 8px}h3{font-size:15.5px;margin:20px 0 6px;color:var(--accent)}
a{color:var(--accent)}
pre{background:var(--code);padding:12px;border-radius:8px;overflow:auto;font-size:12.5px;line-height:1.45;max-height:520px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em}
p code,li code,td code{background:var(--code);padding:1px 5px;border-radius:4px}
blockquote{margin:8px 0;padding:4px 14px;border-left:3px solid var(--accent);background:var(--card);border-radius:0 8px 8px 0}
details{border:1px solid var(--line);border-radius:8px;margin:8px 0;background:var(--card)}
details>summary{cursor:pointer;padding:6px 10px;color:var(--muted);font-size:13.5px}
details[open]>summary{border-bottom:1px solid var(--line)}
details>*:not(summary){margin-left:10px;margin-right:10px}
.tbl{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13.5px;margin:8px 0}
th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{color:var(--muted);font-weight:600}
.s-recovered{color:var(--ok)}.s-stale{color:var(--warn)}.s-lost{color:var(--bad)}.s-attached{color:var(--ok)}
.turn.hide{display:none}
mark{background:var(--hi);color:inherit}
footer{color:var(--muted);font-size:12px;max-width:980px;margin:auto;padding:0 16px 40px}
`;
var JS = `
const tabs=[...document.querySelectorAll('nav button')];
function show(id){tabs.forEach(b=>b.setAttribute('aria-selected',b.dataset.t===id));document.querySelectorAll('main>section').forEach(s=>s.classList.toggle('on',s.id===id));try{history.replaceState(null,'','#'+id)}catch(e){}}
tabs.forEach(b=>b.onclick=()=>show(b.dataset.t));
show((location.hash||'#handoff').slice(1)||'handoff');
const q=document.getElementById('q');
q.oninput=()=>{const v=q.value.trim().toLowerCase();if(v)show('transcript');
document.querySelectorAll('.turn').forEach(t=>{const hit=!v||t.textContent.toLowerCase().includes(v);t.classList.toggle('hide',!hit);if(hit&&v)t.querySelectorAll('details').forEach(d=>{if(d.textContent.toLowerCase().includes(v))d.open=true})})};
`;
function wrapTurns(html) {
  const parts = html.split(/(?=<h2>(?:Turn \d+|Preamble)<\/h2>)/);
  return parts.map((p) => /^<h2>(?:Turn \d+|Preamble)<\/h2>/.test(p) ? `<div class="turn">${p}</div>` : p).join("\n");
}
function renderHtml(b) {
  const s2 = b.stats;
  const files = b.artifacts.map((a) => {
    const head = `<span class="s-${a.status}">${a.status}</span> \xB7 <code>${escapeHtml(a.path)}</code> ${a.bytes !== void 0 ? `\xB7 ${fmtBytes(a.bytes)}` : ""}${a.note ? ` \xB7 <span class="meta">${escapeHtml(a.note)}</span>` : ""}`;
    if (a.encoding === "base64") return `<p>${head} \xB7 <span class="meta">binary${a.mimeType ? ` ${escapeHtml(a.mimeType)}` : ""}, saved under files/</span></p>`;
    return a.content !== void 0 ? `<details><summary>${head}</summary><pre><code>${escapeHtml(a.content)}</code></pre></details>` : `<p>${head}</p>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="Baton ${escapeHtml(b.generator.version)}">
<title>${escapeHtml(b.title)} \xB7 Baton handoff</title>
<style>${CSS}</style></head>
<body>
<header>
<div class="meta">Baton handoff \xB7 ${escapeHtml(sourceLabel(b))}</div>
<h1>${escapeHtml(b.title)}</h1>
${b.source.url ? `<div class="meta"><a href="${escapeHtml(b.source.url)}" rel="noopener noreferrer">${escapeHtml(b.source.url)}</a></div>` : ""}
<div class="chips">
<span class="chip"><b>${s2.userMessages}</b> prompts</span>
<span class="chip"><b>${s2.reasoningBlocks}</b> reasoning</span>
<span class="chip"><b>${s2.toolCalls}</b> tool calls</span>
<span class="chip"><b class="s-recovered">${s2.artifacts.recovered}</b> files recovered</span>
${s2.artifacts.stale ? `<span class="chip"><b class="s-stale">${s2.artifacts.stale}</b> stale</span>` : ""}
${s2.artifacts.lost ? `<span class="chip"><b class="s-lost">${s2.artifacts.lost}</b> lost</span>` : ""}
<span class="chip">root <code>${b.integrity.root.slice(0, 12)}\u2026</code></span>
</div>
</header>
<nav><div class="in" role="tablist">
<button data-t="handoff" role="tab">Handoff</button>
<button data-t="transcript" role="tab">Transcript</button>
<button data-t="files" role="tab">Files (${b.artifacts.length})</button>
<button data-t="loss" role="tab">Loss audit</button>
<input id="q" type="search" placeholder="Search transcript" aria-label="Search transcript">
</div></nav>
<main>
<section id="handoff">${markdownToHtml(renderHandoff(b).replace(/^---[\s\S]*?---\n/, ""))}</section>
<section id="transcript">${wrapTurns(markdownToHtml(renderTranscript(b)))}</section>
<section id="files"><h2>Files</h2>${files || "<p>No files.</p>"}</section>
<section id="loss">${markdownToHtml(renderLossAudit(b))}</section>
</main>
<footer>Generated ${escapeHtml(b.generator.generatedAt)} by Baton ${escapeHtml(b.generator.version)} \xB7 bundle <code>${escapeHtml(b.id)}</code> \xB7 this page works offline.</footer>
<script>${JS}</script>
</body></html>
`;
}

// src/render/files.ts
function renderBundleFiles(b, opts = {}) {
  const files = {
    "HANDOFF.md": renderHandoff(b),
    "PROMPT.md": renderPastePrompt(b),
    "TRANSCRIPT.md": renderTranscript(b),
    "LOSS_AUDIT.md": renderLossAudit(b),
    "AGENTS.md": renderAgentsMd(b),
    "bundle.json": JSON.stringify(b, null, 2) + "\n"
  };
  if (opts.html !== false) files["index.html"] = renderHtml(b);
  if (opts.skill !== false) files["SKILL.md"] = renderSkill(b);
  for (const a of b.artifacts) {
    const bytes = a.encoding === "base64" ? artifactBytes(a) : void 0;
    if (a.content !== void 0) files[`files/${a.path}`] = bytes ?? a.content;
  }
  Object.assign(files, opts.extraFiles ?? {});
  return files;
}

// src/sinks/index.ts
var SINKS = ["salesforce", "jira", "zendesk", "slack"];
function summaryLine(b) {
  const s2 = b.stats;
  return `${s2.userMessages} prompts \xB7 ${s2.toolCalls} tool calls \xB7 files: ${s2.artifacts.recovered} recovered / ${s2.artifacts.stale} stale / ${s2.artifacts.lost} lost`;
}
function goal(b, n = 600) {
  return truncate(userPrompts(b)[0]?.text.trim() ?? b.title, n);
}
function latest(b, n = 600) {
  const p = userPrompts(b);
  return truncate(p[p.length - 1]?.text.trim() ?? "", n);
}
function priority(b) {
  if (b.loss.some((l) => l.severity === "high" && (l.category === "files-lost" || l.category === "tool-inputs"))) return "High";
  if (b.loss.some((l) => l.severity !== "info")) return "Medium";
  return "Low";
}
var toBase64 = (s2) => {
  const bytes = new TextEncoder().encode(s2);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
};
function salesforcePayload(b, o = {}) {
  const v = o.salesforceApiVersion ?? "v61.0";
  const threads = extractOpenThreads(b, 5);
  const noteHtml = renderHandoff(b).replace(/^---[\s\S]*?---\n/, "").split("\n").map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("");
  const parentRef = o.salesforceParentId ?? "@{case.id}";
  const req = [];
  if (!o.salesforceParentId) {
    req.push({
      method: "POST",
      url: `/services/data/${v}/sobjects/Case`,
      referenceId: "case",
      body: {
        Subject: truncate(`AI handoff: ${b.title}`, 255),
        Description: truncate(`${goal(b, 1500)}

Latest instruction: ${latest(b, 800)}

${summaryLine(b)}
Source: ${sourceLabel(b)}${b.source.url ? ` ${b.source.url}` : ""}
Baton bundle ${b.id} \xB7 root ${b.integrity.root}`, 32e3),
        Origin: "Web",
        Priority: priority(b),
        Status: "New"
      }
    });
  }
  req.push({
    method: "POST",
    url: `/services/data/${v}/sobjects/ContentNote`,
    referenceId: "note",
    body: { Title: truncate(`Baton handoff \xB7 ${b.title}`, 255), Content: toBase64(noteHtml) }
  });
  req.push({
    method: "POST",
    url: `/services/data/${v}/sobjects/ContentDocumentLink`,
    referenceId: "link",
    body: { ContentDocumentId: "@{note.id}", LinkedEntityId: parentRef, ShareType: "V" }
  });
  threads.forEach(
    (t, i) => req.push({
      method: "POST",
      url: `/services/data/${v}/sobjects/Task`,
      referenceId: `task${i + 1}`,
      body: { Subject: truncate(t, 255), WhatId: parentRef, Status: "Not Started", Priority: "Normal", Description: `Open thread from Baton handoff ${b.id}` }
    })
  );
  return {
    sink: "salesforce",
    method: "POST",
    path: `/services/data/${v}/composite`,
    body: { allOrNone: true, compositeRequest: req },
    notes: [
      o.salesforceParentId ? `Attaches to existing record ${o.salesforceParentId}.` : "Creates a Case, attaches the handoff as a ContentNote, and adds one Task per open thread.",
      "Env for --post: SALESFORCE_INSTANCE_URL, SALESFORCE_ACCESS_TOKEN (OAuth access token from a Connected App)."
    ]
  };
}
var text = (t, marks) => ({ type: "text", text: t, ...marks ? { marks: marks.map((m) => ({ type: m })) } : {} });
var para = (...content) => ({ type: "paragraph", content });
var heading = (level, t) => ({ type: "heading", attrs: { level }, content: [text(t)] });
var bullets = (items) => ({ type: "bulletList", content: items.map((i) => ({ type: "listItem", content: [para(text(i))] })) });
function jiraPayload(b, o = {}) {
  const prompts = userPrompts(b);
  const threads = extractOpenThreads(b, 8);
  const lostFiles = b.artifacts.filter((a) => a.status === "lost").map((a) => a.path);
  const content = [
    para(text("Handed off from "), text(sourceLabel(b), ["strong"]), text(` via Baton. ${summaryLine(b)}.`)),
    heading(3, "Goal"),
    para(text(goal(b, 2e3))),
    heading(3, "Latest instruction"),
    para(text(latest(b, 1e3) || "\u2014"))
  ];
  if (prompts.length > 1) content.push(heading(3, "Prompt history"), { type: "orderedList", content: prompts.map((p) => ({ type: "listItem", content: [para(text(truncate(p.text.replace(/\s+/g, " ").trim(), 400)))] })) });
  if (threads.length) content.push(heading(3, "Open threads / blockers"), bullets(threads));
  if (lostFiles.length) content.push(heading(3, "Files to rebuild (lost in transfer)"), bullets(lostFiles.slice(0, 30)));
  content.push(heading(3, "Integrity"), para(text(`bundle ${b.id} \xB7 sha256 root `), text(b.integrity.root, ["code"])));
  if (b.source.url) content.push(para({ type: "text", text: "Source conversation", marks: [{ type: "link", attrs: { href: b.source.url } }] }));
  return {
    sink: "jira",
    method: "POST",
    path: "/rest/api/3/issue",
    body: {
      fields: {
        project: { key: o.jiraProject ?? "${JIRA_PROJECT}" },
        issuetype: { name: o.jiraIssueType ?? "Task" },
        summary: truncate(`AI handoff: ${b.title}`, 250),
        labels: ["baton-handoff", `source-${b.source.kind}`],
        description: { type: "doc", version: 1, content }
      }
    },
    notes: ["Env for --post: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT (or --jira-project)."]
  };
}
function zendeskPayload(b) {
  const threads = extractOpenThreads(b, 8);
  const body = [
    `AI conversation handed off from ${sourceLabel(b)} via Baton.`,
    "",
    `Goal: ${goal(b, 1500)}`,
    "",
    `Latest instruction: ${latest(b, 800)}`,
    "",
    summaryLine(b),
    ...threads.length ? ["", "Open threads:", ...threads.map((t) => `- ${t}`)] : [],
    "",
    `Bundle ${b.id} \xB7 sha256 root ${b.integrity.root}`,
    b.source.url ? `Source: ${b.source.url}` : ""
  ].join("\n");
  return {
    sink: "zendesk",
    method: "POST",
    path: "/api/v2/tickets.json",
    body: {
      ticket: {
        subject: truncate(`AI handoff: ${b.title}`, 250),
        comment: { body, public: false },
        priority: priority(b).toLowerCase() === "medium" ? "normal" : priority(b).toLowerCase(),
        tags: ["baton_handoff", `source_${b.source.kind.replace(/-/g, "_")}`]
      }
    },
    notes: ["Creates a ticket with an internal note (public: false).", "Env for --post: ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN."]
  };
}
function slackPayload(b) {
  const threads = extractOpenThreads(b, 5);
  const esc = (s2) => s2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = [
    { type: "header", text: { type: "plain_text", text: truncate(`Handoff: ${b.title}`, 150) } },
    { type: "context", elements: [{ type: "mrkdwn", text: esc(`${sourceLabel(b)} \xB7 ${summaryLine(b)}`) }] },
    { type: "section", text: { type: "mrkdwn", text: `*Goal*
${esc(goal(b, 700))}` } },
    { type: "section", text: { type: "mrkdwn", text: `*Latest instruction*
${esc(latest(b, 500) || "\u2014")}` } }
  ];
  if (threads.length) blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Open threads*
${threads.map((t) => `\u2022 ${esc(truncate(t, 280))}`).join("\n")}` } });
  const high = b.loss.filter((l) => l.severity === "high");
  if (high.length) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `:warning: ${esc(high.map((l) => `${l.count} ${l.category}`).join(" \xB7 "))}. See LOSS_AUDIT.md` }] });
  if (b.source.url) blocks.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open source conversation" }, url: b.source.url }] });
  return {
    sink: "slack",
    method: "POST",
    path: "(incoming webhook URL)",
    body: { text: `Handoff: ${b.title}`, blocks },
    notes: ["Env for --post: SLACK_WEBHOOK_URL (incoming webhook)."]
  };
}
function buildSink(name, b, o = {}) {
  switch (name) {
    case "salesforce":
      return salesforcePayload(b, o);
    case "jira":
      return jiraPayload(b, o);
    case "zendesk":
      return zendeskPayload(b);
    case "slack":
      return slackPayload(b);
  }
}

// src/pipeline.ts
function pickConversations(list, pick) {
  if (!pick) return list;
  const q = pick.toLowerCase();
  const hit = list.filter((c) => c.source.conversationId === pick || c.title.toLowerCase().includes(q));
  if (!hit.length) throw new Error(`No conversation matches --pick "${pick}". Available: ${list.slice(0, 20).map((c) => `"${c.title}"`).join(", ")}${list.length > 20 ? ", \u2026" : ""}`);
  return hit;
}
function convert(text2, filename, opts = {}) {
  const parsed = pickConversations(parseAny(text2, filename, opts.url), opts.pick);
  const used = /* @__PURE__ */ new Set();
  return parsed.map((p) => {
    const { bundle, extraFiles } = buildBundle(p, opts);
    const extra = { ...extraFiles };
    for (const s2 of opts.sinks ?? []) extra[`sinks/${s2}.json`] = JSON.stringify(buildSink(s2, bundle, opts.sinkOptions), null, 2) + "\n";
    if (opts.keepSource) extra[`source/${filename.replace(/^.*[\\/]/, "") || "input.txt"}`] = text2;
    let slug = slugify(bundle.title);
    if (used.has(slug)) slug = `${slug}-${bundle.id.slice(0, 6)}`;
    used.add(slug);
    return { slug, bundle, files: renderBundleFiles(bundle, { extraFiles: extra, skill: opts.skill, html: opts.html }) };
  });
}
function pickExportMember(names) {
  const pref = names.filter((n) => /(^|\/)conversations\.json$/i.test(n));
  if (pref.length) return pref[0];
  return names.find((n) => /\.jsonl?$/i.test(n)) ?? names.find((n) => /\.html?$/i.test(n));
}

// src/node/io.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { gunzipSync, inflateRawSync } from "node:zlib";

// src/core/zip.ts
var CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data) {
  let c = 4294967295;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
var enc = new TextEncoder();
function dosDateTime(d) {
  const year = Math.max(1980, d.getUTCFullYear());
  return {
    time: d.getUTCHours() << 11 | d.getUTCMinutes() << 5 | Math.floor(d.getUTCSeconds() / 2),
    date: year - 1980 << 9 | d.getUTCMonth() + 1 << 5 | d.getUTCDate()
  };
}
function zip(files, mtime = /* @__PURE__ */ new Date()) {
  const { time, date } = dosDateTime(mtime);
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const name of Object.keys(files).sort()) {
    const raw = files[name];
    const data = typeof raw === "string" ? enc.encode(raw) : raw;
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 67324752, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 2048, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    locals.push(local, data);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 33639248, true);
    cv.setUint16(4, 798, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 2048, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(38, 33188 << 16 >>> 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 101010256, true);
  ev.setUint16(8, centrals.length, true);
  ev.setUint16(10, centrals.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
function listZip(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();
  let eocd = -1;
  for (let p2 = buf.length - 22; p2 >= Math.max(0, buf.length - 22 - 65535); p2--) {
    if (view.getUint32(p2, true) === 101010256) {
      eocd = p2;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip file (no end-of-central-directory record)");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  if (p === 4294967295) throw new Error("ZIP64 archives are not supported; unzip it and pass conversations.json instead");
  const out = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 33639248) throw new Error("Corrupt zip central directory");
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    out.push({ name, method, size, compressed: buf.subarray(start, start + csize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
function unzipSync(buf, inflateRaw, filter) {
  const out = {};
  for (const e of listZip(buf)) {
    if (e.name.endsWith("/") || filter && !filter(e.name)) continue;
    if (e.method === 0) out[e.name] = e.compressed;
    else if (e.method === 8 && inflateRaw) out[e.name] = inflateRaw(e.compressed);
    else throw new Error(`${e.name}: unsupported compression method ${e.method}`);
  }
  return out;
}
function unzipStored(buf) {
  return unzipSync(buf);
}

// src/node/io.ts
var SHARE_HOSTS = /* @__PURE__ */ new Set(["chatgpt.com", "chat.openai.com"]);
var UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Baton/0.1";
function isShareUrl(s2) {
  try {
    const u = new URL(s2);
    return u.protocol === "https:" && SHARE_HOSTS.has(u.hostname) && /^\/(?:share|s)\/[A-Za-z0-9-]+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}
async function fetchShare(url, timeoutMs = 3e4) {
  if (!isShareUrl(url)) {
    throw new Error(`Only public ChatGPT share links are fetched (https://chatgpt.com/share/<id>). For other sources, export the data and pass the file. Got: ${url}`);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`Fetching share link failed: HTTP ${res.status}. The link may be private, deleted, or rate-limited. Try saving the page (Ctrl/Cmd+S) and passing the .html file.`);
    const text2 = await res.text();
    if (!text2.includes("streamController.enqueue")) {
      throw new Error("The page did not contain conversation data (possibly a login or bot-check page). Save the page from your browser and pass the .html file instead.");
    }
    return { text: text2, filename: "share.html", url };
  } finally {
    clearTimeout(t);
  }
}
function readInputFile(path) {
  const buf = readFileSync(path);
  if (buf.length >= 4 && buf.readUInt32LE(0) === 67324752) {
    const members = unzipSync(new Uint8Array(buf), (d) => new Uint8Array(inflateRawSync(d)), (n) => /\.(json|jsonl|html?)$/i.test(n));
    const name = pickExportMember(Object.keys(members));
    if (!name) throw new Error(`${path}: zip contains no conversations.json / .jsonl / .html`);
    return { text: new TextDecoder().decode(members[name]), filename: name };
  }
  if (buf.length >= 2 && buf[0] === 31 && buf[1] === 139) {
    return { text: gunzipSync(buf).toString("utf8"), filename: path.replace(/\.gz$/, "") };
  }
  return { text: buf.toString("utf8"), filename: path };
}
async function loadInput(source) {
  if (/^https?:\/\//i.test(source)) return fetchShare(source);
  if (!existsSync(source)) throw new Error(`No such file: ${source}`);
  if (statSync(source).isDirectory()) {
    const latest2 = newestJsonl(source);
    if (!latest2) throw new Error(`${source} is a directory without .jsonl session logs`);
    return readInputFile(latest2);
  }
  return readInputFile(source);
}
function claudeProjectsDir() {
  return process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, "projects") : join(homedir(), ".claude", "projects");
}
function projectSlug(cwd) {
  return cwd.replace(/[^A-Za-z0-9]/g, "-");
}
function newestJsonl(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => ({ f: join(dir, f), m: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.m - a.m);
  return files[0]?.f;
}
function findSession(idOrLatest = "latest", cwd = process.cwd()) {
  const base = claudeProjectsDir();
  const projDir = join(base, projectSlug(cwd));
  if (idOrLatest !== "latest") {
    const direct = join(projDir, `${idOrLatest}.jsonl`);
    if (existsSync(direct)) return direct;
    for (const d of existsSync(base) ? readdirSync(base) : []) {
      const p = join(base, d, `${idOrLatest}.jsonl`);
      if (existsSync(p)) return p;
    }
    throw new Error(`Session ${idOrLatest} not found under ${base}`);
  }
  const latest2 = existsSync(projDir) ? newestJsonl(projDir) : void 0;
  if (!latest2) throw new Error(`No Claude Code sessions found for ${cwd} (looked in ${projDir})`);
  return latest2;
}
function writeFiles(outDir, files) {
  const root = resolve(outDir);
  const written = [];
  for (const [rel, content] of Object.entries(files)) {
    const target = resolve(root, rel);
    if (target !== root && !target.startsWith(root + sep)) throw new Error(`Refusing to write outside ${root}: ${rel}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    written.push(relative(process.cwd(), target) || target);
  }
  return written;
}
function writeZip(path, files, prefix = "") {
  const prefixed = {};
  for (const [k, v] of Object.entries(files)) prefixed[prefix ? `${prefix}/${k}` : k] = v;
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, zip(prefixed));
}
function readBundleFiles(path) {
  const dec = new TextDecoder();
  if (statSync(path).isDirectory()) {
    const out = {};
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else {
          const rel = relative(path, p).split(sep).join("/");
          out[rel] = rel.startsWith("files/") ? new Uint8Array(readFileSync(p)) : readFileSync(p, "utf8");
        }
      }
    };
    walk(path);
    return out;
  }
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) === 67324752) {
    const members = unzipSync(new Uint8Array(buf), (d) => new Uint8Array(inflateRawSync(d)));
    const out = {};
    const names = Object.keys(members);
    const bundleJson = names.find((n) => n.endsWith("bundle.json"));
    const prefix = bundleJson ? bundleJson.slice(0, -"bundle.json".length) : "";
    for (const n of names) {
      if (!n.startsWith(prefix)) continue;
      const rel = n.slice(prefix.length);
      out[rel] = rel.startsWith("files/") ? members[n] : dec.decode(members[n]);
    }
    return out;
  }
  return { "bundle.json": buf.toString("utf8") };
}

// src/node/post.ts
function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}
async function postSink(p) {
  let url;
  const headers = { "content-type": "application/json", accept: "application/json" };
  let body = p.body;
  switch (p.sink) {
    case "salesforce":
      url = need("SALESFORCE_INSTANCE_URL").replace(/\/$/, "") + p.path;
      headers.authorization = `Bearer ${need("SALESFORCE_ACCESS_TOKEN")}`;
      break;
    case "jira": {
      url = need("JIRA_BASE_URL").replace(/\/$/, "") + p.path;
      headers.authorization = `Basic ${btoa(`${need("JIRA_EMAIL")}:${need("JIRA_API_TOKEN")}`)}`;
      const project = process.env.JIRA_PROJECT;
      const json = JSON.stringify(body);
      if (json.includes("${JIRA_PROJECT}")) {
        if (!project) throw new Error("Set JIRA_PROJECT or pass --jira-project");
        body = JSON.parse(json.replace("${JIRA_PROJECT}", project));
      }
      break;
    }
    case "zendesk":
      url = `https://${need("ZENDESK_SUBDOMAIN")}.zendesk.com${p.path}`;
      headers.authorization = `Basic ${btoa(`${need("ZENDESK_EMAIL")}/token:${need("ZENDESK_API_TOKEN")}`)}`;
      break;
    case "slack":
      url = need("SLACK_WEBHOOK_URL");
      break;
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, url: url.replace(/(hooks\.slack\.com\/services\/)\S+/, "$1\u2026"), response: (await res.text()).slice(0, 2e3) };
}

// src/mcp/server.ts
import { join as join3, resolve as resolve2 } from "node:path";
import { createInterface } from "node:readline";

// src/mcp/protocol.ts
var SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
async function handleRpc(msg, tools, info, session) {
  const id = msg.id;
  const method = msg.method;
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (method === "initialize") {
    const params = msg.params ?? {};
    const ci = params.clientInfo;
    if (ci && typeof ci.name === "string") session.clientName = ci.name;
  }
  if (id === void 0 || id === null) return void 0;
  switch (method) {
    case "initialize": {
      const requested = msg.params?.protocolVersion;
      return reply({
        protocolVersion: requested && SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: info.name, version: info.version },
        instructions: info.instructions
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: tools.map(({ run: _r, ...t }) => t) });
    case "tools/call": {
      const params = msg.params ?? {};
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) return fail(-32602, `Unknown tool: ${String(params.name)}`);
      try {
        const text2 = await tool.run(params.arguments ?? {}, { clientName: session.clientName });
        return reply({ content: [{ type: "text", text: text2 }] });
      } catch (err) {
        return reply({ content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true });
      }
    }
    case "resources/list":
      return reply({ resources: [] });
    case "resources/templates/list":
      return reply({ resourceTemplates: [] });
    case "prompts/list":
      return reply({ prompts: [] });
    default:
      return fail(-32601, `Method not found: ${String(method)}`);
  }
}

// src/relay/store.ts
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync2, renameSync, rmSync, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";

// src/relay/kvstore.ts
var ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var CODE_RE = /^BTN(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
function newCode() {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => ALPHABET[b & 31]);
  return `BTN-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}
function normaliseCode(input) {
  const c = input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^BTN/, "").replace(/[IL]/g, "1").replace(/O/g, "0");
  return c.length === 12 ? `BTN-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}` : input.trim();
}
var AsyncRelayStore = class {
  kv;
  ttlMs;
  maxBytes;
  constructor(kv, limits = {}) {
    this.kv = kv;
    this.ttlMs = (limits.ttlDays ?? 7) * 864e5;
    this.maxBytes = limits.maxBytes ?? 25 * 1024 * 1024;
  }
  key(code) {
    if (!CODE_RE.test(code)) throw new Error(`Invalid pickup code: ${code}`);
    return `h:${code}`;
  }
  async write(r) {
    const json = JSON.stringify(r);
    if (json.length > this.maxBytes) throw new Error(`Handoff too large (${(json.length / 1048576).toFixed(1)} MB > ${(this.maxBytes / 1048576).toFixed(0)} MB limit)`);
    const ttl = Math.max(60, Math.round((Date.parse(r.expiresAt) - Date.now()) / 1e3));
    await this.kv.put(this.key(r.code), json, { expirationTtl: ttl });
    return r;
  }
  async create(init) {
    const now = /* @__PURE__ */ new Date();
    let code = newCode();
    while (await this.kv.get(this.key(code))) code = newCode();
    return this.write({
      code,
      title: init.title ?? init.bundle?.title ?? "Untitled handoff",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      from: [init.from],
      bundle: init.bundle,
      sealed: init.sealed,
      owner: init.owner,
      checkpoints: []
    });
  }
  async get(code) {
    const c = normaliseCode(code);
    if (!CODE_RE.test(c)) return void 0;
    const raw = await this.kv.get(this.key(c));
    if (!raw) return void 0;
    const r = JSON.parse(raw);
    if (Date.parse(r.expiresAt) < Date.now()) {
      await this.kv.delete(this.key(c));
      return void 0;
    }
    return r;
  }
  async remove(code) {
    await this.kv.delete(this.key(normaliseCode(code)));
  }
  async addCheckpoint(code, c) {
    const r = await this.get(code);
    if (!r) throw new Error(`No handoff ${code} (expired or never created)`);
    if (r.sealed) throw new Error("This handoff is end-to-end encrypted; checkpoints cannot be added on the server");
    r.checkpoints.push({ ...c, seq: r.checkpoints.length + 1, at: (/* @__PURE__ */ new Date()).toISOString() });
    if (c.title) r.title = c.title;
    if (!r.from.includes(c.from)) r.from.push(c.from);
    r.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return this.write(r);
  }
  async list(limit = 20) {
    const out = [];
    for (const k of await this.kv.list("h:")) {
      const r = await this.get(k.slice(2));
      if (r) out.push(r);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }
  async purgeExpired() {
    let n = 0;
    for (const k of await this.kv.list("h:")) {
      const raw = await this.kv.get(k);
      if (raw && Date.parse(JSON.parse(raw).expiresAt) < Date.now()) {
        await this.kv.delete(k);
        n++;
      }
    }
    return n;
  }
};

// src/relay/store.ts
function defaultStoreDir() {
  return process.env.BATON_STORE ?? join2(homedir2(), ".baton", "store");
}
var FileKV = class {
  dir;
  constructor(dir) {
    this.dir = dir;
    mkdirSync2(dir, { recursive: true });
  }
  file(key) {
    return join2(this.dir, `${key.replace(/^h:/, "").replace(/[^A-Z0-9-]/gi, "_")}.json`);
  }
  async get(key) {
    const f = this.file(key);
    return existsSync2(f) ? readFileSync2(f, "utf8") : null;
  }
  async put(key, value) {
    const f = this.file(key);
    writeFileSync2(f + ".tmp", value);
    renameSync(f + ".tmp", f);
  }
  async delete(key) {
    rmSync(this.file(key), { force: true });
  }
  async list(prefix) {
    return readdirSync2(this.dir).filter((f) => f.endsWith(".json")).map((f) => `h:${f.slice(0, -5)}`).filter((k) => k.startsWith(prefix));
  }
};
var RelayStore = class extends AsyncRelayStore {
  dir;
  constructor(opts = {}) {
    const dir = opts.dir ?? defaultStoreDir();
    super(new FileKV(dir), {
      ttlDays: opts.ttlDays ?? Number(process.env.BATON_TTL_DAYS ?? 7),
      maxBytes: opts.maxBytes ?? Number(process.env.BATON_MAX_BYTES ?? 25 * 1024 * 1024)
    });
    this.dir = dir;
  }
};

// src/relay/checkpoint.ts
function bullets2(title, items) {
  return items && items.length ? `**${title}**
${items.map((i) => `- ${i}`).join("\n")}
` : "";
}
function checkpointToEvents(c, seenPrompts) {
  const events = [];
  const id = `cp${c.seq}`;
  events.push({ id: `${id}-note`, kind: "note", role: "assistant", time: c.at, text: `Checkpoint ${c.seq} from ${c.from}` });
  (c.user_prompts ?? []).forEach((p, i) => {
    const key = p.trim();
    if (!key || seenPrompts.has(key)) return;
    seenPrompts.add(key);
    events.push({ id: `${id}-u${i + 1}`, kind: "message", role: "user", time: c.at, text: p, meta: { recalledBy: c.from } });
  });
  const body = [
    c.goal ? `**Goal.** ${c.goal}
` : "",
    `**State.** ${c.state}
`,
    bullets2("Decisions", c.decisions),
    bullets2("Next steps", c.next_steps),
    bullets2("Open questions", c.open_questions),
    c.notes ? `**Notes.** ${c.notes}
` : ""
  ].filter(Boolean).join("\n");
  events.push({ id: `${id}-state`, kind: "message", role: "assistant", time: c.at, text: body, meta: { checkpoint: c.seq, from: c.from } });
  (c.tool_outputs ?? []).forEach((t, i) => {
    events.push({ id: `${id}-t${i + 1}`, kind: "tool_call", role: "assistant", time: c.at, text: t.tool, tool: { name: t.tool, input: t.input } });
    events.push({ id: `${id}-r${i + 1}`, kind: "tool_result", role: "tool", time: c.at, text: t.output, tool: { name: t.tool } });
  });
  const files = (c.files ?? []).map((f) => ({ path: f.path, content: f.content, encoding: f.encoding, eventId: `${id}-state`, note: `written by the model at checkpoint ${c.seq} (${c.from})` }));
  return { events, files };
}
function bundleToParsed(b) {
  return {
    title: b.title,
    source: b.source,
    events: b.events.map(({ seq: _s, hash: _h, ...e }) => e),
    capturedFiles: b.artifacts.filter((a) => a.content !== void 0).map((a) => ({ path: a.originalPath, content: a.content, encoding: a.encoding, mimeType: a.mimeType, note: a.note })),
    loss: b.loss.filter((l) => !["files-recovered", "files-lost", "files-stale", "tool-outputs", "tool-inputs", "baton-redactions", "private-context"].includes(l.category)),
    sourceLinks: b.links
  };
}
function recordToParsed(r) {
  const base = r.bundle ? bundleToParsed(r.bundle) : { title: r.title, source: { kind: "baton-relay", tool: r.from.join(" + ") || "Baton relay", conversationId: r.code, createdAt: r.createdAt, updatedAt: r.updatedAt }, events: [], capturedFiles: [] };
  const seen = new Set(base.events.filter((e) => e.kind === "message" && e.role === "user").map((e) => e.text.trim()));
  for (const c of r.checkpoints) {
    const { events, files } = checkpointToEvents(c, seen);
    base.events.push(...events);
    base.capturedFiles = [...base.capturedFiles ?? [], ...files];
  }
  const goal2 = [...r.checkpoints].reverse().find((c) => c.goal)?.goal;
  if (!base.events.some((e) => e.kind === "message" && e.role === "user") && goal2) {
    base.events.unshift({ id: "goal", kind: "message", role: "user", text: goal2, meta: { recalledBy: "checkpoint goal" } });
  }
  if (r.checkpoints.length) {
    base.loss = [
      ...base.loss ?? [],
      { category: "model-reported", count: r.checkpoints.length, severity: "info", detail: `${r.checkpoints.length} checkpoint(s) were written by the model from inside ${[...new Set(r.checkpoints.map((c) => c.from))].join(", ")}. They reflect what the model held in context. Prompts marked "recalled" are the model's copy of them.` }
    ];
  }
  base.title = r.title || base.title;
  return base;
}
function renderRecord(r, now) {
  const { bundle, extraFiles } = buildBundle(recordToParsed(r), { now: now ?? r.updatedAt });
  return { bundle, files: renderBundleFiles(bundle, { extraFiles }) };
}

// src/relay/tools.ts
var RELAY_INSTRUCTIONS = `Baton moves work between AIs. When the user says "baton", "hand this off", "send this to <another AI>", "save my progress", or before a long task risks losing context, call baton_checkpoint.
Put in EVERYTHING the next AI needs and a share link would lose: the user's prompts verbatim, the FULL contents of files you created or edited (not summaries), outputs of code/tools you ran, decisions with reasons, and next steps.
Give the user the pickup code. To continue work from another AI, call baton_pickup with the code the user gives you, then read the handoff and confirm the latest instruction before acting.`;
var fileSchema = {
  type: "object",
  properties: {
    path: { type: "string", description: "File path as used in the work, e.g. src/app.py or /mnt/data/report.md" },
    content: { type: "string", description: "Complete file content, verbatim. Never a summary." },
    encoding: { type: "string", enum: ["utf8", "base64"], description: "base64 only for binary files" }
  },
  required: ["path", "content"]
};
function pickupHint(code, opts) {
  return [
    `Pickup code: ${code}`,
    opts.publicUrl ? `Viewer: ${opts.publicUrl.replace(/\/$/, "")}/h/${code}` : "",
    `To continue in another AI: tell it "baton pickup ${code}" (with the Baton connector enabled), or run \`baton pickup ${code}\` in a terminal.`
  ].filter(Boolean).join("\n");
}
function relayTools(store, opts = {}) {
  const tools = [
    {
      name: "baton_checkpoint",
      title: "Hand off / save progress",
      description: "Save the current state of this work to Baton so another AI, teammate or later session can continue it. Creates a new handoff (returns a pickup code) or, with `handoff`, adds a checkpoint to an existing one. Include full file contents, tool/code outputs and verbatim user prompts: this is what share links and exports drop.",
      inputSchema: {
        type: "object",
        properties: {
          handoff: { type: "string", description: "Existing pickup code to add to (omit to create a new handoff)" },
          title: { type: "string", description: "Short name for the work" },
          goal: { type: "string", description: "The user's overall goal" },
          state: { type: "string", description: "Where the work stands right now: what is done, what is in progress, what is blocked" },
          decisions: { type: "array", items: { type: "string" }, description: "Decisions made, each with its reason" },
          next_steps: { type: "array", items: { type: "string" } },
          open_questions: { type: "array", items: { type: "string" } },
          user_prompts: { type: "array", items: { type: "string" }, description: "The user's prompts in this conversation, verbatim, oldest first" },
          files: { type: "array", items: fileSchema, description: "Every file created or modified, with complete content" },
          tool_outputs: {
            type: "array",
            items: { type: "object", properties: { tool: { type: "string" }, input: { type: "string" }, output: { type: "string" } }, required: ["tool", "output"] },
            description: "Important outputs of code runs, searches or other tools (the source UI often hides these)"
          },
          notes: { type: "string" }
        },
        required: ["state"]
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      run: async (a, ctx) => {
        const arr = (v) => Array.isArray(v) ? v.map((x) => typeof x === "string" ? x : JSON.stringify(x)) : void 0;
        const cp = {
          from: ctx.clientName || "mcp-client",
          title: typeof a.title === "string" ? a.title : void 0,
          goal: typeof a.goal === "string" ? a.goal : void 0,
          state: String(a.state ?? ""),
          decisions: arr(a.decisions),
          next_steps: arr(a.next_steps),
          open_questions: arr(a.open_questions),
          user_prompts: arr(a.user_prompts),
          files: Array.isArray(a.files) ? a.files : void 0,
          tool_outputs: Array.isArray(a.tool_outputs) ? a.tool_outputs : void 0,
          notes: typeof a.notes === "string" ? a.notes : void 0
        };
        if (!cp.state.trim()) throw new Error("`state` is required: describe where the work stands");
        const target = typeof a.handoff === "string" && a.handoff ? a.handoff : (await store.create({ title: cp.title, from: cp.from })).code;
        const rec = await store.addCheckpoint(target, cp);
        const { bundle } = renderRecord(rec);
        return [
          `Saved checkpoint ${rec.checkpoints.length} of "${rec.title}".`,
          `Captured: ${bundle.stats.userMessages} prompt(s), ${bundle.stats.artifacts.recovered} file(s), ${bundle.stats.toolResults} tool output(s). Expires ${rec.expiresAt.slice(0, 10)}.`,
          pickupHint(rec.code, opts)
        ].join("\n");
      }
    },
    {
      name: "baton_pickup",
      title: "Continue work from another AI",
      description: "Load a Baton handoff by its pickup code (BTN-XXXX-XXXX-XXXX) and return its HANDOFF brief: goal, verbatim prompts, state, decisions, next steps, files and what did not transfer. Small text files are included inline; fetch others with baton_get_file.",
      inputSchema: { type: "object", properties: { code: { type: "string", description: "Pickup code, e.g. BTN-7F3K-9QXA-2M4P" } }, required: ["code"] },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async (a) => {
        const rec = await store.get(String(a.code));
        if (!rec) throw new Error(`No handoff found for ${String(a.code)}. It may have expired; ask the user for the current code.`);
        if (rec.sealed && !rec.bundle) return `Handoff ${rec.code} is end-to-end encrypted. Open it with its full link (including the #key part) in a browser, or run \`baton pickup "<code>#<key>"\`.`;
        const { bundle, files } = renderRecord(rec);
        let budget = 4e4;
        const inline2 = [];
        for (const art of bundle.artifacts) {
          if (art.content === void 0 || art.encoding === "base64") continue;
          if (art.content.length > budget) break;
          budget -= art.content.length;
          inline2.push(`--- files/${art.path} ---
${art.content}`);
        }
        const rest = bundle.artifacts.filter((x) => x.content !== void 0).length - inline2.length;
        return [
          truncate(String(files["HANDOFF.md"]), 3e4),
          inline2.length ? `
## File contents

${inline2.join("\n\n")}` : "",
          rest > 0 ? `
(${rest} more file(s): call baton_get_file with code ${rec.code} and a path from \xA76.)` : ""
        ].join("\n");
      }
    },
    {
      name: "baton_get_file",
      title: "Get a file from a handoff",
      description: "Return one file from a Baton handoff (path as listed in its HANDOFF \xA76, with or without the files/ prefix).",
      inputSchema: { type: "object", properties: { code: { type: "string" }, path: { type: "string" } }, required: ["code", "path"] },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async (a) => {
        const rec = await store.get(String(a.code));
        if (!rec) throw new Error(`No handoff found for ${String(a.code)}`);
        const { bundle } = renderRecord(rec);
        const want = String(a.path).replace(/^files\//, "");
        const art = bundle.artifacts.find((x) => x.path === want) ?? bundle.artifacts.find((x) => x.path.endsWith(want));
        if (!art) throw new Error(`No file ${want}. Files: ${bundle.artifacts.map((x) => x.path).join(", ")}`);
        if (art.content === void 0) return `files/${art.path} is ${art.status}: ${art.note ?? "content not available"}`;
        return art.encoding === "base64" ? `files/${art.path} is binary (${art.bytes} bytes, ${art.mimeType ?? "unknown type"}), base64:
${art.content}` : art.content;
      }
    }
  ];
  if (opts.allowList) {
    tools.push({
      name: "baton_list",
      title: "List recent handoffs",
      description: "List recent handoffs in this Baton store (newest first) with their pickup codes.",
      inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async (a) => {
        const list = await store.list(Number(a.limit ?? 20));
        if (!list.length) return "No handoffs yet.";
        return list.map((r) => `${r.code}  ${r.updatedAt.slice(0, 16).replace("T", " ")}  ${r.title}  (from ${r.from.join(", ")}, ${r.checkpoints.length} checkpoint(s)${r.bundle ? ", captured bundle" : ""}${r.sealed ? ", encrypted" : ""})`).join("\n");
      }
    });
  }
  return tools;
}
function remoteRelayTools(url, token) {
  const call = async (name, args, ctx) => {
    const res = await fetch(url.replace(/\/$/, "") + (url.includes("/mcp") ? "" : "/mcp"), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...token ? { authorization: `Bearer ${token}` } : {}, "x-baton-client": ctx.clientName },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })
    });
    if (!res.ok) throw new Error(`Relay ${url} answered HTTP ${res.status}`);
    const msg = await res.json();
    if (msg.error) throw new Error(msg.error.message);
    const text2 = msg.result?.content?.map((c) => c.text).join("\n") ?? "";
    if (msg.result?.isError) throw new Error(text2.replace(/^Error: /, ""));
    return text2;
  };
  const local = relayTools({}, {});
  return local.map((t) => ({ ...t, run: (args, ctx) => call(t.name, args, ctx) }));
}

// src/mcp/server.ts
var s = (v) => typeof v === "string" && v ? v : void 0;
function loadBundle(path) {
  const raw = readBundleFiles(path);
  if (!raw["bundle.json"]) throw new Error(`${path}: no bundle.json`);
  const files = {};
  for (const [k, v] of Object.entries(raw)) if (k.startsWith("files/")) files[k.slice(6)] = v;
  return { bundle: JSON.parse(String(raw["bundle.json"])), files };
}
async function importAndWrite(text2, filename, url, args) {
  const results = convert(text2, filename, { url, redact: args.redact !== false, pick: s(args.pick) });
  const out = [];
  for (const r of results) {
    const dir = resolve2(results.length === 1 && s(args.out_dir) ? args.out_dir : join3(s(args.out_dir) ?? "handoffs", r.slug));
    writeFiles(dir, r.files);
    const b = r.bundle;
    out.push(
      `Bundle written to ${dir}`,
      `files: ${b.stats.artifacts.recovered} recovered \xB7 ${b.stats.artifacts.stale} stale \xB7 ${b.stats.artifacts.lost} lost \xB7 root ${b.integrity.root}`,
      "",
      args.include_handoff === false ? "" : truncate(String(r.files["HANDOFF.md"]), 24e3)
    );
  }
  return out.join("\n");
}
var FILE_TOOLS2 = [
  {
    name: "baton_import",
    description: "Import an AI conversation (ChatGPT share link, saved share page, ChatGPT/Claude export zip or conversations.json, Claude Code .jsonl, or [{role,content}] log) and write a handoff bundle: HANDOFF.md (start here), TRANSCRIPT.md, LOSS_AUDIT.md, recovered files/, replay/, SKILL.md. Returns the HANDOFF.md text so you can continue the work immediately.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "https://chatgpt.com/share/<id> URL, or a local file/dir path" },
        out_dir: { type: "string", description: "Output directory (default ./handoffs/<slug>)" },
        pick: { type: "string", description: "Conversation id or title substring for multi-conversation exports" },
        redact: { type: "boolean", description: "Redact secrets and PII (default true)" },
        include_handoff: { type: "boolean", description: "Return HANDOFF.md text in the result (default true)" }
      },
      required: ["source"]
    },
    run: async (args) => {
      const input = await loadInput(String(args.source));
      return importAndWrite(input.text, input.filename, input.url, args);
    }
  },
  {
    name: "baton_session",
    description: "Bundle a Claude Code session (this project by default) into a handoff, so another agent, teammate or tool can continue it.",
    inputSchema: {
      type: "object",
      properties: {
        session: { type: "string", description: '"latest" (default) or a session id' },
        cwd: { type: "string", description: "Project directory whose sessions to search (default: server cwd)" },
        out_dir: { type: "string" },
        include_handoff: { type: "boolean" }
      }
    },
    run: async (args) => {
      const path = findSession(s(args.session) ?? "latest", s(args.cwd) ?? process.cwd());
      const input = await loadInput(path);
      return importAndWrite(input.text, input.filename, void 0, args);
    }
  },
  {
    name: "baton_inspect",
    description: "Dry run: report what a source contains and what would NOT transfer (loss audit, file recovery status) without writing anything.",
    inputSchema: { type: "object", properties: { source: { type: "string" }, pick: { type: "string" } }, required: ["source"] },
    run: async (args) => {
      const input = await loadInput(String(args.source));
      const results = convert(input.text, input.filename, { url: input.url, pick: s(args.pick), html: false });
      return JSON.stringify(
        results.map((r) => ({ id: r.bundle.id, title: r.bundle.title, source: r.bundle.source, stats: r.bundle.stats, loss: r.bundle.loss, artifacts: r.bundle.artifacts.map(({ content: _c, ...rest }) => rest) })),
        null,
        2
      );
    }
  },
  {
    name: "baton_read_turn",
    description: "Read one turn of a bundle transcript (user prompt + reasoning + tool calls + replies). Use instead of loading the whole TRANSCRIPT.md.",
    inputSchema: { type: "object", properties: { bundle: { type: "string", description: "Bundle directory, bundle.json or .zip" }, turn: { type: "integer", minimum: 1 } }, required: ["bundle", "turn"] },
    run: async (args) => {
      const { bundle } = loadBundle(String(args.bundle));
      const turns = splitTurns(bundle.events).filter((t2) => t2.prompt);
      const t = turns[Number(args.turn) - 1];
      if (!t) return `Turn ${String(args.turn)} not found; bundle has ${turns.length} turns.`;
      const md = renderTranscript({ ...bundle, events: [t.prompt, ...t.events] });
      return truncate(md, 6e4);
    }
  },
  {
    name: "baton_verify",
    description: "Verify a bundle has not been altered (recomputes the SHA-256 hash chain over events and recovered files).",
    inputSchema: { type: "object", properties: { bundle: { type: "string" } }, required: ["bundle"] },
    run: async (args) => {
      const { bundle, files } = loadBundle(String(args.bundle));
      return JSON.stringify(verifyBundle(bundle, files), null, 2);
    }
  },
  {
    name: "baton_sink",
    description: `Build a payload that files the handoff into a business system (${SINKS.join(", ")}). With post=true, sends it using credentials from the server's environment.`,
    inputSchema: {
      type: "object",
      properties: { bundle: { type: "string" }, to: { type: "string", enum: SINKS }, post: { type: "boolean" }, jira_project: { type: "string" }, salesforce_parent_id: { type: "string" } },
      required: ["bundle", "to"]
    },
    run: async (args) => {
      const { bundle } = loadBundle(String(args.bundle));
      const payload = buildSink(String(args.to), bundle, { jiraProject: s(args.jira_project), salesforceParentId: s(args.salesforce_parent_id) });
      if (args.post !== true) return JSON.stringify(payload, null, 2);
      return JSON.stringify(await postSink(payload), null, 2);
    }
  }
];
function localTools() {
  const relay = process.env.BATON_RELAY_URL ? remoteRelayTools(process.env.BATON_RELAY_URL, process.env.BATON_RELAY_TOKEN) : relayTools(new RelayStore(), { allowList: true, publicUrl: process.env.BATON_PUBLIC_URL });
  return [...FILE_TOOLS2, ...relay];
}
var INFO = {
  name: "baton",
  version: VERSION,
  instructions: `${RELAY_INSTRUCTIONS}
For files on disk (ChatGPT share links, exports, Claude Code sessions) use baton_import / baton_session and read the returned HANDOFF.md. Respect the loss audit: lost files do not exist.`
};
var cachedTools;
var stdioSession = { clientName: "mcp-client" };
async function handleMessage(msg, session = stdioSession) {
  cachedTools ??= localTools();
  return handleRpc(msg, cachedTools, INFO, session);
}
async function startMcpServer() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const write = (m) => process.stdout.write(JSON.stringify(m) + "\n");
  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    const res = await handleMessage(msg);
    if (res) write(res);
  }
}

// src/relay/seal.ts
var subtle = () => globalThis.crypto.subtle;
var b64url = (b) => bytesToBase64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var fromB64url = (s2) => base64ToBytes(s2.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s2.length + 3) % 4));
async function seal(plaintext) {
  const raw = new Uint8Array(32);
  globalThis.crypto.getRandomValues(raw);
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const key = await subtle().importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return { sealed: { iv: bytesToBase64(iv), data: bytesToBase64(ct), alg: "AES-GCM-256" }, key: b64url(raw) };
}
async function unseal(sealed, keyB64url) {
  const key = await subtle().importKey("raw", fromB64url(keyB64url), "AES-GCM", false, ["decrypt"]);
  try {
    return new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: base64ToBytes(sealed.iv) }, key, base64ToBytes(sealed.data)));
  } catch {
    throw new Error("Could not decrypt: wrong key or tampered data");
  }
}
function parsePickup(input) {
  const [left, key] = input.trim().split("#");
  const m = left.match(/^(https?:\/\/.+?)\/h\/(BTN-[0-9A-Z-]+)/i);
  if (m) return { base: m[1], code: m[2].toUpperCase(), key: key || void 0 };
  return { code: left.toUpperCase(), key: key || void 0 };
}
function sealedPlaintext(bundle, files) {
  const prefixed = {};
  for (const [k, v] of Object.entries(files)) prefixed[`${bundle.id}/${k}`] = v;
  return new TextEncoder().encode(JSON.stringify({ title: bundle.title, handoff: String(files["HANDOFF.md"]), prompt: String(files["PROMPT.md"]), zip: bytesToBase64(zip(prefixed)) }));
}

// src/relay/client.ts
async function sendBundle(bundle, files, opts) {
  let body = { bundle, from: opts.from ?? "cli" };
  let key;
  if (opts.sealed) {
    const s2 = await seal(sealedPlaintext(bundle, files));
    body = { sealed: s2.sealed, title: bundle.title, from: opts.from ?? "cli" };
    key = s2.key;
  }
  if (!opts.relay) {
    const store = opts.store ?? new RelayStore();
    const rec = await store.create({ title: bundle.title, from: String(body.from), bundle: body.bundle, sealed: body.sealed });
    return { code: rec.code, link: key ? `${rec.code}#${key}` : rec.code, sealed: !!key, expiresAt: rec.expiresAt };
  }
  const res = await fetch(opts.relay.replace(/\/$/, "") + "/api/handoffs", {
    method: "POST",
    headers: { "content-type": "application/json", ...opts.token ? { authorization: `Bearer ${opts.token}` } : {} },
    body: JSON.stringify(body)
  });
  const out = await res.json();
  if (!res.ok || !out.code) throw new Error(`Relay refused the upload: ${out.error ?? res.status}`);
  const base = out.url?.startsWith("http") ? out.url : `${opts.relay.replace(/\/$/, "")}/h/${out.code}`;
  return { code: out.code, link: key ? `${base}#${key}` : base, sealed: !!key, expiresAt: out.expiresAt };
}
async function pickup(input, opts = {}) {
  const p = parsePickup(input);
  const relay = p.base ?? opts.relay;
  let rec;
  if (relay) {
    const res = await fetch(`${relay.replace(/\/$/, "")}/api/handoffs/${encodeURIComponent(p.code)}`);
    if (res.status === 404) throw new Error(`No handoff ${p.code} on ${relay} (expired or wrong code)`);
    if (!res.ok) throw new Error(`Relay answered HTTP ${res.status}`);
    rec = await res.json();
  } else {
    rec = await (opts.store ?? new RelayStore()).get(p.code);
    if (!rec) throw new Error(`No handoff ${p.code} in the local store. Pass --relay <url> if it was sent to a remote relay.`);
  }
  if (rec.sealed && !rec.bundle) {
    if (!p.key) throw new Error('This handoff is end-to-end encrypted: use the full code including "#key".');
    const payload = JSON.parse(new TextDecoder().decode(await unseal(rec.sealed, p.key)));
    const members = unzipStored(base64ToBytes(payload.zip));
    const files2 = {};
    for (const [k, v] of Object.entries(members)) files2[k.replace(/^[^/]+\//, "")] = k.endsWith(".md") || k.endsWith(".json") || k.endsWith(".html") ? new TextDecoder().decode(v) : v;
    return { code: rec.code, files: files2, title: payload.title };
  }
  const { files, bundle } = renderRecord(rec);
  return { code: rec.code, files, title: bundle.title };
}

// src/relay/server.ts
import { readFileSync as readFileSync3 } from "node:fs";
import { createServer } from "node:http";

// src/relay/linkpage.ts
function aiBrief(b, files, budget = 9e4) {
  const handoff = String(files["HANDOFF.md"] ?? "").replace(/^---[\s\S]*?---\n/, "");
  const parts = [
    `# Baton handoff: ${b.title}`,
    "",
    `> **To the AI reading this:** a user moved this work here from ${b.source.tool}. Read the brief, restate the goal and where`,
    "> the work stopped in 2\u20133 sentences, list anything marked lost, then continue from the latest instruction (\xA73).",
    "> Do not assume lost files exist.",
    "",
    handoff
  ];
  let room = budget - parts.join("\n").length;
  const inline2 = [];
  for (const a of b.artifacts) {
    if (a.content === void 0 || a.encoding === "base64") continue;
    const block = `### files/${a.path}

\`\`\`
${a.content.replace(/```/g, "`\u200B``")}
\`\`\``;
    if (block.length > room) {
      inline2.push(`### files/${a.path}

*(${a.bytes} bytes, not inlined here: download the .zip)*`);
      continue;
    }
    room -= block.length;
    inline2.push(block);
  }
  if (inline2.length) parts.push("", "## File contents", "", ...inline2);
  return parts.join("\n") + "\n";
}
var clip = (s2, n) => {
  const t = s2.replace(/```[\s\S]*?```/g, (m) => m.length > 600 ? m.slice(0, 560) + "\n\u2026```" : m).replace(/\n{3,}/g, "\n\n").trim();
  return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, "") + " \u2026" : t;
};
function continuePrompt(b, url, max = 5e3) {
  const prompts = userPrompts(b);
  const first = prompts[0]?.text ?? "";
  const latest2 = prompts.length > 1 ? prompts[prompts.length - 1].text : "";
  const last = lastVisibleAssistant(b, 1)[0]?.text ?? "";
  const threads = extractOpenThreads(b, 4);
  const ok = b.artifacts.filter((a) => a.status === "recovered" || a.status === "attached").map((a) => a.path);
  const high = b.loss.filter((l) => l.severity === "high").map((l) => `${l.count} ${l.category.replace(/-/g, " ")}`);
  const head = `Continue my work from another AI chat. Baton handoff of "${b.title}" from ${b.source.tool} (${prompts.length} ${prompts.length === 1 ? "prompt" : "prompts"}).`;
  const tail = `Everything (full brief, file contents, transcript): ${url}

First tell me in 2\u20133 lines where we left off, then carry on. If you can't open links, work from the above and ask me for anything missing.`;
  const fixed = [
    ok.length ? `FILES THAT CAME ACROSS: ${ok.slice(0, 12).join(", ")}${ok.length > 12 ? `, +${ok.length - 12} more` : ""}` : "",
    high.length ? `DID NOT TRANSFER (don't assume these exist): ${high.join(", ")}` : ""
  ].filter(Boolean);
  const threadBlock = threads.length ? `OPEN THREADS:
${threads.map((t) => `- ${clip(t, 220)}`).join("\n")}` : "";
  let room = max - head.length - tail.length - fixed.join("\n\n").length - threadBlock.length - 120;
  const goalN = Math.max(200, Math.min(900, Math.floor(room * 0.3)));
  const latestN = latest2 ? Math.max(150, Math.min(700, Math.floor(room * 0.2))) : 0;
  room -= goalN + latestN;
  const where = last ? clip(last, Math.max(200, room)) : "";
  const sections = [
    head,
    `GOAL (my first message):
${clip(first, goalN)}`,
    latest2 ? `LATEST INSTRUCTION:
${clip(latest2, latestN)}` : "",
    where ? `WHERE IT STOPPED (${where.endsWith(" \u2026") ? "last reply, shortened" : "last reply"}):
${where}` : "",
    ...fixed,
    where.endsWith(" \u2026") ? threadBlock : "",
    // the open threads only add something when the last reply was cut
    tail
  ].filter(Boolean);
  return sections.join("\n\n");
}
function copyText(b, files, url) {
  return `${aiBrief(b, files, 6e4)}
---
This handoff online (files, transcript, zip): ${url}
`;
}
function continueUrl(to, linkUrl, b) {
  const q = encodeURIComponent(continuePrompt(b, linkUrl));
  if (to === "claude") return `https://claude.ai/new?q=${q}`;
  if (to === "chatgpt") return `https://chatgpt.com/?q=${q}`;
  if (to === "gemini") return `${linkUrl}?to=gemini`;
  return `${linkUrl}?new=1`;
}

// src/parsers/pasted.ts
var SAID = /^(you|chatgpt|gemini|claude|copilot|perplexity|deepseek|grok|meta ai|mistral|le chat)\s+said:?\s*(.*)$/i;
var LABEL = /^\s*(?:\*\*)?(user|human|me|you|q|question|assistant|ai|a|answer|chatgpt|gpt|claude|gemini|bard|copilot|bot|model)(?:\*\*)?\s*:(?:\*\*)?\s*(.*)$/i;
var ASSISTANT_NAMES = /^(chatgpt|gemini|claude|copilot|perplexity|deepseek|grok|meta ai|mistral|le chat|assistant|ai|a|answer|gpt|bard|bot|model)$/i;
var CHROME = /^(?:(?:chatgpt|gemini|claude|copilot) (?:is ai and )?can make mistakes.*|.*can make mistakes\. check important info.*|sign in.*|log in|sign up.*|new chat|share|copy|edit|retry|regenerate|report conversation|get (?:the )?gemini app|subscriptions|for business|about gemini|images|flash(?:-lite)?|pro|thinking|show thinking|conversation with gemini|this is a copy of a shared chatgpt chat.*|today(?: \d.*)?|yesterday|\d{1,2}:\d{2}\s?(?:am|pm)?|voice|search|tools|ask anything|message chatgpt|reply to claude.*|how can i help you today\??|sources)$/i;
var nextNonEmpty = (lines, i) => {
  for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return lines[j].trim();
  return "";
};
function splitBy(lines, classify) {
  const turns = [];
  let cur = null;
  lines.forEach((line, i) => {
    const m = classify(line, i);
    if (m) {
      if (cur) turns.push({ role: cur.role, text: cur.buf.join("\n") });
      cur = { role: m.role, buf: m.inline ? [m.inline] : [] };
    } else if (cur) cur.buf.push(line);
  });
  if (cur) turns.push({ role: cur.role, text: cur.buf.join("\n") });
  return turns;
}
function trimChrome(text2, edge) {
  const ls = text2.split("\n");
  const junk = (l) => !l.trim() || CHROME.test(l.trim());
  while (ls.length && junk(ls[ls.length - 1])) ls.pop();
  if (edge === "both") while (ls.length && junk(ls[0])) ls.shift();
  return ls.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function splitPastedChat(text2) {
  const lines = text2.replace(/\r\n?/g, "\n").replace(/ /g, " ").split("\n");
  const said = (line, i) => {
    const m = line.trim().match(SAID);
    if (!m) return null;
    const role = m[1].toLowerCase() === "you" ? "user" : "assistant";
    const rest = m[2].trim();
    if (!rest) return { role, inline: "" };
    if (role === "user" && rest === nextNonEmpty(lines, i)) return { role, inline: "" };
    return null;
  };
  let turns = splitBy(lines, said);
  if (!(turns.some((t) => t.role === "user") && turns.some((t) => t.role === "assistant"))) {
    turns = splitBy(lines, (line) => {
      const m = line.match(LABEL);
      if (!m) return null;
      return { role: ASSISTANT_NAMES.test(m[1]) ? "assistant" : "user", inline: m[2] };
    });
    if (!(turns.some((t) => t.role === "user") && turns.some((t) => t.role === "assistant"))) return [];
  }
  return turns.map((t) => ({ role: t.role, text: trimChrome(t.text, "both") })).filter((t) => t.text);
}
function titleFrom(s2) {
  const first = s2.split("\n").find((l) => l.trim())?.trim() ?? "Pasted conversation";
  return first.length > 70 ? first.slice(0, 67).replace(/\s+\S*$/, "") + "\u2026" : first;
}
function guessTool(text2) {
  const said = text2.match(/^(ChatGPT|Gemini|Claude|Copilot|Perplexity|DeepSeek|Grok) said/im)?.[1];
  if (said) return said;
  if (/Gemini is AI and can make mistakes|Conversation with Gemini/i.test(text2)) return "Gemini";
  if (/ChatGPT (is AI and )?can make mistakes|shared ChatGPT chat/i.test(text2)) return "ChatGPT";
  if (/Claude can make mistakes/i.test(text2)) return "Claude";
  return "";
}
function parsePastedChat(text2, opts = {}) {
  const turns = splitPastedChat(text2);
  const tool = opts.tool || guessTool(text2);
  const label = `${tool || "An AI chat"} (pasted)`;
  if (!turns.length) {
    const body = text2.trim();
    if (!body) throw new Error("Nothing to read: the pasted text is empty.");
    return {
      title: opts.title || titleFrom(body),
      source: { kind: "pasted-text", tool: label, url: opts.url },
      events: [{ id: "p1", kind: "message", role: "user", text: body }],
      loss: [{ category: "unlabelled-paste", count: 1, severity: "warn", detail: "No speaker labels were found, so the whole paste is kept as one block. The next AI can still read it." }]
    };
  }
  const events = turns.map((t, i) => ({ id: `p${i + 1}`, kind: "message", role: t.role, text: t.text }));
  const firstUser = turns.find((t) => t.role === "user");
  return {
    title: opts.title || titleFrom(firstUser?.text ?? turns[0].text),
    source: { kind: "pasted-text", tool: label, url: opts.url },
    events,
    loss: [{ category: "pasted-text", count: events.length, severity: "warn", detail: "Pasted as text: messages and visible code only. Files, tool outputs and hidden reasoning are not in a copy. Use the Baton bookmark on the chat to capture more." }]
  };
}

// src/site/brand.ts
var BRAND = {
  name: "Baton",
  tagline: "Hand any AI chat to any other AI.",
  repo: "https://github.com/nimb-ou/App",
  ink: "#121314",
  paper: "#F5F2EA",
  signal: "#FF5A1F"
};
function markSvg(size = 32, opts = {}) {
  const tile = opts.tile ?? true;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" role="img" aria-label="${escapeHtml(opts.title ?? "Baton")}">${tile ? `<rect width="32" height="32" rx="9" fill="${BRAND.ink}"/>` : ""}<rect x="8.6" y="12.9" width="17.4" height="6.6" rx="3.3" transform="rotate(-38 17.3 16.2)" fill="${BRAND.signal}"/><path d="M6.2 24.6l3.4-2.7M5.6 19.4l2.3-1.8" stroke="${BRAND.signal}" stroke-width="2.1" stroke-linecap="round" opacity=".55"/></svg>`;
}
var FAVICON_SVG = markSvg(32);
var DESTINATIONS = [
  { id: "claude", name: "Claude", dot: "#D97757" },
  { id: "chatgpt", name: "ChatGPT", dot: "#10A37F" },
  { id: "gemini", name: "Gemini", dot: "#4F7DF3" }
];
var TOKENS = `
:root{
  --paper:#F5F2EA;--card:#FFFFFF;--sunk:#ECE7DC;--ink:#121314;--ink-2:#3A3A38;--mu:#6B675F;--line:#DED8CB;
  --signal:#FF5A1F;--signal-ink:#1C0A02;--signal-soft:#FFE6DA;--ok:#1E7A4C;--ok-soft:#DDF2E6;--bad:#B3261E;--bad-soft:#FBE3E1;--warn:#8A5A00;
  --r-sm:8px;--r:14px;--r-lg:22px;--shadow:0 1px 0 rgba(18,19,20,.04),0 8px 28px -12px rgba(18,19,20,.18);
  --f-display:ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"Segoe UI Variable Display","Segoe UI","Inter Display",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
  --f-body:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif;
  --f-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#0E0F10;--card:#17181A;--sunk:#1E2022;--ink:#F3F0E8;--ink-2:#D2CFC7;--mu:#9C988F;--line:#2A2C2F;
  --signal:#FF6A33;--signal-ink:#1C0A02;--signal-soft:#3A1B0F;--ok:#5FC891;--ok-soft:#12291D;--bad:#F2887E;--bad-soft:#3A1715;--warn:#E8B44D;
  --shadow:0 1px 0 rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.7);color-scheme:dark}}
:root[data-theme="dark"]{
  --paper:#0E0F10;--card:#17181A;--sunk:#1E2022;--ink:#F3F0E8;--ink-2:#D2CFC7;--mu:#9C988F;--line:#2A2C2F;
  --signal:#FF6A33;--signal-ink:#1C0A02;--signal-soft:#3A1B0F;--ok:#5FC891;--ok-soft:#12291D;--bad:#F2887E;--bad-soft:#3A1715;--warn:#E8B44D;
  --shadow:0 1px 0 rgba(0,0,0,.4),0 10px 30px -14px rgba(0,0,0,.7);color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 var(--f-body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit;text-underline-offset:3px}
img,svg{display:block;max-width:100%}
:focus-visible{outline:3px solid var(--signal);outline-offset:2px;border-radius:6px}
.wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
.narrow{max-width:760px}
h1,h2,h3{font-family:var(--f-display);line-height:1.05;letter-spacing:-.025em;margin:0;text-wrap:balance}
h1{font-size:clamp(40px,7.4vw,84px);font-weight:800}
h2{font-size:clamp(30px,4.6vw,52px);font-weight:800}
h3{font-size:20px;font-weight:750;letter-spacing:-.01em}
p{margin:0}
.lede{font-size:clamp(18px,2.1vw,22px);line-height:1.5;color:var(--ink-2);max-width:40ch;text-wrap:pretty}
.mu{color:var(--mu)}
.eyebrow{font:700 12.5px/1 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--mu)}
.code{font-family:var(--f-mono);font-size:.92em}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 22px;border-radius:999px;border:1.5px solid var(--ink);
  background:var(--card);color:var(--ink);font:700 16.5px/1 var(--f-body);text-decoration:none;cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,background .12s}
.btn:hover{transform:translateY(-1px);box-shadow:var(--shadow)}
.btn:active{transform:translateY(0)}
.btn.primary{background:var(--signal);border-color:var(--signal);color:var(--signal-ink)}
.btn.dark{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.btn.ghost{border-color:var(--line);background:transparent}
.btn.sm{min-height:40px;padding:0 16px;font-size:14.5px}
.btn .dot{width:10px;height:10px;border-radius:50%;flex:none}
.chip{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--sunk);font:600 13.5px/1.2 var(--f-body);color:var(--ink-2);white-space:nowrap}
.chip b{color:var(--ink);font-variant-numeric:tabular-nums}
.chip.bad{background:var(--bad-soft);color:var(--bad)}.chip.bad b{color:var(--bad)}
.chip.ok{background:var(--ok-soft);color:var(--ok)}.chip.ok b{color:var(--ok)}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--shadow)}
.nav{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--paper) 86%,transparent);backdrop-filter:saturate(1.4) blur(10px);-webkit-backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid transparent}
.nav.scrolled{border-bottom-color:var(--line)}
.nav .wrap{display:flex;align-items:center;gap:22px;height:64px}
.brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font:800 22px/1 var(--f-display);letter-spacing:-.03em}
.brand svg{border-radius:28%;box-shadow:0 0 0 1px color-mix(in srgb,var(--ink) 14%,transparent)}
.nav-links{display:flex;gap:22px;margin-left:auto;font-size:15px;font-weight:600}
.nav-links a{text-decoration:none;color:var(--ink-2)}.nav-links a:hover{color:var(--ink)}
@media (max-width:720px){.nav-links .hide-sm{display:none}}
.foot{border-top:1px solid var(--line);margin-top:96px;padding:36px 0 48px;color:var(--mu);font-size:14.5px}
.foot .wrap{display:flex;flex-wrap:wrap;gap:14px 28px;align-items:center}
.foot a{color:var(--ink-2);text-decoration:none}.foot a:hover{text-decoration:underline}
.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,16px);background:var(--ink);color:var(--paper);padding:12px 18px;border-radius:999px;font-weight:600;font-size:15px;opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;z-index:50;max-width:calc(100vw - 32px)}
.toast.on{opacity:1;transform:translate(-50%,0)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
var BASE_SCRIPT = `
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const toastEl=$('#toast');let toastT;const toast=m=>{toastEl.textContent=m;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('on'),2400)};
const copy=async s=>{try{await navigator.clipboard.writeText(s);return true}catch{const t=document.createElement('textarea');t.value=s;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();let ok=false;try{ok=document.execCommand('copy')}catch{}t.remove();return ok}};
const nav=$('.nav');if(nav){const f=()=>nav.classList.toggle('scrolled',scrollY>8);addEventListener('scroll',f,{passive:true});f()}
`;
function shell(p) {
  const desc = p.description ?? BRAND.tagline;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeHtml(p.title)}</title><meta name="description" content="${escapeHtml(desc)}">
<meta name="theme-color" content="${BRAND.paper}" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0E0F10" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.png"><link rel="manifest" href="/manifest.webmanifest">
<meta property="og:title" content="${escapeHtml(p.title)}"><meta property="og:description" content="${escapeHtml(desc)}"><meta property="og:type" content="website">
${p.ogImage ? `<meta property="og:image" content="${escapeHtml(p.ogImage)}"><meta name="twitter:card" content="summary_large_image">` : ""}
${p.canonical ? `<link rel="canonical" href="${escapeHtml(p.canonical)}">` : ""}${p.robots ? `<meta name="robots" content="${p.robots}">` : ""}${p.head ?? ""}
<style>${TOKENS}${p.css ?? ""}</style></head><body>
${p.nav === false ? "" : navHtml()}
${p.body}
${footHtml()}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>${BASE_SCRIPT}${p.script ?? ""}</script></body></html>`;
}
function navHtml() {
  return `<header class="nav"><div class="wrap"><a class="brand" href="/" aria-label="Baton home">${markSvg(30)}<span>baton</span></a>
<nav class="nav-links" aria-label="Main"><a class="hide-sm" href="/#how">How it works</a><a class="hide-sm" href="/demo">Live demo</a><a class="hide-sm" href="/privacy">Privacy</a><a href="/#get">Get Baton</a></nav></div></header>`;
}
function footHtml() {
  return `<footer class="foot"><div class="wrap"><a class="brand" href="/" style="font-size:18px">${markSvg(22)}<span>baton</span></a>
<span>Free. No account. Links expire in 7 days.</span><a href="/privacy">Privacy</a><a href="${BRAND.repo}">Open source</a><a href="/#power">For developers</a></div></footer>`;
}
var SITE_CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
function webManifest() {
  return {
    name: "Baton",
    short_name: "Baton",
    description: BRAND.tagline,
    start_url: "/#paste",
    display: "standalone",
    background_color: BRAND.paper,
    theme_color: BRAND.ink,
    icons: [
      { src: "/icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }
    ]
  };
}

// src/relay/ingest.ts
function ingestToBundle(b) {
  let parsed;
  switch (b.source) {
    case "chatgpt-share-html":
      parsed = parseChatGPTShareHtml(String(b.payload), b.url);
      break;
    case "chatgpt-conversation":
      parsed = parseChatGPTConversation(b.payload, { kind: "chatgpt-export", url: b.url });
      parsed.source.tool = "ChatGPT (captured in your browser)";
      break;
    case "claude-conversation": {
      const [c] = parseClaudeExport([b.payload]);
      if (!c) throw new Error("That does not look like a Claude conversation");
      parsed = { ...c, source: { ...c.source, tool: "Claude (captured in your browser)", url: b.url }, loss: (c.loss ?? []).filter((l) => l.category !== "memory") };
      break;
    }
    case "messages":
      parsed = parseMessagesLog(b.payload, "Conversation");
      parsed.source = { ...parsed.source, tool: hostLabel(b.url), url: b.url };
      parsed.loss = [{ category: "dom-capture", count: parsed.events.length, severity: "warn", detail: "Captured from the rendered page: visible text and code only. Tool outputs, files and hidden reasoning are not in the page." }];
      break;
    default:
      throw new Error(`Unknown source ${String(b.source)}`);
  }
  if (!parsed.events.some((e) => e.kind === "message")) throw new Error("No conversation found on that page. Open a chat with at least one message and try again.");
  return buildBundle(parsed).bundle;
}
function pasteToBundle(text2, filename = "") {
  if (!text2.trim()) throw new Error("Paste a conversation first.");
  if (/^\s*https?:\/\/\S+\s*$/.test(text2)) {
    const share = /chatgpt\.com\/share|chat\.openai\.com\/share|claude\.ai\/share|gemini\.google\.com\/share|g\.co\/gemini/i.test(text2);
    throw new Error(share ? "That's a share link, not the chat itself. AI sites block servers from opening share links, so: open the link, select all, copy, and paste here (or click the Baton bookmark on that page)." : "That's a link, not a conversation. Open it, select all, copy, and paste the text here.");
  }
  if (detectFormat(text2, filename).kind !== "unknown") {
    const list = parseAny(text2, filename);
    if (!list.length) throw new Error("That file has no conversations in it.");
    const latest2 = [...list].sort((a, b) => Date.parse(b.source.updatedAt ?? "") - Date.parse(a.source.updatedAt ?? "") || 0)[0];
    return buildBundle(latest2).bundle;
  }
  return buildBundle(parsePastedChat(text2)).bundle;
}
function hostLabel(url) {
  const u = url ? new URL(url) : void 0;
  const h = u?.hostname ?? "";
  if (u?.pathname === "/try") return "Baton practice page (a copy of a ChatGPT chat)";
  if (h.includes("gemini.google")) return "Gemini (captured in your browser)";
  if (h.includes("perplexity")) return "Perplexity (captured in your browser)";
  if (h.includes("copilot")) return "Copilot (captured in your browser)";
  return `${h || "Web chat"} (captured in your browser)`;
}
function captureToIngest(d) {
  if (!d || typeof d !== "object" || typeof d.url !== "string") throw new Error("Nothing was captured.");
  if (d.error) throw new Error(`Could not read the chat: ${d.error}`);
  if (d.chatgpt) return { source: "chatgpt-conversation", payload: d.chatgpt, url: d.url };
  if (d.claude) return { source: "claude-conversation", payload: d.claude, url: d.url };
  if (d.html && /(chatgpt\.com|chat\.openai\.com)\/share\//.test(d.url)) return { source: "chatgpt-share-html", payload: d.html, url: d.url };
  if (d.messages?.length) {
    const title = String(d.title ?? "").replace(/\s*·\s*Baton$/, "").replace(/\s*[-|–—]\s*(Google )?(Gemini|ChatGPT|Claude|Perplexity|Copilot).*$/i, "").trim();
    return { source: "messages", payload: { title: title || void 0, messages: d.messages }, url: d.url };
  }
  throw new Error("No conversation found on that page. Open a chat with at least one message and try again.");
}
function isCapture(x) {
  return !!x && typeof x === "object" && typeof x.url === "string" && !("source" in x);
}
var BOOKMARKLET_VERSION = 2;
var BOOKMARKLET_JS = String.raw`(()=>{const R='__RELAY__',V=__V__,H=location.host,P=location.pathname;
if(window.__batonOpen){window.__batonOpen();return}window.__batonOpen=()=>{};
const d={url:location.href,title:document.title,v:V};let info='';
const dom=()=>{const S=[['user-query','model-response','.query-text','message-content'],['[data-message-author-role="user"]','[data-message-author-role="assistant"]'],['[data-testid="user-message"]','.font-claude-response, .font-claude-message']];
for(const[u,a,ut,at]of S){const all=[...document.querySelectorAll(u+', '+a)],ns=all.filter(n=>!all.some(o=>o!==n&&o.contains(n)));
const m=ns.map(n=>{const U=n.matches(u),sel=U?ut:at,src=(sel&&n.querySelector(sel))||n,c=src.cloneNode(true);c.querySelectorAll('button,svg,[aria-hidden="true"],style,script,.sr-only,.cdk-visually-hidden,.visually-hidden').forEach(x=>x.remove());return{role:U?'user':'assistant',content:(c.innerText||c.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}}).filter(t=>t.content);
if(m.length)return m}return null};
const cap=(async()=>{try{
if(/\/share\//.test(P)&&/chatgpt\.com|openai\.com/.test(H)){d.html=document.documentElement.outerHTML;info='Shared ChatGPT chat, with recoverable files'}
else if(/chatgpt\.com|chat\.openai\.com/.test(H)&&/\/c\//.test(P)){const id=(P.match(/\/c\/([0-9a-f-]{20,})/)||[])[1];const s=await(await fetch('/api/auth/session')).json();const h={authorization:'Bearer '+s.accessToken};const a=(document.cookie.match(/(?:^|; )_account=([^;]+)/)||[])[1];if(a)h['chatgpt-account-id']=decodeURIComponent(a);const r=await fetch('/backend-api/conversation/'+id,{headers:h});if(r.ok){d.chatgpt=await r.json();info='Full conversation, including tool outputs'}else d.messages=dom()}
else if(H==='claude.ai'&&/\/chat\//.test(P)){const id=(P.match(/\/chat\/([0-9a-f-]{20,})/)||[])[1];const o=await(await fetch('/api/organizations')).json();const g=(o.find(x=>(x.capabilities||[]).includes('chat'))||o[0]).uuid;const r=await fetch('/api/organizations/'+g+'/chat_conversations/'+id+'?tree=True&rendering_mode=messages&render_all_tools=true');if(r.ok){d.claude=await r.json();info=(d.claude.chat_messages||[]).length+' messages, including artifacts'}else d.messages=dom()}
else{d.messages=dom()}
if(d.messages&&!info)info=d.messages.length+' messages (visible text)';
if(!d.html&&!d.chatgpt&&!d.claude&&!d.messages)throw new Error('No conversation found on this page')
}catch(e){d.error=String(e&&e.message||e)}})();
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.style.cssText=c;if(x!=null)e.textContent=x;return e};
const NS='http://www.w3.org/2000/svg',S=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e};
const host=E('div','all:initial;position:fixed;top:14px;right:14px;z-index:2147483647'),root=host.attachShadow({mode:'closed'});
const card=E('div','box-sizing:border-box;width:304px;max-width:calc(100vw - 28px);background:#121314;color:#F5F2EA;border-radius:20px;padding:16px 16px 14px;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;box-shadow:0 24px 60px -12px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)');
card.setAttribute('role','dialog');card.setAttribute('aria-label','Baton');
const hd=E('div','display:flex;align-items:center;gap:10px;margin-bottom:12px'),mk=S('svg',{viewBox:'0 0 32 32',width:'26',height:'26'});
mk.append(S('rect',{x:'8.6',y:'12.9',width:'17.4',height:'6.6',rx:'3.3',transform:'rotate(-38 17.3 16.2)',fill:'#FF5A1F'}),S('path',{d:'M6.2 24.6l3.4-2.7M5.6 19.4l2.3-1.8',stroke:'#FF5A1F','stroke-width':'2.1','stroke-linecap':'round',opacity:'.55',fill:'none'}));
const x=E('button','all:unset;cursor:pointer;width:28px;height:28px;border-radius:50%;text-align:center;line-height:28px;color:#9C988F;font-size:20px','×');x.setAttribute('aria-label','Close');
hd.append(mk,E('div','flex:1;font-weight:800;font-size:16px;letter-spacing:-.01em','Continue this chat in'),x);
const grid=E('div','display:grid;gap:8px'),st=E('div','margin-top:12px;color:#9C988F;font-size:12.5px','Reading this chat…');
const here=/claude\.ai$/.test(H)?'claude':/chatgpt\.com|openai\.com/.test(H)?'chatgpt':/gemini\.google/.test(H)?'gemini':'',bs=[];
[['claude','Claude','#D97757'],['chatgpt','ChatGPT','#10A37F'],['gemini','Gemini','#4F7DF3'],['link','Just give me a link','']].forEach(([id,name,dot],i)=>{if(id===here)name+=' (fresh chat)';
const b=E('button','all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;padding:11px 14px;border-radius:12px;border:1px solid #2A2C2F;font-weight:650;font-size:15px;color:#F5F2EA;background:'+(dot?'#1E2022':'transparent'));
if(dot)b.append(E('span','width:10px;height:10px;border-radius:50%;background:'+dot));
b.append(E('span','flex:1',name),E('span','color:#6B675F;font:600 11px ui-monospace,Menlo,monospace;border:1px solid #2A2C2F;border-radius:5px;padding:1px 5px',String(i+1)));bs.push(b);
b.onmouseenter=b.onfocus=()=>b.style.borderColor='#FF5A1F';b.onmouseleave=b.onblur=()=>b.style.borderColor='#2A2C2F';b.onclick=()=>go(id);grid.append(b)});
card.append(hd,grid,st);root.append(card);document.documentElement.append(host);
cap.then(()=>{st.textContent=d.error?'⚠ '+d.error:'✓ '+info+'. Nothing is sent until you choose.'});
const esc=e=>{if(e.key==='Escape')close();else if(/^[1-4]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA/.test((document.activeElement||{}).tagName||'')&&!(document.activeElement||{}).isContentEditable){e.preventDefault();e.stopPropagation();bs[+e.key-1].click()}};setTimeout(()=>bs[0].focus(),30);const close=()=>{host.remove();removeEventListener('keydown',esc,true);window.__batonOpen=null};
addEventListener('keydown',esc,true);x.onclick=close;let busy=0;
const go=async to=>{if(busy)return;busy=1;const N='baton'+Date.now(),w=window.open('about:blank',N);
if(!w){st.textContent='Pop-up blocked. Allow pop-ups for this site, then click again.';busy=0;return}
try{w.document.title='Baton';const b=w.document.body;b.style.cssText='margin:0;height:100vh;display:grid;place-items:center;background:#F5F2EA;color:#121314;font:600 18px -apple-system,"Segoe UI",Inter,Roboto,Arial,sans-serif';b.textContent='Baton is packing your chat…'}catch(_){}
st.textContent='Packing…';await cap;
if(d.error){try{w.close()}catch(_){}st.textContent='⚠ '+d.error;busy=0;return}
d.to=to;const pop=()=>{const f=e=>{if(e.origin===R&&e.data==='baton:ready'){e.source.postMessage(d,R);removeEventListener('message',f)}};addEventListener('message',f);w.location.href=R+'/receive'};
if(/(^|\.)gemini\.google\.com$/.test(H))pop();else{let done=0;const v=e=>{if(!done&&/form-action/.test(e.violatedDirective||e.effectiveDirective)){done=1;pop()}};addEventListener('securitypolicyviolation',v);
const F=E('form','display:none');F.method='POST';F.action=R+'/api/ingest-form';F.target=N;F.acceptCharset='utf-8';const t=E('textarea');t.name='d';t.value=JSON.stringify(d);F.append(t);document.documentElement.append(F);F.submit();F.remove();setTimeout(()=>removeEventListener('securitypolicyviolation',v),5000)}
st.textContent='✓ Opened in a new tab';setTimeout(close,1800)}})()`;
function bookmarkletSource(relayOrigin) {
  const code = BOOKMARKLET_JS.replace("__RELAY__", relayOrigin.replace(/[^A-Za-z0-9:/._-]/g, "")).replace("__V__", String(BOOKMARKLET_VERSION));
  return "javascript:" + encodeURIComponent(code.replace(/\n/g, ""));
}
function receivePage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Baton</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${TOKENS}main{min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center}.spin{width:44px;height:44px;margin:0 auto 18px;animation:sp 1.1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}#st{font:700 20px/1.4 var(--f-display)}#st.err{color:var(--bad)}#sub{margin-top:8px}</style></head>
<body><main><div><div class="spin">${markSvg(44)}</div><p id="st">Packing your chat\u2026</p><p id="sub" class="mu">This takes a second.</p></div></main>
<script>
const st=document.getElementById('st'),sub=document.getElementById('sub');const fail=m=>{st.textContent=m;st.className='err';sub.innerHTML='<a href="/">Back to Baton</a>';document.querySelector('.spin').style.animation='none'};
if(!window.opener){fail('Open this from the Baton bookmark on a ChatGPT, Claude or Gemini chat.')}else{window.opener.postMessage('baton:ready','*')}
addEventListener('message',async e=>{if(e.source!==window.opener||!e.data||typeof e.data!=='object'||typeof e.data.url!=='string')return;
 try{const r=await fetch('/api/ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(e.data)});const j=await r.json();if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  if(!j.next||j.next===j.url)await Promise.race([navigator.clipboard.writeText(j.url).catch(()=>{}),new Promise(r=>setTimeout(r,800))]);location.replace(j.next||j.url)}catch(err){fail(err.message)}});
</script></body></html>`;
}

// src/site/handoff.ts
var CSS2 = `
.hp{padding-top:28px}
.banner{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding:16px 18px;border-radius:var(--r);background:var(--signal-soft);border:1px solid color-mix(in srgb,var(--signal) 35%,transparent);margin-bottom:26px}
.banner b{font-size:17px}.banner .grow{flex:1 1 260px}
.linkbox{display:flex;gap:8px;flex:1 1 100%;min-width:0}
.linkbox input{flex:1;min-width:0;font:600 15px var(--f-mono);padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
.meta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-bottom:12px}
.src{display:inline-flex;align-items:center;gap:8px;font-weight:700}
.src .dot{width:9px;height:9px;border-radius:50%;background:var(--mu)}
h1.t{font-size:clamp(32px,5.6vw,56px);margin-bottom:16px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:26px}
.go{padding:20px}
.go h2{font-size:15px;font-family:var(--f-body);letter-spacing:0;font-weight:700;color:var(--mu);margin-bottom:12px}
.go-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media (max-width:640px){.go-grid{grid-template-columns:1fr}.tabbar label{padding:10px 12px;font-size:14px}.msg{max-width:94%}}
.go-grid .btn{width:100%;min-height:58px;font-size:17px;border-radius:16px}
.go-grid .btn.last{outline:2px solid var(--signal);outline-offset:2px}
.go-more{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.ai-note{font-size:14px;color:var(--mu);margin:16px 2px 30px}
.ai-note a{color:var(--ink-2)}
.tabs{position:relative}
.tabbar{display:flex;gap:4px;padding:4px;background:var(--sunk);border-radius:999px;overflow-x:auto;scrollbar-width:none;margin-bottom:18px}
.tabbar label{flex:1 0 auto;text-align:center;padding:10px 16px;border-radius:999px;font-weight:700;font-size:14.5px;color:var(--mu);cursor:pointer;white-space:nowrap}
.panel{display:none}
#t-conv:checked~.tabbar [for=t-conv],#t-brief:checked~.tabbar [for=t-brief],#t-files:checked~.tabbar [for=t-files],#t-miss:checked~.tabbar [for=t-miss]{background:var(--card);color:var(--ink);box-shadow:var(--shadow)}
#t-conv:checked~.panels .p-conv,#t-brief:checked~.panels .p-brief,#t-files:checked~.panels .p-files,#t-miss:checked~.panels .p-miss{display:block}
#t-conv:focus-visible~.tabbar [for=t-conv],#t-brief:focus-visible~.tabbar [for=t-brief],#t-files:focus-visible~.tabbar [for=t-files],#t-miss:focus-visible~.tabbar [for=t-miss]{outline:3px solid var(--signal)}
.msgs{display:flex;flex-direction:column;gap:14px}
.msg{max-width:88%;padding:14px 16px;border-radius:18px;overflow-wrap:anywhere}
.msg.user{align-self:flex-end;background:var(--ink);color:var(--paper);border-bottom-right-radius:6px;white-space:pre-wrap}
.msg.assistant{align-self:flex-start;background:var(--card);border:1px solid var(--line);border-bottom-left-radius:6px}
.msg .who{font:700 11.5px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:8px}
.msg.assistant p,.msg.assistant ul,.msg.assistant ol,.msg.assistant pre,.msg.assistant table,.msg.assistant blockquote{margin:0 0 10px}
.msg.assistant>div>:last-child{margin-bottom:0}
.msg pre{background:var(--sunk);padding:12px;border-radius:10px;overflow:auto;font:13px/1.5 var(--f-mono);white-space:pre}
.msg code{font:13px var(--f-mono);background:var(--sunk);padding:1px 5px;border-radius:5px}
.msg pre code{background:none;padding:0}
.msg table{border-collapse:collapse;font-size:14px;display:block;overflow:auto}.msg td,.msg th{border:1px solid var(--line);padding:5px 8px}
.msg.clamp>div{max-height:340px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 70%,transparent);mask-image:linear-gradient(#000 70%,transparent)}
.more{all:unset;cursor:pointer;margin-top:8px;font-weight:700;font-size:14px;color:var(--signal)}
.step{align-self:center;font-size:13px;color:var(--mu);display:flex;align-items:center;gap:8px}
.step::before,.step::after{content:"";width:28px;height:1px;background:var(--line)}
.gap{align-self:center;font-size:14px;color:var(--mu);padding:6px 14px;border:1px dashed var(--line);border-radius:999px}
pre.brief{white-space:pre-wrap;font:13.5px/1.6 var(--f-mono);margin:0;padding:20px;overflow-wrap:anywhere}
.list{display:flex;flex-direction:column}
.row{display:flex;align-items:center;gap:12px;padding:13px 18px;border-top:1px solid var(--line)}
.row:first-child{border-top:0}
.row .path{flex:1;min-width:0;font:600 14px var(--f-mono);overflow-wrap:anywhere}
.row .detail{flex:1;min-width:0}
.empty{padding:28px;text-align:center;color:var(--mu)}
.owner{margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;color:var(--mu);font-size:14.5px}
.owner button{all:unset;cursor:pointer;color:var(--bad);font-weight:700;text-decoration:underline;text-underline-offset:3px}
.cta{margin-top:56px;padding:28px;display:flex;flex-wrap:wrap;gap:18px 24px;align-items:center;background:var(--ink);color:var(--paper);border-radius:var(--r-lg)}
.cta h3{font-size:24px}.cta p{color:color-mix(in srgb,var(--paper) 70%,transparent)}.cta .grow{flex:1 1 280px}
`;
var SOURCE_DOT = { chatgpt: "#10A37F", claude: "#D97757", gemini: "#4F7DF3" };
function sourceKey(tool) {
  const t = tool.toLowerCase();
  return t.includes("chatgpt") ? "chatgpt" : t.includes("claude") ? "claude" : t.includes("gemini") ? "gemini" : "";
}
function expiryText(iso) {
  if (!iso) return "Permanent demo";
  const ms = Date.parse(iso) - Date.now();
  const d = Math.floor(ms / 864e5);
  if (d >= 2) return `Expires in ${d} days`;
  const h = Math.max(1, Math.round(ms / 36e5));
  return `Expires in ${plural(h, "hour")}`;
}
function conversationHtml(events) {
  const items = [];
  for (const e of events) {
    if (e.kind === "message" && !e.hidden && (e.role === "user" || e.role === "assistant") && e.text.trim()) {
      items.push({ kind: "msg", e });
    } else if (e.kind === "tool_call" || e.kind === "reasoning") {
      const last = items[items.length - 1];
      const step = last?.kind === "step" ? last : (items.push({ kind: "step", tools: 0, thoughts: 0 }), items[items.length - 1]);
      if (e.kind === "tool_call") step.tools++;
      else step.thoughts++;
    }
  }
  if (!items.some((i) => i.kind === "msg")) return '<div class="empty">No visible messages. See the brief for details.</div>';
  const MAX = 80;
  let shown = items;
  let gap = 0;
  if (items.length > MAX) {
    shown = [...items.slice(0, 12), ...items.slice(items.length - (MAX - 12))];
    gap = items.length - MAX;
  }
  return `<div class="msgs">${shown.map((it, idx) => {
    const g = gap && idx === 12 ? `<div class="gap">${gap} earlier items are in the brief and the full transcript</div>` : "";
    if (it.kind === "step") {
      const parts = [it.tools ? plural(it.tools, "tool step") : "", it.thoughts ? plural(it.thoughts, "reasoning note") : ""].filter(Boolean);
      return `${g}<div class="step">${parts.join(" \xB7 ")}</div>`;
    }
    const e = it.e;
    const long = e.text.length > 1400;
    const text2 = e.text.replace(/\s*\[cite:[^\]]*\]/g, "").replace(/\s*cite[\ue200-\ue2ff][^\s]*/g, "");
    const body = e.role === "user" ? escapeHtml(text2) : markdownToHtml(text2);
    return `${g}<div class="msg ${e.role}${long ? " clamp" : ""}"><div class="who">${e.role === "user" ? "You" : "AI"}</div><div>${body}</div>${long ? '<button class="more" type="button">Show more</button>' : ""}</div>`;
  }).join("")}</div>`;
}
function handoffPage(p) {
  const b = p.bundle;
  const s2 = b.stats;
  const a = s2.artifacts;
  const filesOk = a.recovered + a.attached;
  const lostFiles = a.lost + a.stale;
  const src = sourceKey(b.source.tool);
  const prompt = continuePrompt(b, p.selfUrl);
  const full = copyText(b, p.files, p.selfUrl);
  const q = encodeURIComponent(prompt);
  const brief = aiBrief(b, p.files);
  const losses = b.loss.filter((l) => l.severity !== "info");
  const md = `${p.selfUrl}.md`;
  const hrefFor = { claude: `https://claude.ai/new?q=${q}`, chatgpt: `https://chatgpt.com/?q=${q}`, gemini: "https://gemini.google.com/app" };
  const banner = p.banner === "new" ? `<div class="banner" role="status"><div class="grow"><b>Your handoff link is ready.</b> <span class="mu">Send it anywhere, or pick an AI below.</span></div>
<div class="linkbox"><input id="lnk" readonly value="${escapeHtml(p.selfUrl)}" aria-label="Handoff link"><button class="btn dark sm" type="button" data-copy-link>Copy</button></div>${p.update ? '<div class="mu" style="flex:1 1 100%">Your Baton bookmark is an older version. <a href="/">Drag the new one</a>: it sends chats straight into Claude, ChatGPT or Gemini.</div>' : ""}</div>` : p.banner === "gemini" ? `<div class="banner" role="status"><div class="grow"><b>One more tap for Gemini.</b> <span class="mu">Gemini can't be pre-filled, so Baton copies the whole handoff for you. Then paste it with Ctrl/\u2318 V.</span></div>
<button class="btn primary" type="button" data-dest="gemini"><span class="dot" style="background:#4F7DF3"></span>Copy &amp; open Gemini</button></div>` : "";
  const files = b.artifacts.length ? `<div class="card list">${b.artifacts.map((f) => {
    const chip = f.status === "recovered" || f.status === "attached" ? `<span class="chip ok">${f.status}</span>` : `<span class="chip bad">${f.status}</span>`;
    return `<div class="row"><span class="path">${escapeHtml(f.path)}</span><span class="mu code">${f.bytes ? fmtBytes(f.bytes) : ""}</span>${chip}</div>`;
  }).join("")}</div><p class="mu" style="margin-top:12px">Recovered files are inside the <a href="${escapeHtml(p.selfUrl)}.zip">bundle (.zip)</a> and inlined in the brief.</p>` : '<div class="card empty">No files in this conversation.</div>';
  const missing = losses.length ? `<div class="card list">${losses.map((l) => `<div class="row"><span class="chip ${l.severity === "high" ? "bad" : ""}"><b>${l.count}</b></span><div class="detail"><b>${escapeHtml(l.category.replace(/-/g, " "))}</b><div class="mu">${escapeHtml(l.detail ?? "")}</div></div></div>`).join("")}</div><p class="mu" style="margin-top:12px">Baton never fakes what it couldn't carry. The next AI is told exactly what's missing.</p>` : '<div class="card empty">Nothing known to be missing.</div>';
  const body = `<main class="wrap narrow hp">
${banner}
<article class="brief-first">
<div class="meta"><span class="src"><span class="dot" style="background:${SOURCE_DOT[src] ?? "var(--mu)"}"></span>From ${escapeHtml(b.source.tool)}</span><span class="mu">\xB7</span><span class="mu">${escapeHtml(expiryText(p.expiresAt))}</span></div>
<h1 class="t">${escapeHtml(b.title)}</h1>
<div class="chips"><span class="chip"><b>${s2.userMessages}</b> ${s2.userMessages === 1 ? "prompt" : "prompts"}</span><span class="chip"><b>${s2.assistantMessages}</b> ${s2.assistantMessages === 1 ? "reply" : "replies"}</span>${s2.toolCalls ? `<span class="chip"><b>${s2.toolCalls}</b> tool steps</span>` : ""}${filesOk ? `<span class="chip ok"><b>${filesOk}</b> ${filesOk === 1 ? "file" : "files"}</span>` : ""}${lostFiles ? `<span class="chip bad"><b>${lostFiles}</b> not recoverable</span>` : ""}</div>
<section class="card go" aria-labelledby="go-h"><h2 id="go-h">Continue in</h2>
<div class="go-grid">${DESTINATIONS.map((d) => `<a class="btn" data-dest="${d.id}" href="${escapeHtml(hrefFor[d.id])}" target="_blank" rel="noopener"><span class="dot" style="background:${d.dot}"></span>${d.name}</a>`).join("")}</div>
<div class="go-more"><button class="btn ghost sm" type="button" data-copy-prompt>Copy for any AI</button><button class="btn ghost sm" type="button" data-copy-link>Copy link</button><a class="btn ghost sm" href="${escapeHtml(p.selfUrl)}.zip">Download .zip</a></div></section>
<p class="ai-note">For AI assistants: the complete brief is below and as plain text at <a href="${escapeHtml(md)}">${escapeHtml(md)}</a>.</p>
<div class="tabs">
<input class="sr" type="radio" name="tab" id="t-conv" checked><input class="sr" type="radio" name="tab" id="t-brief"><input class="sr" type="radio" name="tab" id="t-files"><input class="sr" type="radio" name="tab" id="t-miss">
<div class="tabbar" role="presentation"><label for="t-conv">Conversation</label><label for="t-brief">Brief for AI</label><label for="t-files">Files${b.artifacts.length ? ` \xB7 ${b.artifacts.length}` : ""}</label><label for="t-miss">Missing${losses.length ? ` \xB7 ${losses.length}` : ""}</label></div>
<div class="panels">
<section class="panel p-brief" aria-label="Brief for AI"><div class="card"><pre class="brief">${escapeHtml(brief)}</pre></div></section>
<section class="panel p-conv" aria-label="Conversation">${conversationHtml(b.events)}<p class="mu" style="margin-top:18px;text-align:center"><a href="${escapeHtml(p.selfUrl)}/full">Full transcript with tool steps \u2192</a></p></section>
<section class="panel p-files" aria-label="Files">${files}</section>
<section class="panel p-miss" aria-label="What did not transfer">${missing}</section>
</div></div>
</article>
${p.owner ? `<form class="owner" method="post" action="/h/${escapeHtml(p.code)}/delete"><span>You created this link.</span><button type="submit">Delete it now</button></form>` : ""}
<aside class="cta"><div>${markSvg(48)}</div><div class="grow"><h3>Move your own chats.</h3><p>Free, no account. One bookmark works in ChatGPT, Claude and Gemini.</p></div><a class="btn primary" href="/">Get Baton</a></aside>
</main>`;
  const script = `
const P=${JSON.stringify(full).replace(/</g, "\\u003c")},L=${JSON.stringify(p.selfUrl).replace(/</g, "\\u003c")};
let last='';try{last=localStorage.getItem('baton:dest')||''}catch{}
$$('[data-dest]').forEach(el=>{if(el.dataset.dest===last&&el.closest('.go-grid'))el.classList.add('last');el.addEventListener('click',async ev=>{const d=el.dataset.dest;try{localStorage.setItem('baton:dest',d)}catch{}
 if(d==='gemini'){ev.preventDefault();await copy(P);toast('Handoff copied. Paste it into Gemini');window.open('https://gemini.google.com/app','_blank','noopener')}})});
$$('[data-copy-prompt]').forEach(el=>el.onclick=async()=>toast(await copy(P)?'Handoff copied. Paste it into any AI':'Copy blocked. Open the Brief tab and copy from there'));
$$('[data-copy-link]').forEach(el=>el.onclick=async()=>toast(await copy(L)?'Link copied':'Copy blocked'));
$$('.more').forEach(el=>el.onclick=()=>{const m=el.closest('.msg');m.classList.toggle('clamp');el.textContent=m.classList.contains('clamp')?'Show more':'Show less'});
const lnk=$('#lnk');if(lnk){lnk.onfocus=()=>lnk.select();copy(L).then(ok=>ok&&toast('Link copied'))}
if(location.search)history.replaceState(null,'',location.pathname+location.hash);
`;
  return shell({
    title: `${b.title} \xB7 Baton`,
    description: truncate(`A Baton handoff from ${b.source.tool}: ${s2.userMessages} prompts, ${s2.assistantMessages} replies${filesOk ? `, ${filesOk} files` : ""}. Open it to continue in Claude, ChatGPT or Gemini.`, 200),
    body,
    css: CSS2,
    script,
    robots: "noindex",
    head: `<link rel="alternate" type="text/markdown" href="${escapeHtml(md)}">`,
    ogImage: p.ogImage
  });
}

// src/site/home.ts
var CSS3 = `
.hero{padding:56px 0 40px}
.hero .wrap{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
@media (max-width:900px){.hero .wrap{grid-template-columns:1fr;gap:36px}.hero{padding-top:32px}}
.hero h1 em{font-style:normal;color:var(--signal)}
.hero .lede{margin:22px 0 30px}
.get{display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px}
.bm{display:inline-flex;align-items:center;gap:12px;padding:14px 26px 14px 16px;border-radius:999px;background:var(--signal);color:var(--signal-ink);font:800 21px/1 var(--f-display);letter-spacing:-.02em;text-decoration:none;cursor:grab;box-shadow:0 10px 30px -10px color-mix(in srgb,var(--signal) 70%,transparent);transition:transform .15s}
.bm:hover{transform:translateY(-2px) rotate(-1deg)}.bm:active{cursor:grabbing}
.bm svg{border-radius:9px}
.hint{display:flex;align-items:center;gap:10px;margin-top:16px;font-size:15px;color:var(--mu)}
.hint kbd{font:600 12.5px var(--f-mono);padding:3px 7px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--ink-2)}
.hint .arrow{display:inline-block;animation:bob 1.6s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-5px)}}
.only-touch{display:none}
@media (pointer:coarse){.only-touch{display:revert}.only-fine{display:none!important}}
html.touch .only-touch{display:revert}html.touch .only-fine{display:none!important}
html.touch .btn.only-touch{display:inline-flex}@media (pointer:coarse){.btn.only-touch{display:inline-flex}}
.trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:28px;font-size:14px;color:var(--mu)}
.trust span::before{content:"\u2713 ";color:var(--ok);font-weight:800}
/* hero illustration: a chat leaves ChatGPT and lands in Claude as a Baton handoff */
.stage{position:relative;aspect-ratio:1/0.92;max-width:540px;width:100%;justify-self:center}
.win{position:absolute;width:74%;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}
.win .bar{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line);font:700 13px var(--f-body)}
.win .bar i{width:9px;height:9px;border-radius:50%}
.win .body{padding:14px;display:flex;flex-direction:column;gap:9px}
.b{height:11px;border-radius:7px;background:var(--sunk)}
.b.u{align-self:flex-end;width:58%;background:var(--ink);opacity:.85}
.b.s{width:44%}.b.m{width:76%}.b.l{width:90%}
.w1{left:0;top:0;transform:rotate(-3deg)}
.w2{right:0;bottom:0;transform:rotate(2deg);z-index:2}
.ho{display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;background:var(--signal-soft);border:1px solid color-mix(in srgb,var(--signal) 30%,transparent)}
.ho svg{flex:none;border-radius:8px}.ho b{display:block;font-size:13px;line-height:1.25}.ho span{font-size:12px;color:var(--ink-2)}
.ho span em{font-style:normal;font-weight:800;color:var(--signal)}
.w2 .ho,.w2 .b{animation:land 7s ease-in-out infinite both}
.w2 .ho{animation-delay:-3.4s}.w2 .b:nth-child(2){animation-delay:-3.2s}.w2 .b:nth-child(3){animation-delay:-3.05s}.w2 .b:nth-child(4){animation-delay:-2.9s}
@keyframes land{0%,30%{opacity:0;transform:translateY(8px)}40%,94%{opacity:1;transform:none}100%{opacity:0}}
.flying{position:absolute;left:24%;top:30%;width:92px;height:32px;z-index:3;animation:fly 7s cubic-bezier(.55,0,.25,1) -3.4s infinite both}
.flying .cap{width:100%;height:100%;border-radius:999px;background:var(--signal);box-shadow:0 14px 30px -8px color-mix(in srgb,var(--signal) 80%,transparent)}
@keyframes fly{0%,6%{transform:translate(0,0) rotate(-38deg) scale(.8);opacity:0}12%{opacity:1}30%{transform:translate(150px,150px) rotate(-38deg) scale(1);opacity:1}36%,100%{transform:translate(170px,170px) rotate(-38deg) scale(.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.flying{display:none}}
section{padding:76px 0 0}
.sec-h{max-width:720px;margin-bottom:34px}.sec-h p{margin-top:14px;font-size:18px;color:var(--ink-2)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:860px){.steps{grid-template-columns:1fr}}
.step{padding:24px;display:flex;flex-direction:column;gap:12px}
.step .n{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--signal);color:var(--signal-ink);font:800 16px var(--f-display)}
.step p{color:var(--ink-2)}
.mini{margin-top:auto;border-radius:14px;background:var(--sunk);padding:14px;min-height:150px;display:flex;flex-direction:column;justify-content:center;gap:8px}
.mini .barline{height:30px;border-radius:8px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;gap:8px;padding:0 10px;font-size:12.5px;color:var(--mu)}
.mini .pill{display:inline-flex;align-items:center;gap:6px;background:var(--signal);color:var(--signal-ink);border-radius:999px;padding:3px 10px;font-weight:800;font-size:12.5px}
.chooser{background:#121314;color:#F5F2EA;border-radius:14px;padding:12px;display:grid;gap:6px;font-size:13px;font-weight:650}
.chooser .o{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:9px;background:#1E2022;border:1px solid #2A2C2F}
.chooser .o.hl{border-color:#FF5A1F}
.chooser .o i{width:8px;height:8px;border-radius:50%}
.reply{background:var(--card);border:1px solid var(--line);border-radius:14px 14px 14px 4px;padding:12px;font-size:13.5px;color:var(--ink-2)}
.compare{width:100%;border-collapse:separate;border-spacing:0;font-size:15.5px}
.compare th,.compare td{padding:15px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
.compare thead th{font:700 13px var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}
.compare th.us,.compare td.us{background:color-mix(in srgb,var(--signal) 9%,transparent)}
.compare thead th.us{color:var(--signal);border-radius:14px 14px 0 0}
.compare tr:last-child td{border-bottom:0}
.y{color:var(--ok);font-weight:800}.n{color:var(--bad);font-weight:800}.p{color:var(--warn);font-weight:700}
.tablewrap{overflow-x:auto;padding:6px}
.proof{margin-top:16px;font-size:15px;color:var(--mu)}
.where{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:860px){.where{grid-template-columns:1fr}}
.where .card{padding:24px}
.where h3{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.where h3 i{width:12px;height:12px;border-radius:50%}
.where ul{margin:0;padding-left:18px;color:var(--ink-2)}.where li{margin:4px 0}
.also{margin-top:14px;color:var(--mu);font-size:15px}
.paste{padding:26px}
.paste textarea{width:100%;min-height:190px;resize:vertical;font:14.5px/1.55 var(--f-mono);padding:16px;border-radius:14px;border:1.5px dashed var(--line);background:var(--paper);color:var(--ink)}
.paste textarea:focus{outline:none;border-color:var(--signal);border-style:solid}
.paste.drag textarea{border-color:var(--signal);background:var(--signal-soft)}
.paste .row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:14px}
.seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:999px;background:var(--sunk)}
.seg label{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:999px;font-weight:700;font-size:14.5px;color:var(--mu);cursor:pointer}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg input:checked+label{background:var(--card);color:var(--ink);box-shadow:var(--shadow)}
.seg input:focus-visible+label{outline:3px solid var(--signal)}
.seg i{width:9px;height:9px;border-radius:50%}
.paste .grow{flex:1}
.paste .how{margin-top:16px;font-size:14.5px;color:var(--mu)}
.picker{margin-top:14px;display:none;max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:14px}
.picker.on{display:block}
.picker button{all:unset;box-sizing:border-box;display:flex;gap:12px;width:100%;padding:12px 16px;border-top:1px solid var(--line);cursor:pointer;font-weight:600}
.picker button:first-child{border-top:0}.picker button:hover,.picker button:focus-visible{background:var(--sunk)}
.picker small{margin-left:auto;color:var(--mu);font-weight:500}
.err{color:var(--bad);font-weight:600;margin-top:10px;min-height:1.4em}
.priv{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media (max-width:860px){.priv{grid-template-columns:1fr 1fr}}
@media (max-width:520px){.priv{grid-template-columns:1fr}}
.priv .card{padding:20px}.priv b{display:block;font:800 18px var(--f-display);margin-bottom:6px}.priv p{color:var(--ink-2);font-size:15px}
.power{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media (max-width:860px){.power{grid-template-columns:1fr}}
.power .card{padding:22px}.power p{color:var(--ink-2);margin:8px 0 14px;font-size:15px}
.power code{font:13px var(--f-mono);background:var(--sunk);padding:2px 6px;border-radius:6px;overflow-wrap:anywhere}
.faq details{border-top:1px solid var(--line);padding:4px 0}
.faq details:last-child{border-bottom:1px solid var(--line)}
.faq summary{cursor:pointer;list-style:none;padding:16px 0;font:750 18px var(--f-display);display:flex;justify-content:space-between;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-weight:400;font-size:26px;line-height:.8;color:var(--mu)}
.faq details[open] summary::after{content:"\u2013"}
.faq p{padding:0 0 18px;color:var(--ink-2);max-width:68ch}
.final{margin-top:90px;padding:48px 32px;text-align:center;background:var(--ink);color:var(--paper);border-radius:28px}
.final h2{margin-bottom:22px}.final .get{justify-content:center}
.final .mu{color:color-mix(in srgb,var(--paper) 65%,transparent);margin-top:16px}

dialog.sheet{border:0;padding:0;border-radius:24px;max-width:520px;width:calc(100vw - 32px);background:var(--card);color:var(--ink);box-shadow:0 30px 80px -20px rgba(0,0,0,.45)}
dialog.sheet::backdrop{background:rgba(18,19,20,.45);backdrop-filter:blur(3px)}
.sheet .in{padding:26px}
.sheet h2{font-size:28px;margin-bottom:6px}
.sheet .x{all:unset;cursor:pointer;position:absolute;top:14px;right:16px;font-size:24px;color:var(--mu);width:36px;height:36px;text-align:center;line-height:36px;border-radius:50%}
.sheet .x:hover{background:var(--sunk)}
.browser{margin:18px 0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--paper)}
.browser .tabs{height:26px;background:var(--sunk);display:flex;align-items:center;gap:6px;padding:0 10px}
.browser .tabs i{width:8px;height:8px;border-radius:50%;background:var(--line)}
.browser .bar{height:30px;display:flex;align-items:center;gap:8px;padding:0 10px;border-bottom:1px solid var(--line);font-size:11.5px;color:var(--mu);position:relative}
.browser .slot{width:70px;height:20px;border-radius:999px;border:1.5px dashed color-mix(in srgb,var(--signal) 60%,transparent)}
.browser .page{height:120px;position:relative}
.browser .pill{position:absolute;left:50%;top:62px;display:inline-flex;align-items:center;gap:6px;padding:4px 12px 4px 6px;border-radius:999px;background:var(--signal);color:var(--signal-ink);font:800 12.5px var(--f-display);animation:drag 3.2s cubic-bezier(.6,0,.3,1) infinite;box-shadow:0 8px 20px -6px color-mix(in srgb,var(--signal) 80%,transparent)}
@keyframes drag{0%,15%{transform:translate(-50%,0)}55%,85%{transform:translate(-205px,-88px) scale(.92)}100%{transform:translate(-205px,-88px) scale(.92);opacity:0}}
.browser .cursor{position:absolute;left:calc(50% + 18px);top:76px;font-size:18px;animation:cur 3.2s cubic-bezier(.6,0,.3,1) infinite}
@keyframes cur{0%,15%{transform:none}55%,85%{transform:translate(-205px,-88px)}100%{transform:translate(-205px,-88px);opacity:0}}
.sheet ol{margin:0 0 18px;padding-left:22px}.sheet li{margin:7px 0;color:var(--ink-2)}
.sheet kbd{font:600 12.5px var(--f-mono);padding:2px 6px;border-radius:6px;border:1px solid var(--line);background:var(--paper)}
.sheet .acts{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
`;
function homePage(h) {
  const d = h.demo;
  const bm = escapeHtml(h.bookmarklet);
  const bmButton = `<a class="bm only-fine" href="${bm}" title="Drag me to your bookmarks bar" data-bm>${markSvg(34)}Baton</a>`;
  const filesRecovered = d ? d.stats.artifacts.recovered + d.stats.artifacts.attached : 0;
  const filesLost = d ? d.stats.artifacts.lost + d.stats.artifacts.stale : 0;
  const body = `<main>
<section class="hero" id="get" style="padding-top:56px"><div class="wrap">
<div>
<div class="eyebrow">Free \xB7 no account \xB7 works in your browser</div>
<h1 style="margin-top:16px">Move any AI chat to <em>any other AI.</em></h1>
<p class="lede">ChatGPT to Claude, Claude to Gemini, anything to anything. Baton carries your prompts, the answers, the code and files, and tells the next AI exactly what's missing.</p>
<div class="get">${bmButton}<a class="btn primary only-touch" href="#paste">Paste a chat</a><a class="btn ghost" href="/demo">See a live handoff</a></div>
<div class="hint only-fine"><span class="arrow">\u2191</span><span>Drag <b>Baton</b> to your bookmarks bar, then <a href="/try">try it on a practice chat</a>. No bar? Press <kbd data-kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>B</kbd></span></div>
<div class="hint only-touch"><span>On a computer, Baton is one bookmark. On a phone, select all in your AI app, copy, and paste it here.</span></div>
<div class="trust"><span>Nothing to install</span><span>Links expire in 7 days</span><span>Delete anytime</span><span>Open source</span></div>
</div>
<div class="stage" aria-hidden="true">
<div class="win w1"><div class="bar"><i style="background:#10A37F"></i>ChatGPT</div><div class="body"><div class="b u"></div><div class="b l"></div><div class="b m"></div><div class="b u" style="width:40%"></div><div class="b l"></div><div class="b s"></div><div class="b m"></div></div></div>
<div class="win w2"><div class="bar"><i style="background:#D97757"></i>Claude</div><div class="body"><div class="ho">${markSvg(30)}<div><b>Baton handoff from ChatGPT</b><span>${d ? `<em>${d.stats.userMessages}</em> prompts \xB7 <em>${d.stats.toolCalls}</em> tool steps \xB7 <em>${filesRecovered}</em> files` : "prompts \xB7 answers \xB7 files"}</span></div></div><div class="b l"></div><div class="b m"></div><div class="b s"></div></div></div>
<div class="flying"><div class="cap"></div></div>
</div>
</div></section>

<section id="how"><div class="wrap">
<div class="sec-h"><div class="eyebrow">How it works</div><h2 style="margin-top:12px">Three steps. The first one you do once.</h2></div>
<div class="steps">
<div class="card step"><div class="n">1</div><h3>Add Baton to your bookmarks</h3><p>Drag the orange button to your bookmarks bar. No extension, no sign-up, no permissions.</p>
<div class="mini"><div class="barline"><span class="pill">${markSvg(14, { tile: false })}Baton</span><span>Docs</span><span>Mail</span></div><div class="mu" style="font-size:12.5px;text-align:center">Your bookmarks bar</div></div></div>
<div class="card step"><div class="n">2</div><h3>On any chat, click it</h3><p>Pick where to continue. Baton reads the chat with your own signed-in browser and packs it.</p>
<div class="mini"><div class="chooser"><div style="font-weight:800">Continue this chat in</div>${DESTINATIONS.map((x, i) => `<div class="o${i === 0 ? " hl" : ""}"><i style="background:${x.dot}"></i>${x.name}</div>`).join("")}</div></div></div>
<div class="card step"><div class="n">3</div><h3>Keep going</h3><p>The new AI opens with the handoff ready. It reads where you left off and carries on.</p>
<div class="mini"><div class="reply"><b>Got it.</b> We stopped at the deployment step, and your files came across. Picking up from your last request\u2026</div><div class="mu" style="font-size:12px;text-align:center">Example reply</div></div></div>
</div></div></section>

<section><div class="wrap">
<div class="sec-h"><div class="eyebrow">Why not just copy-paste?</div><h2 style="margin-top:12px">Copy-paste and share links leave the important parts behind.</h2></div>
<div class="card tablewrap"><table class="compare">
<thead><tr><th></th><th>Copy-paste</th><th>Share link</th><th class="us">Baton</th></tr></thead>
<tbody>
<tr><td>Your prompts and the replies</td><td class="p">Messy</td><td class="y">Yes</td><td class="us y">Yes, clean</td></tr>
<tr><td>Code and files the AI wrote</td><td class="p">What's on screen</td><td class="n">Dead links</td><td class="us y">Rebuilt from the chat</td></tr>
<tr><td>Tool outputs (code runs, searches)</td><td class="n">No</td><td class="n">Removed</td><td class="us y">Yes, in ChatGPT and Claude</td></tr>
<tr><td>Opens in a <i>different</i> AI</td><td class="p">By hand</td><td class="n">No</td><td class="us y">One click</td></tr>
<tr><td>Tells you what didn't make it</td><td class="n">No</td><td class="n">No</td><td class="us y">Always</td></tr>
</tbody></table></div>
${d ? `<p class="proof">Measured on a real ChatGPT chat (<a href="/demo">open it</a>): the share link carried <b>0 of ${d.lostToolOutputs}</b> tool outputs and only dead file links. Baton recovered <b>${filesRecovered} files</b> and listed the ${filesLost} it couldn't.</p>` : ""}
</div></section>

<section><div class="wrap">
<div class="sec-h"><div class="eyebrow">Where it works</div><h2 style="margin-top:12px">The big three, and almost any chat page.</h2></div>
<div class="where">
<div class="card"><h3><i style="background:#10A37F"></i>ChatGPT</h3><ul><li>Full conversation, including tool outputs and code</li><li>Shared chats, with the files rebuilt</li></ul></div>
<div class="card"><h3><i style="background:#D97757"></i>Claude</h3><ul><li>Full conversation, including artifacts and tool steps</li><li>Projects and long chats</li></ul></div>
<div class="card"><h3><i style="background:#4F7DF3"></i>Gemini</h3><ul><li>Every visible message and code block</li><li>Signed in or not</li></ul></div>
</div>
<p class="also">Also: Perplexity, Copilot, DeepSeek and other chat pages (visible messages), ChatGPT and Claude data exports, and anything you paste.</p>
</div></section>

<section id="paste"><div class="wrap narrow">
<div class="sec-h"><div class="eyebrow">On a phone, or no bookmark?</div><h2 style="margin-top:12px">Paste a chat instead.</h2><p>In your AI app: select all, copy, paste below. Or drop a ChatGPT or Claude export file.</p></div>
<form class="card paste" id="pf" autocomplete="off">
<label class="sr" for="pt">Conversation text</label>
<textarea id="pt" name="text" placeholder="You said:&#10;Help me plan a 3-day trip to Lisbon\u2026&#10;&#10;ChatGPT said:&#10;Here's a plan\u2026" required></textarea>
<div class="picker" id="pick" role="listbox" aria-label="Choose a conversation"></div>
<div class="row"><div class="seg" role="radiogroup" aria-label="Continue in">${[...DESTINATIONS.map((x) => ({ id: x.id, name: x.name, dot: x.dot })), { id: "link", name: "Link", dot: "" }].map((x, i) => `<input type="radio" name="to" id="to-${x.id}" value="${x.id}"${i === 0 ? " checked" : ""}><label for="to-${x.id}">${x.dot ? `<i style="background:${x.dot}"></i>` : ""}${x.name}</label>`).join("")}</div><span class="grow"></span><button class="btn primary" id="pgo" type="submit">Make handoff</button></div>
<p class="err" id="perr" role="alert"></p>
<p class="how">Or drop a <span class="code">conversations.json</span> from a ChatGPT or Claude data export. Exports with many chats let you pick one.</p>
</form>
</div></section>

<section><div class="wrap">
<div class="sec-h"><div class="eyebrow">Privacy</div><h2 style="margin-top:12px">Your chat, your link, your call.</h2></div>
<div class="priv">
<div class="card"><b>Only here</b><p>Your chat goes only to this Baton server, and only after you choose where to send it.</p></div>
<div class="card"><b>Unguessable</b><p>Each link carries a random 60-bit code. Only people you give it to can open it.</p></div>
<div class="card"><b>Gone in 7 days</b><p>Links delete themselves. Delete yours sooner from the browser that made it.</p></div>
<div class="card"><b>No tracking</b><p>No accounts, ads, analytics or cookies beyond the one that lets you delete your link.</p></div>
</div>
<p class="also"><a href="/privacy">Read the full privacy notes \u2192</a></p>
</div></section>

<section id="power"><div class="wrap">
<div class="sec-h"><div class="eyebrow">For power users and developers</div><h2 style="margin-top:12px">Go deeper.</h2></div>
<div class="power">
<div class="card"><h3>Browser extension</h3><p>Captures generated files as real bytes and attaches them in the next AI's composer for you.</p><a class="btn ghost sm" href="${BRAND.repo}/blob/claude/laughing-davinci-c048d8/docs/TESTING.md">Install guide</a></div>
<div class="card"><h3>Connector (MCP)</h3><p>Let a model write its own handoff and another model pick it up by code. Server: <code>${escapeHtml(h.base + h.mcpDisplay)}</code></p><a class="btn ghost sm" href="${BRAND.repo}/blob/claude/laughing-davinci-c048d8/docs/EMBED.md">Set up</a></div>
<div class="card"><h3>CLI and Claude Code</h3><p>Convert exports and share links offline, and snapshot Claude Code sessions before compaction.</p><a class="btn ghost sm" href="${BRAND.repo}">View on GitHub</a></div>
</div></div></section>

<section class="faq"><div class="wrap narrow">
<div class="sec-h"><div class="eyebrow">Questions</div><h2 style="margin-top:12px">Good questions.</h2></div>
<details><summary>Does the other AI need anything installed?</summary><p>No. Baton opens it with a short prompt and a link. Claude, ChatGPT and Gemini can read the link. If an AI can't browse, use "Copy prompt for any AI" on the handoff page, or paste the brief.</p></details>
<details><summary>Why a bookmark and not an app?</summary><p>Your browser can already see your chat, because you're signed in. A bookmark uses exactly that, with no install and no permissions to grant. ChatGPT blocks servers from reading chats but not you.</p></details>
<details><summary>What doesn't transfer?</summary><p>Hidden reasoning, and files that only existed inside the AI's sandbox and were never shown. Baton rebuilds what it can from the chat and lists everything else on the "Missing" tab, so the next AI doesn't assume it exists.</p></details>
<details><summary>Is it really free?</summary><p>Yes. No ads, no selling data, no account. Baton is open source, and you can run your own server with one command.</p></details>
<details><summary>Can I delete a link?</summary><p>Yes. Open it in the browser that created it and click "Delete it now". Every link also expires after 7 days.</p></details>
<details><summary>Does it work on my phone?</summary><p>Yes, by pasting: select all in your AI app, copy, and paste into the box above. Handoff links open on any device.</p></details>
</div></section>

<div class="wrap"><div class="final"><h2>Stop starting over.</h2><div class="get">${bmButton.replace('class="bm only-fine"', 'class="bm only-fine" style="box-shadow:none"')}<a class="btn primary only-touch" href="#paste">Paste a chat</a></div><p class="mu only-fine">Drag the button to your bookmarks bar, then click it on any chat.</p></div></div>
</main>
<dialog class="sheet" id="sheet" aria-labelledby="sheet-h"><div class="in"><button class="x" type="button" data-close aria-label="Close">\xD7</button>
<div class="eyebrow">Add Baton \xB7 10 seconds</div><h2 id="sheet-h" style="margin-top:10px">Drag, don't click.</h2><p class="mu">Baton lives in your bookmarks bar, so it's one click away on any chat.</p>
<div class="browser" aria-hidden="true"><div class="tabs"><i></i><i></i><i></i></div><div class="bar"><span class="slot"></span><span>Docs</span><span>Mail</span></div><div class="page"><span class="pill">${markSvg(16)}Baton</span><span class="cursor">\u270B</span></div></div>
<ol><li>Show your bookmarks bar: <kbd data-kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>B</kbd></li><li>Drag this button up into the bar: <a class="bm" href="${bm}" data-bm title="Drag me to your bookmarks bar" style="font-size:16px;padding:7px 15px 7px 7px;vertical-align:middle">${markSvg(24)}Baton</a></li><li>Open any chat and click it.</li></ol>
<div class="acts"><a class="btn primary" href="/try">Try it on a practice chat</a><button class="btn ghost" type="button" data-close>Done</button></div></div></dialog>
`;
  const script = `
if(!matchMedia('(pointer:fine)').matches&&(navigator.maxTouchPoints>0||'ontouchstart' in window))document.documentElement.classList.add('touch');
const mac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);$$('[data-kbd]').forEach(k=>k.textContent=mac?'\u2318':'Ctrl');
const sheet=$('#sheet');$$('[data-bm]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(sheet.open)toast('Drag it up into your bookmarks bar');else sheet.showModal()}));
$$('[data-close]').forEach(b=>b.onclick=()=>sheet.close());sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
if(new URLSearchParams(location.search).has('deleted')){toast('Deleted. That link no longer works.');history.replaceState(null,'','/')}
const pf=$('#pf'),pt=$('#pt'),perr=$('#perr'),pick=$('#pick'),pgo=$('#pgo');let fileName='';
const send=async(text,name)=>{perr.textContent='';pgo.disabled=true;pgo.textContent='Packing\u2026';
 try{const to=(pf.querySelector('input[name=to]:checked')||{}).value||'link';
  const r=await fetch('/api/paste',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,filename:name||'',to})});
  const j=await r.json();if(!r.ok)throw new Error(j.error||'Something went wrong');location.href=j.next}
 catch(e){perr.textContent=e.message;pgo.disabled=false;pgo.textContent='Make handoff'}};
pf.addEventListener('submit',e=>{e.preventDefault();if(pt.value.trim())send(pt.value,fileName)});
const showPicker=list=>{pick.innerHTML='';list.sort((a,b)=>(b.t||0)-(a.t||0)).forEach(c=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.append(c.title||'Untitled');const s=document.createElement('small');s.textContent=c.t?new Date(c.t*1000).toLocaleDateString():'';b.append(s);b.onclick=()=>send(JSON.stringify([c.raw]),fileName);pick.append(b)});pick.classList.add('on');perr.textContent='This export has '+list.length+' chats. Pick one:'};
const readFile=async f=>{fileName=f.name;if(/\\.zip$/i.test(f.name)){perr.textContent='Unzip the export first, then drop conversations.json.';return}
 if(f.size>200e6){perr.textContent='That file is too large.';return}
 const text=await f.text();
 if(/\\.json$/i.test(f.name)){try{const j=JSON.parse(text);if(Array.isArray(j)&&j.length>1&&(j[0].mapping||j[0].chat_messages)){showPicker(j.map(c=>({raw:c,title:c.title||c.name,t:c.update_time||(c.updated_at?Date.parse(c.updated_at)/1000:0)})));return}}catch{}}
 if(text.length>20e6){perr.textContent='That file is too large to send. Pick a single conversation.';return}
 pt.value=text.length>200000?text.slice(0,200000)+'\\n\u2026':text;pt.dataset.full='1';send(text,f.name)};
['dragenter','dragover'].forEach(t=>pf.addEventListener(t,e=>{e.preventDefault();pf.classList.add('drag')}));
['dragleave','drop'].forEach(t=>pf.addEventListener(t,e=>{e.preventDefault();pf.classList.remove('drag')}));
pf.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)readFile(f)});
`;
  return shell({
    title: "Baton \xB7 Move any AI chat to any other AI",
    description: "Hand a chat from ChatGPT, Claude or Gemini to any other AI in one click, with the prompts, answers, code and files, and a list of anything that did not transfer. Free, no account.",
    body,
    css: CSS3,
    script,
    canonical: h.base + "/",
    head: `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Baton", applicationCategory: "ProductivityApplication", operatingSystem: "Any (web browser)", description: "Move any AI chat to any other AI: ChatGPT, Claude, Gemini.", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, url: h.base + "/" }).replace(/</g, "\\u003c")}</script>`,
    ogImage: h.ogImage
  });
}

// src/site/try.ts
var CSS4 = `
.try{padding-top:28px}
.coach{position:sticky;top:72px;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:12px 18px;padding:16px 18px;border-radius:var(--r);background:var(--ink);color:var(--paper);box-shadow:var(--shadow);margin-bottom:28px}
.coach b{font-size:17px}.coach .grow{flex:1 1 260px}.coach .mu{color:color-mix(in srgb,var(--paper) 65%,transparent)}
.coach .up{font-size:26px;animation:bob 1.4s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-6px)}}
.coach.done{background:var(--ok);color:#fff}.coach.done .up{animation:none}
.bm{display:inline-flex;align-items:center;gap:10px;padding:10px 18px 10px 12px;border-radius:999px;background:var(--signal);color:var(--signal-ink);font:800 17px/1 var(--f-display);text-decoration:none;cursor:grab}
.chatbox{border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);overflow:hidden}
.chatbar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);font-weight:700;font-size:14px}
.chatbar i{width:9px;height:9px;border-radius:50%;background:#10A37F}
.chatbar .mu{font-weight:500;margin-left:auto;font-size:13px}
.turns{display:flex;flex-direction:column;gap:14px;padding:18px}
.turn{max-width:88%;padding:14px 16px;border-radius:18px;overflow-wrap:anywhere}
.turn.user{align-self:flex-end;background:var(--ink);color:var(--paper);border-bottom-right-radius:6px;white-space:pre-wrap}
.turn.assistant{align-self:flex-start;background:var(--sunk);border-bottom-left-radius:6px}
.turn p,.turn ul,.turn ol,.turn pre{margin:0 0 10px}.turn>:last-child{margin-bottom:0}
.turn pre{overflow:auto;font:13px var(--f-mono);background:var(--card);padding:10px;border-radius:10px}
.who{font:700 11.5px/1 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:8px}
.note{margin-top:14px;font-size:14px;color:var(--mu)}
`;
function tryPage(demo, bookmarklet) {
  const turns = (demo?.events ?? []).filter((e) => e.kind === "message" && !e.hidden && (e.role === "user" || e.role === "assistant") && e.text.trim()).slice(0, 4);
  const body = `<main class="wrap narrow try">
<div class="eyebrow">Practice</div><h1 style="margin:12px 0 22px;font-size:clamp(34px,6vw,56px)">Try Baton on this chat.</h1>
<div class="coach" id="coach" role="status"><span class="up" aria-hidden="true">\u2191</span><div class="grow"><b id="coach-t">Click Baton in your bookmarks bar.</b><div class="mu" id="coach-s">Not there yet? Drag this button up first:</div></div><a class="bm" href="${escapeHtml(bookmarklet)}" data-bm>${markSvg(26)}Baton</a></div>
<div class="chatbox"><div class="chatbar"><i></i>${escapeHtml(demo?.title ?? "Sample chat")}<span class="mu">Practice copy</span></div>
<div class="turns">${turns.map((e) => `<div class="turn ${e.role}" data-message-author-role="${e.role}"><div class="who" aria-hidden="true">${e.role === "user" ? "You" : "ChatGPT"}</div>${e.role === "user" ? escapeHtml(e.text) : markdownToHtml(e.text)}</div>`).join("")}</div></div>
<p class="note">These are the first turns of a real ChatGPT chat (the one in the <a href="/demo">live demo</a>), shown here so you can practise without opening a private chat. Anything you send from this page creates a normal handoff link that expires in 7 days.</p>
</main>`;
  const script = `
$$('[data-bm]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();toast('Drag this button to your bookmarks bar, then click it there')}));
const coach=$('#coach');
new MutationObserver(()=>{const host=[...document.documentElement.children].find(el=>el.style&&el.style.zIndex==='2147483647');if(host&&!coach.classList.contains('done')){coach.classList.add('done');$('#coach-t').textContent='It works. That panel is Baton.';$('#coach-s').textContent='Pick an AI to see the whole flow, or press Esc. Then use it on your real chats.';coach.querySelector('.bm').remove();coach.querySelector('.up').textContent='\u2713'}}).observe(document.documentElement,{childList:true});
`;
  return shell({ title: `${demo?.title ?? "Practice"} (practice) \xB7 Baton`, description: "Practise using the Baton bookmark on a sample chat.", body, css: CSS4, script, robots: "noindex" });
}

// src/site/pages.ts
var CSS5 = `.msg-page{padding:72px 0 0}.msg-page h1{font-size:clamp(34px,6vw,56px);margin-bottom:16px}.msg-page .lede{margin-bottom:28px}
.prose{padding:56px 0 0}.prose h1{font-size:clamp(36px,6vw,60px);margin-bottom:12px}.prose h2{font-size:24px;margin:40px 0 10px}.prose p,.prose li{color:var(--ink-2);font-size:17px}.prose p{margin:0 0 12px}.prose ul{padding-left:20px}.prose li{margin:6px 0}.prose code{font:14px var(--f-mono);background:var(--sunk);padding:2px 6px;border-radius:6px}`;
function messagePage(title, text2, action = { href: "/", label: "Back to Baton" }) {
  return shell({
    title: `${title} \xB7 Baton`,
    robots: "noindex",
    css: CSS5,
    body: `<main class="wrap narrow msg-page"><div class="eyebrow">Baton</div><h1 style="margin-top:12px">${escapeHtml(title)}</h1><p class="lede">${escapeHtml(text2)}</p><a class="btn dark" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a></main>`
  });
}
function privacyPage(ttlDays) {
  return shell({
    title: "Privacy \xB7 Baton",
    css: CSS5,
    body: `<main class="wrap narrow prose"><div class="eyebrow">Privacy</div><h1 style="margin-top:12px">What happens to your chat</h1>
<p class="lede">Plain answers, no legalese. Baton is open source, so every claim here can be checked in <a href="${BRAND.repo}">the code</a>.</p>
<h2>When you click the bookmark</h2>
<ul><li>Baton reads the chat in your own browser tab, using the session you're already signed in with. Nothing leaves the page while the chooser is open.</li>
<li>When you pick a destination, the chat is sent to this Baton server, and nowhere else.</li>
<li>The server turns it into a handoff and gives it a random link (<code>BTN-XXXX-XXXX-XXXX</code>, 60 random bits).</li></ul>
<h2>Who can see a handoff</h2>
<ul><li>Anyone who has the link, including the AI you send it to. Links are not listed or indexed (<code>noindex</code>).</li>
<li>Treat a link like the chat itself. Don't share it if the chat holds something you wouldn't share.</li></ul>
<h2>How long it lasts</h2>
<ul><li>Handoffs delete themselves after ${ttlDays} days.</li>
<li>The browser that created a handoff gets one cookie for it, which lets you delete it early with "Delete it now". That cookie is the only one Baton sets.</li></ul>
<h2>What Baton does not do</h2>
<ul><li>No accounts, ads, analytics or third-party scripts. Pages load only from this server.</li>
<li>No selling or training on your chats.</li>
<li>Obvious secrets (API keys, tokens) are redacted from handoffs automatically, but check before sharing.</li></ul>
<h2>Want full control?</h2>
<p>Run your own Baton server for free on Cloudflare with one command. The bookmark then talks only to your server. See <a href="${BRAND.repo}/blob/claude/laughing-davinci-c048d8/docs/DEPLOY.md">the deploy guide</a>.</p>
</main>`
  });
}

// src/site/assets.gen.ts
var ICON_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAALmUlEQVR4nOzdeXCU5R0H8Oc99iQHSUhgQ2ITBQWMUgwqMkLHq9rBGbUiasGj2sujtTPtH46dsTOd6jhTnamO1l46gwOKtNbOtEy1ylFsgYFguMsdkBwkJJB733ff4+mzUNsI+yTvbvbd93l3v59/YZLs7nef5/ecr1peMYkApKISAA6EA7gQDuBCOIAL4QAuhAO4EA7gQjiAC+EALoQDuBAO4EI4gAvhAC6EA7gQDuBCOIAL4QAuhAO4EA7gQjiAC+EALoQDuBAO4EI4gAvhAC6EA7gQDuBCOIAL4QAuhAO4EA7gQjiAC+EALoQDuBAO4EI4gAvhAC6EA7gQDuBCOIAL4QAuhAO4EA7gQjiAC+EALoQDuBAO4EI4gAvhAC6EA7gQDuBCOIAL4ciF8gCZEpKiCmnXaLtO/ALhcEtjibRosjq3VLmyVC5WpZH/1Nxrbe2zdvbbH5+yegwiLAmPDs0u1kg8XBNYUq1OL5Kd/P8VrcYrLcaRYUrEg3Bk0z0x5fkZwfKgo1iM9F67+eN9er9FhIJwZEdlkLzaELq5MvNu+qRmP7Zb33jaJsJQItEogfFpLJXXXBtpKFHIOBSp0r3VaqtGdw+Ikg+EY7y+e5H6+9mhoi+WnJmRJOlrlYo4+UA4MheWya+vCD1ZH5SlLCTjnHP5ODps7xv0vkRFzZGhuoi08qrwjKK0a08nLEpv2aKxsS7xlCuvLe99tVLZMD/iUjIYRZJeawh5/tmgW0mPROgz04IvzgqGlKx1JSlVhqRBi27r9bLxQLeShrIAeXN2eGHFuEYlzvUZdOaGYd27eKBbceryYnnj/EjOksGUBqTbq3L36y6EcDiyJKZ8NC9cHc712/VATYB4BwtvY3v58uAyjz6kBRVKLEg6EsQTaDlGEwtJa+eFl3n69Z1d6tlnhHBwLShPFhlfLvWy12dmFXn2ByAcqT1Vr77XGC4PujtedWJWsWd/A2qO87Ev6m+vDN1aJco7UxZEOMQwLSqtagzXRwVqUE3v5jkQjv9bVKW8fkVogup9VzKSgXB47meXBp+o93JUwqPbni3PIhykIkCWzwlfV+bxqITn4BDC4ZHGUvmtOaEp3q+Acm3r9WxnaUEPZR+tVddcExY5GcxW7xZmC7TlYIskrzaE7oqJ/vLXdZuD3m1JL8Rw1ISldxvD7m3VyaLXj3l55qngwnFDhfLG7BBbDSfCOzRkr+vxcrNPYYXjmWmBH10SJD7x0hGPVmM/VyjhKFEJazBunOSb1/uPHusPHR6fgCuIcFxeLK+cE6qN+GZo1pOg39qpEa/lfziWxJRfNoRCsg+KjHP6Dbq4STstwOn7fA6HQugLM0OPXCTipDjPoEnv2KbtEuPEW96GY3JQemtOeO5EQSfFU2LJuKtJlGSQfA3HvIkyWy6ZJMBWHedahu2ln2oHhgS6qCMPw/FEnfrT6UHFP0UG82GX+Z1d+qBg93PkVTiiCnn9itDtk/30omxKXzhkvNQi4u1P+ROOaVFpxVXh6RP8tJTYZ9BHd+rrewRrMT6XJ+EQcxPX6Pb0W0ub9VZNxNvAzvF9OCRCn50e/MHFvpkUP+fddvOHe/SEuMFI8jIcVUFyyyQlFpaDMtk/aO8esA+lWaufPdmc0/Or45ew6NP79eWtgnYlI3l2yv6mCuUrk87/ULsTdHW7cdLZNa6zS+QVc0K5P786Hu2avaxZ9/xWFoc8uJ+DfZr3V6tXpZqeiirS1ROVA4P2wFjfqzsmK3+6OlLsqyLjkx6LzXEdi4vdl4yQ669dZZA8XhcY/QLXmyvH6CYWx5J7MoivvHI0cVdTXIQVE+dyWnPMLJIWx9TAWNNT0ybIrEUwOV+wb9aqv5gZlCTftBlDJn1st76my0pWz76So3CwMcWtler8cqeVY6lKUl4KvqBcfnGWn9qMQ0P2sk+1w0LeXj2mXISDTVzeVx2oS+eMISsmeozz39CisxOgxD/+2mmyNmPYB+OS1FwPRywkLZ2qlqSzZ5NS2p5qaujnlwVi/hmbPHtAf+2YSfzM3XDMLpbvnKKkuwZ2dJheODs0hYWsxh87M9iA/KFmbUuvP8aro3ArHDKhiyarV6e/nSJh0w9OpfjCfb9Olf1QhDb1Wg82652Cz30640o4WHFwf3WgNqOLDNi8cqee4gc+VOuDZuPNz4yn/61bfhuV8GQ/HFOC5OHaQDT96akBg77dbralqjZuq1IiitDvuG5TtlayusN/49VRZDkcxQp5MKNkHBu2324zNU43PU/s3X4n4jZbX90rzPa+bMlyOL4eUzN4uMSGbnP0o13XlYk7SFnXbT66U+/397gktWyGIyKTi6PpJUOz6Ko28+ioyw1s9DqjWNCW46UjiecP+2pKPB3ZDEd9VEprVpstUb7TZvaN9Z2LCBkMwTdxZUU2w2GlM3xjQ741naaTwl7A6zP2D9r3btdE3sSVFdkMh+asIDNt+v5Jc/cAdVjYi3Yg/v0O88k9upZv1WcK2QxHa9xmje3otxucSdCVbUZXOsfHxVnmNmz6k/2JN07kY/GZSjabbNZH/KVztDfuwKD1q+OJrjQvFhiyktUJ8dpJ3V60VSucZJCsb/Y5OETfaTOMVLcjfnzKXNlm6XYmnQTr44mnNp+xFv4rvr2vAPqSEbK/TbA7kfws7eSzZFgtKfUa9OiQvbLN3D+Og34NxfI13l0F+VqL8e1derywgpHkj8d4zS2VP5wXITk3YhNXIfLH9oimPvtgznuWlmH7xs3xgk0GEfnpkGwBb0G5cm2Z3FiqFKlkwKQLKnK34/XDLvPuJu2kx5dyeUzQE2+3T1auGbHYdvEEmQ2QzyTssqDrTZ1l0+cOJ15uKaBRCY9wLUeJSh6pVWdc8Hgi1qnEreRpaeLmlp/TCbq0WVvt9U1tghCr5bgoIn1jqhrlbN04PEwbNDo1WZi6ko8dfdayZr1Dz/NJcecEajnml8n3xNTgqBtO2XJGfUQKu7DxZ/kJY2mzcNeneEuIoawqkcUxdVaxo3oiKNE7pwQqQ1nLx4hNXPAF3g9lJ6rke19ymgymQ6N3bIv3Gdlp/NnE/C1bUGSk5nE46qPS43WBqnRW5T/T6IEhesPmeNO4H0TyQae5cFM8/7b3ZYuXNcf1ZfLdDo7Onmd9j8Vm6PtM8nabYdHkDsIMjix06/ZTe/XnDhuFsPKeMW/CwYqMJdXqvHIl3fPQR4bstd3//TwpkTadsVe1G6pMZk2QHIaM9UfLW42Hd+g7+jEqGYMHBSkrMpbVqFXpb/Dq1O3fHTdTHhcqVuhDtYHry5S5E+WUE2W9hr3ptP1eh/nnTpQXTuU6HKzIuL9azWAsemDQWt1uOSlDa8Pk0iK5JiyVB6RTiWTJeWjIPuH9NfP+k9NwLCyXb5qUdldCKV3bbW08jeog13I0QxpIFhnKZUVp78nQLbqq3Tziz/st/C4X4SgLkAdqAhncRN6lJ3cJncnbcyGicz0cl0Sl+6rVUPpFxr4B+48dpokmwzvuhoMVGTdXZvIrPjplfoIiw2suhoMtpGWQDM2i77SbLSgyBOBWOOoi0m1Vaf/wTs1e4eCAJOSGW+GYU5r2HBeKDNG4FY4ZaT7a4u9d5j/PoMgQi1vhcD7RhSJDWG6FI25RJ3PkJ7XkTAaKDDG5tZ9j/+DYLcGefus3xw0kQ1huhWN9j5WwuflgyyV/6zJXd1h5c/FeXnJrPwcbdByL05lF8oXbLIYt+laruXcARYboXNzsw/oLNjotUdjaivS/zVrbey1WfnYX9kkyv8jFkj1bkp0aluI2PZ0gBtoL/8jFqqxxtosh4Dd5+yx7GD+EA7gQDuBCOIAL4QAuhAO4EA7gQjiAC+EALoQDuBAO4EI4gAvhAC6EA7gQDuBCOIAL4QAuhAO4EA7gQjiAC+EALoQDuBAO4EI4gAvhAC6EA7gQDuBCOIAL4QAuhAO4EA7gQjiAC+EALoQDuP4DAAD//2b+TnEAAAAGSURBVAMAq27B5vXJsgIAAAAASUVORK5CYII=";
var ICON512_PNG_B64 = "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";
var OG_PNG_B64 = "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";

// src/relay/handler.ts
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
function shareIdFrom(pathname) {
  const m = decodeURIComponent(pathname).match(/^\/(?:https?:\/{1,2})?(?:(?:www\.)?chatgpt\.com|chat\.openai\.com)?\/?share\/([0-9a-f]{8}-[0-9a-f-]{20,})(\.zip|\.md|\/full)?\/?$/i);
  return m ? { id: m[1].toLowerCase(), mode: m[2] ?? "" } : void 0;
}
var hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
var sha256Hex2 = async (s2) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s2)));
var ownerCookieName = (code) => `bo_${code.replace(/-/g, "")}`;
async function newOwner() {
  const key = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { key, hash: await sha256Hex2(key) };
}
function readCookie(req, name) {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([0-9a-f]{32})`));
  return m?.[1];
}
async function isOwner(req, rec) {
  const key = readCookie(req, ownerCookieName(rec.code));
  return !!(key && rec.owner && await sha256Hex2(key) === rec.owner);
}
var SITE_HEADERS = {
  "content-security-policy": SITE_CSP,
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "cross-origin-opener-policy": "same-origin-allow-popups"
};
var OG_PATH = "/og.png";
var CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id"
};
function createRelayHandler(o) {
  const { store } = o;
  const mcpPath = o.mcpSecret ? `/mcp/${o.mcpSecret}` : "/mcp";
  const info = { name: "baton-relay", version: VERSION, instructions: RELAY_INSTRUCTIONS };
  const sessions = /* @__PURE__ */ new Map();
  const hits = /* @__PURE__ */ new Map();
  const limit = o.rateLimitPerMinute ?? 120;
  const log = o.log ?? (() => {
  });
  const demoFacts = o.demo ? { stats: o.demo.stats, title: o.demo.title, lostToolOutputs: o.demo.loss.find((l) => l.category === "tool-outputs")?.count ?? 0 } : void 0;
  const res = (status, body, type = "application/json", extra = {}) => new Response(body, { status, headers: { "content-type": type, "x-content-type-options": "nosniff", ...CORS, ...extra } });
  const json = (status, v, extra = {}) => res(status, JSON.stringify(v), "application/json", extra);
  const authorized = (req) => !o.token || req.headers.get("authorization") === `Bearer ${o.token}`;
  const serveBundle = (bundle, files, selfUrl, mode, url, zipName, page2) => {
    if (mode === ".zip") {
      const prefixed = {};
      for (const [k, v] of Object.entries(files)) prefixed[`${zipName}/${k}`] = v;
      return res(200, zip(prefixed), "application/zip", { "content-disposition": `attachment; filename="${zipName}.baton.zip"` });
    }
    if (mode === ".md" || url.searchParams.get("format") === "md") return res(200, aiBrief(bundle, files), "text/markdown; charset=utf-8", { "cache-control": "no-store" });
    if (mode === "/full") return res(200, String(files["index.html"]), "text/html; charset=utf-8", { "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:", "referrer-policy": "no-referrer" });
    const to = url.searchParams.get("to");
    const banner = to === "gemini" ? "gemini" : url.searchParams.has("new") ? "new" : void 0;
    const html = handoffPage({ bundle, files, selfUrl, code: page2.code, expiresAt: page2.expiresAt, owner: page2.owner, banner, update: url.searchParams.has("upd"), ogImage: page2.base + OG_PATH });
    return res(200, html, "text/html; charset=utf-8", { ...SITE_HEADERS, "cache-control": "no-store" });
  };
  const createOwned = async (bundle, from) => {
    const own = await newOwner();
    const rec = await store.create({ title: bundle.title, from, bundle, owner: own.hash });
    const maxAge = Math.max(60, Math.round((Date.parse(rec.expiresAt) - Date.now()) / 1e3));
    const cookie = `${ownerCookieName(rec.code)}=${own.key}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
    return { rec, cookie };
  };
  const htmlError = (status, title, text2) => res(status, messagePage(title, text2), "text/html; charset=utf-8", { ...SITE_HEADERS, "cache-control": "no-store" });
  return async (req) => {
    const url = new URL(req.url);
    const base = (o.publicUrl ?? url.origin).replace(/\/$/, "");
    const tools = relayTools(store, { publicUrl: base });
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.t > 6e4) hits.set(ip, { n: 1, t: now });
    else if (++h.n > limit) return json(429, { error: "Too many requests" });
    try {
      if (req.method === "OPTIONS") return res(204, null);
      if (url.pathname === "/healthz") return json(200, { ok: true, version: VERSION });
      if (req.method === "GET" && url.pathname === "/favicon.svg") return res(200, FAVICON_SVG, "image/svg+xml", { "cache-control": "public, max-age=86400" });
      if (req.method === "GET" && (url.pathname === "/favicon.ico" || url.pathname === "/icon.png" || url.pathname === "/apple-touch-icon.png")) return res(200, base64ToBytes(ICON_PNG_B64), "image/png", { "cache-control": "public, max-age=86400" });
      if (req.method === "GET" && url.pathname === "/icon-512.png") return res(200, base64ToBytes(ICON512_PNG_B64), "image/png", { "cache-control": "public, max-age=86400" });
      if (req.method === "GET" && url.pathname === "/manifest.webmanifest") return res(200, JSON.stringify(webManifest()), "application/manifest+json", { "cache-control": "public, max-age=86400" });
      if (req.method === "GET" && url.pathname === OG_PATH) return res(200, base64ToBytes(OG_PNG_B64), "image/png", { "cache-control": "public, max-age=86400" });
      if (req.method === "GET" && url.pathname === "/privacy") return res(200, privacyPage(Math.round(store.ttlMs / 864e5)), "text/html; charset=utf-8", SITE_HEADERS);
      if (req.method === "GET" && url.pathname === "/try") return res(200, tryPage(o.demo, bookmarkletSource(base)), "text/html; charset=utf-8", { ...SITE_HEADERS, "cache-control": "no-store" });
      if (req.method === "GET" && url.pathname === "/robots.txt") return res(200, "User-agent: *\nDisallow: /h/\nDisallow: /api/\n", "text/plain");
      const demo = url.pathname.match(/^\/demo(\.zip|\.md|\/full)?\/?$/);
      if (demo && req.method === "GET") {
        if (!o.demo) return htmlError(404, "No demo here", "This Baton server has no demo handoff configured.");
        return serveBundle(o.demo, renderBundleFiles(o.demo), `${base}/demo`, demo[1] ?? "", url, "baton-demo", { code: "demo", base });
      }
      if (url.pathname === mcpPath || url.pathname === mcpPath + "/") {
        if (req.method === "GET") return json(405, { error: "No SSE stream here; POST JSON-RPC instead." }, { allow: "POST, DELETE" });
        if (req.method === "DELETE") {
          sessions.delete(req.headers.get("mcp-session-id") ?? "");
          return res(200, null);
        }
        if (req.method !== "POST") return json(405, { error: "POST only" });
        const body = await req.json();
        const msgs = Array.isArray(body) ? body : [body];
        let sid = req.headers.get("mcp-session-id") ?? "";
        let session = sessions.get(sid);
        if (!session) {
          session = { clientName: (req.headers.get("x-baton-client") ?? req.headers.get("user-agent") ?? "mcp-client").slice(0, 60) };
          if (msgs.some((m) => m.method === "initialize")) {
            sid = crypto.randomUUID();
            sessions.set(sid, session);
            if (sessions.size > 5e3) sessions.delete(sessions.keys().next().value);
          }
        }
        const out = (await Promise.all(msgs.map((m) => handleRpc(m, tools, info, session)))).filter(Boolean);
        const headers = sid && sessions.has(sid) ? { "mcp-session-id": sid } : {};
        log(`mcp ${msgs.map((m) => m.method === "tools/call" ? `tools/call:${m.params?.name}` : m.method).join(",")} from ${session.clientName}`);
        if (!out.length) return res(202, null, "application/json", headers);
        return json(200, Array.isArray(body) ? out : out[0], headers);
      }
      if (url.pathname === "/api/handoffs" && req.method === "POST") {
        if (!authorized(req)) return json(401, { error: "Bearer token required" });
        const text2 = await req.text();
        if (text2.length > store.maxBytes + 1048576) return json(413, { error: "Too large" });
        const b = JSON.parse(text2);
        if (!b.bundle && !b.sealed) return json(400, { error: "Send {bundle} or {sealed}" });
        if (b.bundle && b.bundle.schema !== "baton.bundle/v1") return json(400, { error: "Unsupported bundle schema" });
        const rec = await store.create({ title: b.title ?? b.bundle?.title, from: b.from ?? "api", bundle: b.bundle, sealed: b.sealed });
        log(`upload ${rec.code}${b.sealed ? " (sealed)" : ""}`);
        return json(201, { code: rec.code, expiresAt: rec.expiresAt, url: `${base}/h/${rec.code}` });
      }
      const api = url.pathname.match(/^\/api\/handoffs\/([^/]+)(\/checkpoints)?$/);
      if (api) {
        const code = normaliseCode(decodeURIComponent(api[1]));
        if (!CODE_RE.test(code)) return json(400, { error: "Invalid code" });
        if (api[2] && req.method === "POST") {
          if (!authorized(req)) return json(401, { error: "Bearer token required" });
          const cp = await req.json();
          const text2 = await tools.find((t) => t.name === "baton_checkpoint").run({ ...cp, handoff: code }, { clientName: String(cp.from ?? "api") });
          return json(200, { ok: true, message: text2 });
        }
        const rec = await store.get(code);
        if (!rec) return json(404, { error: "Not found or expired" });
        const { owner: _owner, ...pub } = rec;
        return json(200, pub);
      }
      const del = url.pathname.match(/^\/h\/([^/.]+)\/delete$/);
      if (del && req.method === "POST") {
        const rec = await store.get(decodeURIComponent(del[1]));
        if (!rec) return htmlError(404, "Already gone", "This handoff was deleted or has expired.");
        if (!await isOwner(req, rec)) return htmlError(403, "Not yours to delete", "Only the browser that created this handoff can delete it. It will expire on its own.");
        await store.remove(rec.code);
        log(`delete ${rec.code}`);
        return new Response(null, { status: 303, headers: { location: `${base}/?deleted=1`, "set-cookie": `${ownerCookieName(rec.code)}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`, "cache-control": "no-store" } });
      }
      const view = url.pathname.match(/^\/h\/([^/.]+)(\.zip|\.md|\/full)?\/?$/);
      if (view && req.method === "GET") {
        const rec = await store.get(decodeURIComponent(view[1]));
        if (!rec) return htmlError(404, "This link has expired", "Handoffs delete themselves after a few days, or their creator deleted this one. Ask for a fresh link.");
        if (rec.sealed && !rec.bundle) {
          if (view[2]) return json(400, { error: "Sealed handoffs are decrypted in the browser; open /h/<code>#<key>" });
          return res(200, sealedPage(rec.code, rec.title), "text/html; charset=utf-8", { "cache-control": "no-store", "referrer-policy": "no-referrer" });
        }
        const { bundle, files } = renderRecord(rec);
        return serveBundle(bundle, files, `${base}/h/${rec.code}`, view[2] ?? "", url, rec.code, { code: rec.code, expiresAt: rec.expiresAt, owner: await isOwner(req, rec), base });
      }
      const share = shareIdFrom(url.pathname);
      if (share && req.method === "GET") {
        const { mode, id } = share;
        const cacheKey = `s:${id}`;
        let bundle;
        const cached = url.searchParams.has("refresh") ? null : await store.kv.get(cacheKey);
        if (cached) bundle = JSON.parse(cached);
        else {
          const shareUrl = `https://chatgpt.com/share/${id}`;
          const up = await fetch(shareUrl, { headers: { "user-agent": BROWSER_UA, accept: "text/html", "accept-language": "en-US,en;q=0.9" }, redirect: "follow" });
          const html = await up.text();
          if (!up.ok || !html.includes("streamController.enqueue")) {
            log(`share fetch ${id.slice(0, 8)}\u2026 \u2192 ${up.status}`);
            return htmlError(502, "ChatGPT blocked the server", `ChatGPT answered HTTP ${up.status} when Baton's server asked for this share link. It blocks servers, not people: open the link yourself and click the Baton bookmark, or select all, copy, and paste it on the Baton home page.`);
          }
          bundle = buildBundle(parseChatGPTShareHtml(html, shareUrl)).bundle;
          await store.kv.put(cacheKey, JSON.stringify(bundle), { expirationTtl: 6 * 3600 });
        }
        const files = renderBundleFiles(bundle);
        return serveBundle(bundle, files, `${base}/https://chatgpt.com/share/${id}`, mode, url, id.slice(0, 8), { code: id.slice(0, 8), base });
      }
      if (url.pathname === "/receive" && req.method === "GET") return res(200, receivePage(), "text/html; charset=utf-8", { "cache-control": "no-store", "referrer-policy": "no-referrer" });
      if (url.pathname === "/api/ingest" && req.method === "POST") {
        if (!authorized(req)) return json(401, { error: "Bearer token required" });
        const text2 = await req.text();
        if (text2.length > store.maxBytes) return json(413, { error: "Conversation too large for this relay" });
        const body = JSON.parse(text2);
        const to = isCapture(body) ? body.to : void 0;
        const bundle = ingestToBundle(isCapture(body) ? captureToIngest(body) : body);
        const { rec, cookie } = await createOwned(bundle, "bookmarklet");
        log(`ingest ${rec.code} (${bundle.source.tool}) \u2192 ${to ?? "link"}`);
        const link = `${base}/h/${rec.code}`;
        return json(201, { code: rec.code, url: link, next: continueUrl(to, link, bundle), title: bundle.title, stats: bundle.stats }, { "set-cookie": cookie });
      }
      if (url.pathname === "/api/paste" && req.method === "POST") {
        const text2 = await req.text();
        if (text2.length > store.maxBytes) return json(413, { error: "That is too large for this server. Paste a single conversation." });
        const body = JSON.parse(text2);
        const bundle = pasteToBundle(String(body.text ?? ""), String(body.filename ?? ""));
        const { rec, cookie } = await createOwned(bundle, "paste");
        log(`paste ${rec.code} (${bundle.source.tool}) \u2192 ${body.to ?? "link"}`);
        const link = `${base}/h/${rec.code}`;
        return json(201, { code: rec.code, url: link, next: continueUrl(body.to, link, bundle) }, { "set-cookie": cookie });
      }
      if (url.pathname === "/api/ingest-form" && req.method === "POST") {
        const fail = (status, msg) => htmlError(status, "Baton could not save this chat", `${msg} Nothing was saved. Try again on an open chat, or paste it on the Baton home page.`);
        if (o.token) return fail(401, "This server requires a token, so the bookmark cannot upload to it.");
        const text2 = await req.text();
        if (text2.length > store.maxBytes * 1.5) return fail(413, "This conversation is too large for this server.");
        try {
          const d = JSON.parse(new URLSearchParams(text2).get("d") ?? "null");
          if (!isCapture(d)) return fail(400, "Nothing was captured.");
          const bundle = ingestToBundle(captureToIngest(d));
          const { rec, cookie } = await createOwned(bundle, "bookmarklet");
          log(`ingest-form ${rec.code} (${bundle.source.tool}) \u2192 ${d.to ?? "link"}`);
          const stale = (d.v ?? 1) < BOOKMARKLET_VERSION;
          const location = continueUrl(d.to, `${base}/h/${rec.code}`, bundle) + (stale && !d.to ? "&upd=1" : "");
          return new Response(null, { status: 303, headers: { location, "set-cookie": cookie, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
        } catch (err) {
          return fail(400, err instanceof Error ? err.message : String(err));
        }
      }
      if (url.pathname === "/go" && req.method === "GET") {
        const u = (url.searchParams.get("u") ?? "").trim();
        const sid = u.match(/(?:chatgpt\.com|chat\.openai\.com)\/share\/([0-9a-f-]{20,})/i)?.[1];
        if (sid) return Response.redirect(`${base}/https://chatgpt.com/share/${sid}`, 302);
        const code = normaliseCode(u.replace(/^.*\/h\//, "").split("#")[0]);
        if (CODE_RE.test(code)) return Response.redirect(`${base}/h/${code}${u.includes("#") ? "#" + u.split("#")[1] : ""}`, 302);
        return htmlError(400, "Not recognised", "Paste a Baton link or code (BTN-\u2026), or a ChatGPT share link.");
      }
      if (url.pathname === "/" && req.method === "GET") {
        const html = homePage({ base, bookmarklet: bookmarkletSource(base), mcpDisplay: o.mcpSecret ? "/mcp/<your secret>" : mcpPath, demo: demoFacts, ogImage: base + OG_PATH });
        return res(200, html, "text/html; charset=utf-8", { ...SITE_HEADERS, "cache-control": "public, max-age=300" });
      }
      if (req.method === "GET" && (req.headers.get("accept") ?? "").includes("text/html")) return htmlError(404, "Nothing here", "That page does not exist.");
      return json(404, { error: "Not found" });
    } catch (err) {
      return json(400, { error: err instanceof Error ? err.message : String(err) });
    }
  };
}
function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>:root{--bg:#f3f5f4;--fg:#14201b;--mu:#5b6b64;--ac:#2343c9}@media (prefers-color-scheme:dark){:root{--bg:#0f1513;--fg:#e4ebe7;--mu:#9aaba3;--ac:#8ea4ff}}
body{background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:32px 16px}h1{font-size:34px;margin:0 0 8px}code,pre{font:13px ui-monospace,monospace}pre{background:color-mix(in srgb,var(--fg) 6%,transparent);padding:12px;border-radius:6px;overflow:auto;white-space:pre-wrap}a{color:var(--ac)}.mu{color:var(--mu)}button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid var(--fg);background:none;color:var(--fg);cursor:pointer}</style></head><body>${body}</body></html>`;
}
function sealedPage(code, title) {
  return page(
    `Baton \xB7 ${title}`,
    `<h1>${escapeHtml(title)}</h1><p class="mu">End-to-end encrypted handoff <code>${escapeHtml(code)}</code>. It is decrypted here in your browser. The server never had the key.</p>
<div id="out"><p>Decrypting\u2026</p></div>
<script>(async()=>{const out=document.getElementById('out');const key=location.hash.slice(1);if(!key){out.innerHTML='<p>This link is missing its #key part. Ask the sender for the full link.</p>';return}
try{const r=await fetch('/api/handoffs/${code}');const rec=await r.json();const b=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));const kb=b(key.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((key.length+3)%4));
const k=await crypto.subtle.importKey('raw',kb,'AES-GCM',false,['decrypt']);const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b(rec.sealed.iv)},k,b(rec.sealed.data));
const p=JSON.parse(new TextDecoder().decode(pt));const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
out.innerHTML='<p><button id="cp">Copy paste-ready prompt</button> <button id="dl">Download bundle (.zip)</button></p><h2>HANDOFF.md</h2><pre>'+esc(p.handoff)+'</pre>';
document.getElementById('cp').onclick=()=>navigator.clipboard.writeText(p.prompt);
document.getElementById('dl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([b(p.zip)],{type:'application/zip'}));a.download='${code}.baton.zip';a.click()};
}catch(e){out.innerHTML='<p>Could not decrypt this handoff (wrong key or damaged data).</p>'}})();</script>`
  );
}

// src/relay/server.ts
async function toRequest(req, origin) {
  const chunks = [];
  if (req.method !== "GET" && req.method !== "HEAD") for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  if (!headers.has("x-forwarded-for") && req.socket.remoteAddress) headers.set("x-forwarded-for", req.socket.remoteAddress);
  return new Request(origin + (req.url ?? "/"), { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : void 0 });
}
function createRelayServer(o = {}) {
  const store = o.store ?? new RelayStore();
  const handler = createRelayHandler({
    store,
    publicUrl: o.publicUrl ?? process.env.BATON_PUBLIC_URL,
    token: o.token ?? process.env.BATON_RELAY_TOKEN,
    mcpSecret: o.mcpSecret ?? process.env.BATON_MCP_SECRET,
    rateLimitPerMinute: o.rateLimitPerMinute,
    log: o.log,
    demo: loadDemo()
  });
  const mcpPath = o.mcpSecret ?? process.env.BATON_MCP_SECRET ? `/mcp/${o.mcpSecret ?? process.env.BATON_MCP_SECRET}` : "/mcp";
  const server = createServer(async (req, res) => {
    try {
      const proto = String(req.headers["x-forwarded-proto"] ?? "http").split(",")[0];
      const response = await handler(await toRequest(req, `${proto}://${req.headers.host ?? "localhost"}`));
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });
  const timer = setInterval(() => void store.purgeExpired(), 36e5);
  timer.unref();
  server.on("close", () => clearInterval(timer));
  return { server, store, mcpPath };
}
function startRelay(o = {}) {
  const { server, mcpPath } = createRelayServer(o);
  const port = o.port ?? Number(process.env.PORT ?? 8787);
  return new Promise((resolve4) => {
    server.listen(port, o.host ?? "0.0.0.0", () => {
      const addr = server.address();
      const actual = typeof addr === "object" && addr ? addr.port : port;
      const url = `http://localhost:${actual}`;
      (o.log ?? console.error)(`Baton relay ${VERSION} listening on ${url} \xB7 MCP at ${url}${mcpPath}`);
      resolve4({ url, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
function loadDemo() {
  for (const rel of ["../../examples/cricket-stumping/bundle.json", "../examples/cricket-stumping/bundle.json"]) {
    try {
      return JSON.parse(readFileSync3(new URL(rel, import.meta.url), "utf8"));
    } catch {
    }
  }
  return void 0;
}

// src/cli.ts
var HELP = `baton ${VERSION}: hand off AI work between tools, not just chat text

USAGE
  baton import <source> [options]     Convert a conversation into a handoff bundle
  baton session [latest|<id>]         Bundle a Claude Code session from this project
  baton inspect <source>              Show what would transfer (and what would not), write nothing
  baton verify <bundle>               Recompute the integrity hash chain of a bundle dir / zip
  baton sink <bundle> --to <system>   Build (and optionally --post) a Salesforce/Jira/Zendesk/Slack payload
  baton mcp                           Run as an MCP server over stdio (file tools + relay tools)

EMBED IN AIs (capture from within)
  baton relay [--port 8787]           Run the relay hub: MCP for ChatGPT/Claude connectors, REST, viewer
  baton send <bundle|source> [--relay URL] [--seal]   Upload a bundle; prints a pickup code (sealed = end-to-end encrypted)
  baton pickup <code> [--relay URL] [-o dir]          Receive a handoff from any AI or teammate
  baton hook                          Claude Code hook entry (PreCompact/SessionEnd): auto-bundle into .baton/sessions/

SOURCES
  https://chatgpt.com/share/<id>      public ChatGPT share link (fetched once, no login)
  share.html                          a ChatGPT share page saved from the browser
  export.zip | conversations.json     ChatGPT or Claude account data export
  session.jsonl | <dir>               Claude Code session log (dir \u2192 newest .jsonl)
  messages.json                       [{role, content}] chat log

OPTIONS
  -o, --out <dir>          output directory (default: ./handoffs/<slug>)
  --zip                    also write <out>.zip
  --pick <id|text>         choose conversation(s) from a multi-conversation export
  --sink <a,b>             add sinks/<system>.json payloads (${SINKS.join(", ")})
  --install-skill          also copy the bundle into .claude/skills/<continue-\u2026>/ for Claude Code
  --redact <a,b>           also redact these terms (names, client codenames\u2026)
  --redact-file <path>     \u2026 or terms listed one per line in a file
  --no-redact              keep emails, keys and tokens (default: redact)
  --include-hidden         keep private context (system prompts, memory, harness notes)
  --keep-source            store the raw input under source/
  --json                   machine-readable output
  --post                   (sink) send the payload using credentials from env
  --jira-project <KEY>     (sink) Jira project key
  --sf-parent <recordId>   (sink) attach to an existing Salesforce record

Docs: docs/SPEC.md \xB7 https://github.com/nimb-ou/App`;
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  const valued = /* @__PURE__ */ new Set(["o", "out", "pick", "sink", "to", "jira-project", "sf-parent", "now", "redact", "redact-file", "relay", "port", "token", "store", "public-url"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      out._.push(...argv.slice(i + 1));
      break;
    }
    const m = a.match(/^--?([^=]+)(?:=(.*))?$/);
    if (m && a !== "-") {
      const key = m[1];
      if (m[2] !== void 0) out.flags[key] = m[2];
      else if (valued.has(key) && i + 1 < argv.length) out.flags[key] = argv[++i];
      else out.flags[key] = true;
    } else out._.push(a);
  }
  return out;
}
var str = (v) => typeof v === "string" ? v : void 0;
function summarize(c, outDir) {
  const b = c.bundle;
  const s2 = b.stats;
  const lines = [
    `\u2713 ${b.title}`,
    `  source   ${b.source.tool} (${b.source.kind})${b.source.url ? ` ${b.source.url}` : ""}`,
    `  content  ${s2.userMessages} prompts \xB7 ${s2.assistantMessages} replies \xB7 ${s2.reasoningBlocks} reasoning \xB7 ${s2.toolCalls} tool calls`,
    `  files    ${s2.artifacts.recovered} recovered \xB7 ${s2.artifacts.stale} stale \xB7 ${s2.artifacts.lost} lost${s2.artifacts.attached ? ` \xB7 ${s2.artifacts.attached} attached` : ""}`
  ];
  const high = b.loss.filter((l) => l.severity === "high");
  if (high.length) lines.push(`  loss     ${high.map((l) => `${l.count} ${l.category}`).join(" \xB7 ")} (see LOSS_AUDIT.md)`);
  const red = Object.values(b.redaction.counts).reduce((x, y) => x + y, 0);
  if (red) lines.push(`  redacted ${red} secret/PII match(es)`);
  lines.push(`  root     ${b.integrity.root}`);
  if (outDir) lines.push(`  \u2192 ${outDir}/HANDOFF.md  (start here)`);
  return lines.join("\n");
}
async function cmdImport(source, a, fromSession = false) {
  if (!source) throw new Error("Missing <source>. Run `baton help`.");
  const input = fromSession ? await loadInput(findSession(source)) : await loadInput(source);
  const sinks = (str(a.flags.sink) ?? "").split(",").filter(Boolean);
  for (const s2 of sinks) if (!SINKS.includes(s2)) throw new Error(`Unknown sink "${s2}". Choose from ${SINKS.join(", ")}`);
  const results = convert(input.text, input.filename, {
    url: input.url,
    pick: str(a.flags.pick),
    redact: a.flags["no-redact"] !== true,
    redactTerms: [...(str(a.flags.redact) ?? "").split(","), ...str(a.flags["redact-file"]) ? readFileSync4(str(a.flags["redact-file"]), "utf8").split("\n") : []].filter((t) => t.trim()),
    includeHidden: a.flags["include-hidden"] === true,
    keepSource: a.flags["keep-source"] === true,
    sinks,
    sinkOptions: { jiraProject: str(a.flags["jira-project"]), salesforceParentId: str(a.flags["sf-parent"]) },
    now: str(a.flags.now)
  });
  const base = str(a.flags.o) ?? str(a.flags.out);
  const report = [];
  for (const r of results) {
    const outDir = results.length === 1 && base ? base : join4(base ?? "handoffs", r.slug);
    writeFiles(outDir, r.files);
    if (a.flags.zip) writeZip(`${outDir.replace(/\/$/, "")}.zip`, r.files, r.slug);
    let skillDir;
    if (a.flags["install-skill"]) {
      skillDir = join4(".claude", "skills", skillName(r.bundle));
      mkdirSync3(skillDir, { recursive: true });
      cpSync(outDir, skillDir, { recursive: true });
    }
    if (a.flags.json) report.push({ out: resolve3(outDir), skillDir, id: r.bundle.id, title: r.bundle.title, stats: r.bundle.stats, loss: r.bundle.loss, root: r.bundle.integrity.root });
    else {
      console.log(summarize(r, outDir));
      if (skillDir) console.log(`  skill    installed at ${skillDir}/SKILL.md`);
    }
  }
  if (a.flags.json) console.log(JSON.stringify(report.length === 1 ? report[0] : report, null, 2));
  else if (results.length > 1) console.log(`
${results.length} conversations written under ${base ?? "handoffs"}/`);
}
async function cmdInspect(source, a) {
  if (!source) throw new Error("Missing <source>");
  const input = await loadInput(source);
  const fmt = detectFormat(input.text, input.filename);
  const results = convert(input.text, input.filename, { url: input.url, pick: str(a.flags.pick), html: false });
  if (a.flags.json) {
    console.log(JSON.stringify({ format: fmt, conversations: results.map((r) => ({ id: r.bundle.id, title: r.bundle.title, stats: r.bundle.stats, loss: r.bundle.loss, artifacts: r.bundle.artifacts.map(({ content: _c, ...rest }) => rest) })) }, null, 2));
    return;
  }
  console.log(`format: ${fmt.kind} (${fmt.reason})
`);
  for (const r of results) {
    console.log(summarize(r));
    for (const l of r.bundle.loss) console.log(`    [${l.severity}] ${l.category} \xD7${l.count}: ${l.detail}`);
    console.log("");
  }
}
function loadBundle2(path) {
  const raw = readBundleFiles(path);
  if (!raw["bundle.json"]) throw new Error(`${path}: no bundle.json found`);
  const bundle = JSON.parse(String(raw["bundle.json"]));
  const files = {};
  for (const [k, v] of Object.entries(raw)) if (k.startsWith("files/")) files[k.slice(6)] = v;
  return { bundle, files };
}
function cmdVerify(path, a) {
  if (!path) throw new Error("Missing <bundle>");
  const { bundle, files } = loadBundle2(path);
  const r = verifyBundle(bundle, files);
  if (a.flags.json) console.log(JSON.stringify(r, null, 2));
  else if (r.ok) console.log(`\u2713 intact: ${bundle.events.length} events, ${bundle.artifacts.length} artifacts, root ${r.root}`);
  else {
    console.log(`\u2717 MODIFIED: expected root ${r.expectedRoot}
            computed root ${r.root}`);
    if (r.firstBadEvent) console.log(`  first altered event: ${r.firstBadEvent}`);
    if (r.badArtifacts.length) console.log(`  altered files: ${r.badArtifacts.join(", ")}`);
  }
  return r.ok ? 0 : 2;
}
async function cmdSink(path, a) {
  if (!path) throw new Error("Missing <bundle>");
  const to = str(a.flags.to);
  if (!to || !SINKS.includes(to)) throw new Error(`--to must be one of ${SINKS.join(", ")}`);
  const { bundle } = loadBundle2(path);
  const payload = buildSink(to, bundle, { jiraProject: str(a.flags["jira-project"]), salesforceParentId: str(a.flags["sf-parent"]) });
  if (!a.flags.post) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const r = await postSink(payload);
  console.log(`${r.ok ? "\u2713" : "\u2717"} ${to}: HTTP ${r.status} ${r.url}
${r.response}`);
  if (!r.ok) process.exitCode = 1;
}
var relayUrl = (a) => str(a.flags.relay) ?? process.env.BATON_RELAY_URL;
async function cmdSend(source, a) {
  if (!source) throw new Error("Missing <bundle dir | source>");
  let bundle;
  let files;
  if (existsSync3(join4(source, "bundle.json"))) {
    const raw = readBundleFiles(source);
    bundle = JSON.parse(String(raw["bundle.json"]));
    files = raw;
  } else {
    const input = await loadInput(source);
    const [r] = convert(input.text, input.filename, { url: input.url, pick: str(a.flags.pick) });
    bundle = r.bundle;
    files = r.files;
  }
  const res = await sendBundle(bundle, files, { relay: relayUrl(a), token: str(a.flags.token) ?? process.env.BATON_RELAY_TOKEN, sealed: a.flags.seal === true });
  if (a.flags.json) return console.log(JSON.stringify(res, null, 2));
  console.log(`\u2713 sent "${bundle.title}"${res.sealed ? " (end-to-end encrypted)" : ""}`);
  console.log(`  pickup   ${res.link}`);
  console.log(`  in another AI: "baton pickup ${res.sealed ? res.link : res.code}"  \xB7  terminal: baton pickup ${res.sealed ? `"${res.link}"` : res.code}${relayUrl(a) ? "" : "  (local store)"}`);
}
async function cmdPickup(code, a) {
  if (!code) throw new Error("Missing <code>");
  const r = await pickup(code, { relay: relayUrl(a) });
  const out = str(a.flags.o) ?? str(a.flags.out) ?? join4("handoffs", r.code);
  writeFiles(out, r.files);
  console.log(`\u2713 picked up "${r.title}" (${r.code})
  \u2192 ${out}/HANDOFF.md  (start here)`);
}
async function cmdHook() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const h = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!h.transcript_path || !existsSync3(h.transcript_path)) return;
  const input = await loadInput(h.transcript_path);
  const [r] = convert(input.text, input.filename, {});
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").slice(0, 13);
  const dir = join4(h.cwd ?? process.cwd(), ".baton", "sessions", `${stamp}-${(h.hook_event_name ?? "hook").toLowerCase()}-${(h.session_id ?? r.bundle.id).slice(0, 8)}`);
  writeFiles(dir, r.files);
  let sent = "";
  if (process.env.BATON_AUTO_SEND === "1") {
    const res = await sendBundle(r.bundle, r.files, { relay: process.env.BATON_RELAY_URL, token: process.env.BATON_RELAY_TOKEN, from: "claude-code-hook" });
    sent = ` \xB7 pickup ${res.link}`;
  }
  console.error(`baton: saved ${h.hook_event_name ?? "session"} snapshot \u2192 ${dir}${sent}`);
}
async function main(argv) {
  const a = parseArgs(argv);
  const [cmd, arg] = a._;
  if (a.flags.version || a.flags.v) {
    console.log(VERSION);
    return 0;
  }
  switch (cmd) {
    case "import":
      await cmdImport(arg, a);
      return 0;
    case "session":
      await cmdImport(arg ?? "latest", a, true);
      return 0;
    case "inspect":
      await cmdInspect(arg, a);
      return 0;
    case "verify":
      return cmdVerify(arg, a);
    case "sink":
      await cmdSink(arg, a);
      return process.exitCode === 1 ? 1 : 0;
    case "mcp":
      await startMcpServer();
      return 0;
    case "relay":
      await startRelay({ port: Number(str(a.flags.port) ?? process.env.PORT ?? 8787), store: new RelayStore({ dir: str(a.flags.store) }), publicUrl: str(a.flags["public-url"]), token: str(a.flags.token), log: (m) => console.error(m) });
      return 0;
    case "send":
      await cmdSend(arg, a);
      return 0;
    case "pickup":
      await cmdPickup(arg, a);
      return 0;
    case "hook":
      await cmdHook();
      return 0;
    case void 0:
    case "help":
      console.log(HELP);
      return 0;
    default:
      if (/^https?:\/\//.test(cmd) || existsSync3(cmd)) {
        await cmdImport(cmd, a);
        return 0;
      }
      console.error(`Unknown command: ${cmd}
`);
      console.log(HELP);
      return 1;
  }
}

// src/bin.ts
main(process.argv.slice(2)).then(
  (code) => {
    if (code) process.exitCode = code;
  },
  (err) => {
    console.error(`baton: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
);
