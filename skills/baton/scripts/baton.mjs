#!/usr/bin/env node

// src/cli.ts
import { cpSync, existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync3 } from "node:fs";
import { join as join4, resolve as resolve3 } from "node:path";

// src/core/schema.ts
var SCHEMA_ID = "baton.bundle/v1";
var VERSION = "0.3.0";

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
import { createServer } from "node:http";

// src/relay/handler.ts
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
  const res = (status, body, type = "application/json", extra = {}) => new Response(body, { status, headers: { "content-type": type, "x-content-type-options": "nosniff", ...CORS, ...extra } });
  const json = (status, v, extra = {}) => res(status, JSON.stringify(v), "application/json", extra);
  const authorized = (req) => !o.token || req.headers.get("authorization") === `Bearer ${o.token}`;
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
        return json(200, rec);
      }
      const view = url.pathname.match(/^\/h\/([^/.]+)(\.zip)?$/);
      if (view && req.method === "GET") {
        const rec = await store.get(decodeURIComponent(view[1]));
        if (!rec) return res(404, page("Not found", "<p>This handoff does not exist or has expired.</p>"), "text/html; charset=utf-8");
        if (rec.sealed && !rec.bundle) {
          if (view[2]) return json(400, { error: "Sealed handoffs are decrypted in the browser; open /h/<code>#<key>" });
          return res(200, sealedPage(rec.code, rec.title), "text/html; charset=utf-8", { "cache-control": "no-store", "referrer-policy": "no-referrer" });
        }
        const { files } = renderRecord(rec);
        if (view[2]) {
          const prefixed = {};
          for (const [k, v] of Object.entries(files)) prefixed[`${rec.code}/${k}`] = v;
          return res(200, zip(prefixed), "application/zip", { "content-disposition": `attachment; filename="${rec.code}.baton.zip"` });
        }
        return res(200, String(files["index.html"]), "text/html; charset=utf-8", { "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:", "referrer-policy": "no-referrer" });
      }
      if (url.pathname === "/" && req.method === "GET") return res(200, page("Baton relay", landing(base, mcpPath)), "text/html; charset=utf-8");
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
function landing(base, mcpPath) {
  const mcp = base + mcpPath;
  return `<h1>Baton relay</h1><p class="mu">Hands AI work from one assistant to another (prompts, files, tool outputs and decisions) from inside the assistants.</p>
<h2>Add it to an AI</h2><p><b>MCP server URL:</b></p><pre>${escapeHtml(mcp)}</pre>
<ul><li><b>ChatGPT</b>: Settings \u2192 Apps &amp; Connectors \u2192 Advanced settings \u2192 turn on Developer mode \u2192 Create. Paste the URL, choose "No authentication".</li>
<li><b>Claude</b> (web/desktop): Settings \u2192 Connectors \u2192 Add custom connector \u2192 paste the URL.</li>
<li><b>Claude Code</b>: <code>claude mcp add --transport http baton ${escapeHtml(mcp)}</code></li>
<li><b>Cursor / Codex / Gemini CLI</b>: add an HTTP MCP server with this URL.</li>
<li><b>Baton browser extension</b>: Options \u2192 Relay URL: <code>${escapeHtml(base)}</code></li></ul>
<h2>Use it</h2><p>In any AI: <i>"baton: hand this off"</i> \u2192 you get a code like <code>BTN-7F3K-9QXA-2M4P</code>. In another AI: <i>"baton pickup BTN-7F3K-9QXA-2M4P"</i>. Or open <code>${escapeHtml(base)}/h/&lt;code&gt;</code>.</p>`;
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
    log: o.log
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
    redactTerms: [...(str(a.flags.redact) ?? "").split(","), ...str(a.flags["redact-file"]) ? readFileSync3(str(a.flags["redact-file"]), "utf8").split("\n") : []].filter((t) => t.trim()),
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
