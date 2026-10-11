// Minimal MCP server (JSON-RPC 2.0 over stdio, newline-delimited). No SDK dependency.
// Exposes Baton to any MCP client: Claude Code, Claude Desktop, Cursor, ChatGPT developer mode, etc.

import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { verifyBundle } from '../core/integrity.ts';
import type { BatonBundle } from '../core/schema.ts';
import { VERSION } from '../core/schema.ts';
import { truncate } from '../core/util.ts';
import { findSession, loadInput, readBundleFiles, writeFiles } from '../node/io.ts';
import { postSink } from '../node/post.ts';
import { convert } from '../pipeline.ts';
import { renderTranscript } from '../render/markdown.ts';
import { splitTurns } from '../render/turns.ts';
import { buildSink, SINKS, type SinkName } from '../sinks/index.ts';
import { handleRpc, type McpSession, type Tool } from './protocol.ts';
import { RelayStore } from '../relay/store.ts';
import { RELAY_INSTRUCTIONS, relayTools, remoteRelayTools } from '../relay/tools.ts';

const s = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

function loadBundle(path: string): { bundle: BatonBundle; files: Record<string, string | Uint8Array> } {
  const raw = readBundleFiles(path);
  if (!raw['bundle.json']) throw new Error(`${path}: no bundle.json`);
  const files: Record<string, string | Uint8Array> = {};
  for (const [k, v] of Object.entries(raw)) if (k.startsWith('files/')) files[k.slice(6)] = v;
  return { bundle: JSON.parse(String(raw['bundle.json'])) as BatonBundle, files };
}

async function importAndWrite(text: string, filename: string, url: string | undefined, args: Record<string, unknown>): Promise<string> {
  const results = convert(text, filename, { url, redact: args.redact !== false, pick: s(args.pick) });
  const out: string[] = [];
  for (const r of results) {
    const dir = resolve(results.length === 1 && s(args.out_dir) ? (args.out_dir as string) : join(s(args.out_dir) ?? 'handoffs', r.slug));
    writeFiles(dir, r.files);
    const b = r.bundle;
    out.push(
      `Bundle written to ${dir}`,
      `files: ${b.stats.artifacts.recovered} recovered · ${b.stats.artifacts.stale} stale · ${b.stats.artifacts.lost} lost · root ${b.integrity.root}`,
      '',
      args.include_handoff === false ? '' : truncate(String(r.files['HANDOFF.md']), 24000),
    );
  }
  return out.join('\n');
}

