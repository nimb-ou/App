#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { importConversation, renderAuditMarkdown, renderConversationMarkdown, renderHandoffMarkdown } from "../src/core/normalize.js";
import { buildZip } from "../src/core/zip.js";

const usage = `Baton — carry AI work between tools with its gaps made visible.

Usage:
  node bin/baton.mjs import <file-or-public-url> [--out <path>] [--zip]

Inputs: ChatGPT share-page HTML, ChatGPT conversations.json, Claude export JSON,
Claude Code JSONL, Markdown, or plain text. Parsing happens locally; public URLs
are fetched by this command and then kept in the bundle as the original source.
`;

function safeName(value) {
  return value.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "conversation";
}

function sourceName(input, url) {
  if (url) return safeName(decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "share.html"));
  return safeName(basename(input));
}

async function loadSource(input) {
  if (/^https?:\/\//i.test(input)) {
    const response = await fetch(input, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Source fetch failed: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, url: response.url, name: sourceName(input, response.url), text: new TextDecoder().decode(bytes) };
  }
  const bytes = new Uint8Array(await readFile(input));
  const name = sourceName(input, null);
  const decoded = extname(input).toLowerCase() === ".gz" ? gunzipSync(bytes) : bytes;
  return { bytes, url: null, name, text: new TextDecoder().decode(decoded) };
}

function bundleEntries(bundle, source) {
  const sourcePath = `source/${source.name}`;
  bundle.source.keptAs = sourcePath;
  const entries = [
    { path: "bundle.json", data: JSON.stringify(bundle, null, 2) + "\n" },
    { path: "HANDOFF.md", data: renderHandoffMarkdown(bundle) + "\n" },
    { path: "conversation.md", data: renderConversationMarkdown(bundle) + "\n" },
    { path: "loss-audit.md", data: renderAuditMarkdown(bundle) + "\n" },
    { path: sourcePath, data: source.bytes },
  ];
  for (const file of bundle.recoveredFiles) entries.push({ path: `recovered/${file.path}`, data: file.content });
  const hashes = entries.map((entry) => ({ path: entry.path, sha256: createHash("sha256").update(entry.data).digest("hex") }));
  entries.push({ path: "manifest.json", data: JSON.stringify({ format: "baton.manifest", version: "1.0.0", files: hashes }, null, 2) + "\n" });
  return entries;
}

async function writeDirectory(output, entries) {
  const root = resolve(output);
  for (const entry of entries) {
    const target = resolve(root, entry.path);
    if (!target.startsWith(root + "/")) throw new Error(`Unsafe output path: ${entry.path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, entry.data);
  }
  return root;
}

async function main(args) {
  if (!args.length || args.includes("--help") || args[0] === "help") { process.stdout.write(usage); return; }
  if (args[0] !== "import" || !args[1]) throw new Error(usage);
  const input = args[1];
  let output = null;
  let zip = false;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--zip") zip = true;
    else if (args[i] === "--out" && args[i + 1]) output = args[++i];
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  const source = await loadSource(input);
  const bundle = importConversation({ text: source.text, name: source.name, sourceUrl: source.url });
  const entries = bundleEntries(bundle, source);
  const defaultName = safeName(bundle.title) + (zip ? ".zip" : "-baton");
  output ??= defaultName;
  if (zip || output.toLowerCase().endsWith(".zip")) {
    const target = resolve(output);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buildZip(entries));
    process.stdout.write(`Bundle created: ${target}\nVisible messages: ${bundle.messages.length}\nAudit findings: ${bundle.lossAudit.length}\nRecovered files: ${bundle.recoveredFiles.length}\n`);
  } else {
    const target = await writeDirectory(output, entries);
    process.stdout.write(`Bundle created: ${target}\nVisible messages: ${bundle.messages.length}\nAudit findings: ${bundle.lossAudit.length}\nRecovered files: ${bundle.recoveredFiles.length}\n`);
  }
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`baton: ${error.message}\n`);
  process.exitCode = 1;
});
