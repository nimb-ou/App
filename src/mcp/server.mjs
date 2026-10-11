#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { importConversation, renderAuditMarkdown, renderConversationMarkdown, renderHandoffMarkdown } from "../core/normalize.js";

const serverInfo = { name: "baton", version: "0.1.0" };
const tools = [{
  name: "baton_import",
  description: "Import a saved AI conversation or public share-page HTML into a local-first handoff bundle. The original input is retained and missing source data is reported in a loss audit.",
  inputSchema: { type: "object", properties: { source_path: { type: "string", description: "Path to an exported JSON, JSONL, HTML, Markdown, or text file." }, output_dir: { type: "string", description: "Optional directory where the bundle files should be written." } }, required: ["source_path"] },
}];

async function importFile(sourcePath, outputDir) {
  const bytes = new Uint8Array(await readFile(sourcePath));
  const decoded = sourcePath.toLowerCase().endsWith(".gz") ? gunzipSync(bytes) : bytes;
  const name = basename(sourcePath).replace(/\.gz$/i, "");
  const bundle = importConversation({ text: new TextDecoder().decode(decoded), name });
  const entries = [
    ["bundle.json", JSON.stringify(bundle, null, 2) + "\n"],
    ["HANDOFF.md", renderHandoffMarkdown(bundle) + "\n"],
    ["conversation.md", renderConversationMarkdown(bundle) + "\n"],
    ["loss-audit.md", renderAuditMarkdown(bundle) + "\n"],
    [`source/${name}`, bytes],
  ];
  for (const file of bundle.recoveredFiles) entries.push([`recovered/${file.path}`, file.content]);
  const manifest = entries.map(([path, data]) => ({ path, sha256: createHash("sha256").update(data).digest("hex") }));
  entries.push(["manifest.json", JSON.stringify({ format: "baton.manifest", version: "1.0.0", files: manifest }, null, 2) + "\n"]);
  if (outputDir) {
    const root = resolve(outputDir);
    for (const [path, data] of entries) {
      const target = resolve(root, path);
      if (!target.startsWith(root + "/")) throw new Error("Unsafe bundle path.");
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    }
  }
  return { bundle, entries };
}

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
async function handle(request) {
  const { id, method, params = {} } = request;
  if (method === "initialize") return { jsonrpc: "2.0", id, result: { protocolVersion: params.protocolVersion ?? "2024-11-05", capabilities: { tools: {} }, serverInfo } };
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (method === "tools/call") {
    if (params.name !== "baton_import") throw new Error(`Unknown tool: ${params.name}`);
    const { bundle } = await importFile(params.arguments?.source_path, params.arguments?.output_dir);
    return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: renderHandoffMarkdown(bundle) }], structuredContent: { title: bundle.title, format: bundle.source.kind, messages: bundle.messages.length, auditFindings: bundle.lossAudit, recoveredFiles: bundle.recoveredFiles.map(({ path, status }) => ({ path, status })) } } };
  }
  if (method === "resources/list") return { jsonrpc: "2.0", id, result: { resources: [] } };
  if (method === "prompts/list") return { jsonrpc: "2.0", id, result: { prompts: [] } };
  if (id !== undefined) return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  return null;
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  if (!line.trim()) continue;
  let request;
  try {
    request = JSON.parse(line);
    const result = await handle(request);
    if (result) send(result);
  } catch (error) {
    send({ jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32000, message: error?.message ?? "Baton import failed." } });
  }
}