const FILE_TOOLS: Tool[] = [
  {
    name: 'baton_import',
    description:
      'Import an AI conversation (ChatGPT share link, saved share page, ChatGPT/Claude export zip or conversations.json, Claude Code .jsonl, or [{role,content}] log) and write a handoff bundle: HANDOFF.md (start here), TRANSCRIPT.md, LOSS_AUDIT.md, recovered files/, replay/, SKILL.md. Returns the HANDOFF.md text so you can continue the work immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'https://chatgpt.com/share/<id> URL, or a local file/dir path' },
        out_dir: { type: 'string', description: 'Output directory (default ./handoffs/<slug>)' },
        pick: { type: 'string', description: 'Conversation id or title substring for multi-conversation exports' },
        redact: { type: 'boolean', description: 'Redact secrets and PII (default true)' },
        include_handoff: { type: 'boolean', description: 'Return HANDOFF.md text in the result (default true)' },
      },
      required: ['source'],
    },
    run: async (args) => {
      const input = await loadInput(String(args.source));
      return importAndWrite(input.text, input.filename, input.url, args);
    },
  },
  {
    name: 'baton_session',
    description: 'Bundle a Claude Code session (this project by default) into a handoff, so another agent, teammate or tool can continue it.',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'string', description: '"latest" (default) or a session id' },
        cwd: { type: 'string', description: 'Project directory whose sessions to search (default: server cwd)' },
        out_dir: { type: 'string' },
        include_handoff: { type: 'boolean' },
      },
    },
    run: async (args) => {
      const path = findSession(s(args.session) ?? 'latest', s(args.cwd) ?? process.cwd());
      const input = await loadInput(path);
      return importAndWrite(input.text, input.filename, undefined, args);
    },
  },
  {
    name: 'baton_inspect',
    description: 'Dry run: report what a source contains and what would NOT transfer (loss audit, file recovery status) without writing anything.',
    inputSchema: { type: 'object', properties: { source: { type: 'string' }, pick: { type: 'string' } }, required: ['source'] },
    run: async (args) => {
      const input = await loadInput(String(args.source));
      const results = convert(input.text, input.filename, { url: input.url, pick: s(args.pick), html: false });
      return JSON.stringify(
        results.map((r) => ({ id: r.bundle.id, title: r.bundle.title, source: r.bundle.source, stats: r.bundle.stats, loss: r.bundle.loss, artifacts: r.bundle.artifacts.map(({ content: _c, ...rest }) => rest) })),
        null,
        2,
      );
    },
  },
  {
    name: 'baton_read_turn',
    description: 'Read one turn of a bundle transcript (user prompt + reasoning + tool calls + replies). Use instead of loading the whole TRANSCRIPT.md.',
    inputSchema: { type: 'object', properties: { bundle: { type: 'string', description: 'Bundle directory, bundle.json or .zip' }, turn: { type: 'integer', minimum: 1 } }, required: ['bundle', 'turn'] },
    run: async (args) => {
      const { bundle } = loadBundle(String(args.bundle));
      const turns = splitTurns(bundle.events).filter((t) => t.prompt);
      const t = turns[Number(args.turn) - 1];
      if (!t) return `Turn ${String(args.turn)} not found; bundle has ${turns.length} turns.`;
      const md = renderTranscript({ ...bundle, events: [t.prompt!, ...t.events] });
      return truncate(md, 60000);
    },
  },
  {
    name: 'baton_verify',
    description: 'Verify a bundle has not been altered (recomputes the SHA-256 hash chain over events and recovered files).',
    inputSchema: { type: 'object', properties: { bundle: { type: 'string' } }, required: ['bundle'] },
    run: async (args) => {
      const { bundle, files } = loadBundle(String(args.bundle));
      return JSON.stringify(verifyBundle(bundle, files), null, 2);
    },
  },
  {
    name: 'baton_sink',
    description: `Build a payload that files the handoff into a business system (${SINKS.join(', ')}). With post=true, sends it using credentials from the server's environment.`,
    inputSchema: {
      type: 'object',
      properties: { bundle: { type: 'string' }, to: { type: 'string', enum: SINKS }, post: { type: 'boolean' }, jira_project: { type: 'string' }, salesforce_parent_id: { type: 'string' } },
      required: ['bundle', 'to'],
    },
    run: async (args) => {
      const { bundle } = loadBundle(String(args.bundle));
      const payload = buildSink(String(args.to) as SinkName, bundle, { jiraProject: s(args.jira_project), salesforceParentId: s(args.salesforce_parent_id) });
      if (args.post !== true) return JSON.stringify(payload, null, 2);
      return JSON.stringify(await postSink(payload), null, 2);
    },
  },
];

type Json = Record<string, unknown>;

/** Local tools (files, sessions, sinks) + relay tools (local ~/.baton/store, or a remote hub via BATON_RELAY_URL). */
export function localTools(): Tool[] {
  const relay = process.env.BATON_RELAY_URL
    ? remoteRelayTools(process.env.BATON_RELAY_URL, process.env.BATON_RELAY_TOKEN)
    : relayTools(new RelayStore(), { allowList: true, publicUrl: process.env.BATON_PUBLIC_URL });
  return [...FILE_TOOLS, ...relay];
}

const INFO = {
  name: 'baton',
  version: VERSION,
  instructions: `${RELAY_INSTRUCTIONS}\nFor files on disk (ChatGPT share links, exports, Claude Code sessions) use baton_import / baton_session and read the returned HANDOFF.md. Respect the loss audit: lost files do not exist.`,
};

let cachedTools: Tool[] | undefined;
const stdioSession: McpSession = { clientName: 'mcp-client' };

export async function handleMessage(msg: Json, session: McpSession = stdioSession): Promise<Json | undefined> {
  cachedTools ??= localTools();
  return handleRpc(msg, cachedTools, INFO, session);
}

export async function startMcpServer(): Promise<void> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const write = (m: Json) => process.stdout.write(JSON.stringify(m) + '\n');
  for await (const line of rl) {
    if (!line.trim()) continue;
    let msg: Json;
    try {
      msg = JSON.parse(line) as Json;
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }
    const res = await handleMessage(msg);
    if (res) write(res);
  }
}
