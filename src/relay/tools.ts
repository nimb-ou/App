// MCP tools that embed Baton inside any AI: the model checkpoints its own work and picks up work from other AIs.
// Used by the remote HTTP relay (ChatGPT / claude.ai connectors) and the local stdio server (Claude Desktop,
// Claude Code, Cursor, Codex, Gemini CLI), so AIs on one machine share ~/.baton/store with no server at all.

import { truncate } from '../core/util.ts';
import type { Tool, ToolContext } from '../mcp/protocol.ts';
import type { Checkpoint } from './checkpoint.ts';
import { renderRecord } from './checkpoint.ts';
import type { AsyncRelayStore } from './kvstore.ts';

export const RELAY_INSTRUCTIONS = `Baton moves work between AIs. When the user says "baton", "hand this off", "send this to <another AI>", "save my progress", or before a long task risks losing context, call baton_checkpoint.
Put in EVERYTHING the next AI needs and a share link would lose: the user's prompts verbatim, the FULL contents of files you created or edited (not summaries), outputs of code/tools you ran, decisions with reasons, and next steps.
Give the user the pickup code. To continue work from another AI, call baton_pickup with the code the user gives you, then read the handoff and confirm the latest instruction before acting.`;

const fileSchema = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'File path as used in the work, e.g. src/app.py or /mnt/data/report.md' },
    content: { type: 'string', description: 'Complete file content, verbatim. Never a summary.' },
    encoding: { type: 'string', enum: ['utf8', 'base64'], description: 'base64 only for binary files' },
  },
  required: ['path', 'content'],
};

export interface RelayToolOptions {
  publicUrl?: string; // e.g. https://relay.example.com, used for viewer links
  allowList?: boolean; // expose baton_list (local stores only)
}

function pickupHint(code: string, opts: RelayToolOptions): string {
  return [
    `Pickup code: ${code}`,
    opts.publicUrl ? `Viewer: ${opts.publicUrl.replace(/\/$/, '')}/h/${code}` : '',
    `To continue in another AI: tell it "baton pickup ${code}" (with the Baton connector enabled), or run \`baton pickup ${code}\` in a terminal.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function relayTools(store: AsyncRelayStore, opts: RelayToolOptions = {}): Tool[] {
  const tools: Tool[] = [
    {
      name: 'baton_checkpoint',
      title: 'Hand off / save progress',
      description:
        'Save the current state of this work to Baton so another AI, teammate or later session can continue it. Creates a new handoff (returns a pickup code) or, with `handoff`, adds a checkpoint to an existing one. Include full file contents, tool/code outputs and verbatim user prompts: this is what share links and exports drop.',
      inputSchema: {
        type: 'object',
        properties: {
          handoff: { type: 'string', description: 'Existing pickup code to add to (omit to create a new handoff)' },
          title: { type: 'string', description: 'Short name for the work' },
          goal: { type: 'string', description: "The user's overall goal" },
          state: { type: 'string', description: 'Where the work stands right now: what is done, what is in progress, what is blocked' },
          decisions: { type: 'array', items: { type: 'string' }, description: 'Decisions made, each with its reason' },
          next_steps: { type: 'array', items: { type: 'string' } },
          open_questions: { type: 'array', items: { type: 'string' } },
          user_prompts: { type: 'array', items: { type: 'string' }, description: "The user's prompts in this conversation, verbatim, oldest first" },
          files: { type: 'array', items: fileSchema, description: 'Every file created or modified, with complete content' },
          tool_outputs: {
            type: 'array',
            items: { type: 'object', properties: { tool: { type: 'string' }, input: { type: 'string' }, output: { type: 'string' } }, required: ['tool', 'output'] },
            description: 'Important outputs of code runs, searches or other tools (the source UI often hides these)',
          },
          notes: { type: 'string' },
        },
        required: ['state'],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      run: async (a: Record<string, unknown>, ctx: ToolContext) => {
        const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map((x) => (typeof x === 'string' ? x : JSON.stringify(x))) : undefined);
        const cp: Omit<Checkpoint, 'seq' | 'at'> = {
          from: ctx.clientName || 'mcp-client',
          title: typeof a.title === 'string' ? a.title : undefined,
          goal: typeof a.goal === 'string' ? a.goal : undefined,
          state: String(a.state ?? ''),
          decisions: arr(a.decisions),
          next_steps: arr(a.next_steps),
          open_questions: arr(a.open_questions),
          user_prompts: arr(a.user_prompts),
          files: Array.isArray(a.files) ? (a.files as Checkpoint['files']) : undefined,
          tool_outputs: Array.isArray(a.tool_outputs) ? (a.tool_outputs as Checkpoint['tool_outputs']) : undefined,
          notes: typeof a.notes === 'string' ? a.notes : undefined,
        };
        if (!cp.state.trim()) throw new Error('`state` is required: describe where the work stands');
        const target = typeof a.handoff === 'string' && a.handoff ? a.handoff : (await store.create({ title: cp.title, from: cp.from })).code;
        const rec = await store.addCheckpoint(target, cp);
        const { bundle } = renderRecord(rec);
        return [
          `Saved checkpoint ${rec.checkpoints.length} of "${rec.title}".`,
          `Captured: ${bundle.stats.userMessages} prompt(s), ${bundle.stats.artifacts.recovered} file(s), ${bundle.stats.toolResults} tool output(s). Expires ${rec.expiresAt.slice(0, 10)}.`,
          pickupHint(rec.code, opts),
        ].join('\n');
      },
    },
    {
      name: 'baton_pickup',
      title: 'Continue work from another AI',
      description:
        'Load a Baton handoff by its pickup code (BTN-XXXX-XXXX-XXXX) and return its HANDOFF brief: goal, verbatim prompts, state, decisions, next steps, files and what did not transfer. Small text files are included inline; fetch others with baton_get_file.',
      inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Pickup code, e.g. BTN-7F3K-9QXA-2M4P' } }, required: ['code'] },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async (a) => {
        const rec = await store.get(String(a.code));
        if (!rec) throw new Error(`No handoff found for ${String(a.code)}. It may have expired; ask the user for the current code.`);
        if (rec.sealed && !rec.bundle) return `Handoff ${rec.code} is end-to-end encrypted. Open it with its full link (including the #key part) in a browser, or run \`baton pickup "<code>#<key>"\`.`;
        const { bundle, files } = renderRecord(rec);
        let budget = 40000;
        const inline: string[] = [];
        for (const art of bundle.artifacts) {
          if (art.content === undefined || art.encoding === 'base64') continue;
          if (art.content.length > budget) break;
          budget -= art.content.length;
          inline.push(`--- files/${art.path} ---\n${art.content}`);
        }
        const rest = bundle.artifacts.filter((x) => x.content !== undefined).length - inline.length;
        return [
          truncate(String(files['HANDOFF.md']), 30000),
          inline.length ? `\n## File contents\n\n${inline.join('\n\n')}` : '',
          rest > 0 ? `\n(${rest} more file(s): call baton_get_file with code ${rec.code} and a path from §6.)` : '',
        ].join('\n');
      },
    },
    {
      name: 'baton_get_file',
      title: 'Get a file from a handoff',
      description: 'Return one file from a Baton handoff (path as listed in its HANDOFF §6, with or without the files/ prefix).',
      inputSchema: { type: 'object', properties: { code: { type: 'string' }, path: { type: 'string' } }, required: ['code', 'path'] },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async (a) => {
        const rec = await store.get(String(a.code));
        if (!rec) throw new Error(`No handoff found for ${String(a.code)}`);
        const { bundle } = renderRecord(rec);
        const want = String(a.path).replace(/^files\//, '');
        const art = bundle.artifacts.find((x) => x.path === want) ?? bundle.artifacts.find((x) => x.path.endsWith(want));
        if (!art) throw new Error(`No file ${want}. Files: ${bundle.artifacts.map((x) => x.path).join(', ')}`);
        if (art.content === undefined) return `files/${art.path} is ${art.status}: ${art.note ?? 'content not available'}`;
        return art.encoding === 'base64' ? `files/${art.path} is binary (${art.bytes} bytes, ${art.mimeType ?? 'unknown type'}), base64:\n${art.content}` : art.content;
      },
    },
  ];
  if (opts.allowList) {
    tools.push({
      name: 'baton_list',
      title: 'List recent handoffs',
      description: 'List recent handoffs in this Baton store (newest first) with their pickup codes.',
      inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } } },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async (a) => {
        const list = await store.list(Number(a.limit ?? 20));
        if (!list.length) return 'No handoffs yet.';
        return list.map((r) => `${r.code}  ${r.updatedAt.slice(0, 16).replace('T', ' ')}  ${r.title}  (from ${r.from.join(', ')}, ${r.checkpoints.length} checkpoint(s)${r.bundle ? ', captured bundle' : ''}${r.sealed ? ', encrypted' : ''})`).join('\n');
      },
    });
  }
  return tools;
}

/** Same tool names, forwarded to a remote relay (BATON_RELAY_URL), so local agents and web AIs share one hub. */
export function remoteRelayTools(url: string, token?: string): Tool[] {
  const call = async (name: string, args: Record<string, unknown>, ctx: ToolContext) => {
    const res = await fetch(url.replace(/\/$/, '') + (url.includes('/mcp') ? '' : '/mcp'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}), 'x-baton-client': ctx.clientName },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    if (!res.ok) throw new Error(`Relay ${url} answered HTTP ${res.status}`);
    const msg = (await res.json()) as { result?: { content?: { text: string }[]; isError?: boolean }; error?: { message: string } };
    if (msg.error) throw new Error(msg.error.message);
    const text = msg.result?.content?.map((c) => c.text).join('\n') ?? '';
    if (msg.result?.isError) throw new Error(text.replace(/^Error: /, ''));
    return text;
  };
  const local = relayTools({} as AsyncRelayStore, {});
  return local.map((t) => ({ ...t, run: (args, ctx) => call(t.name, args, ctx) }));
}
