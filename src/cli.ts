// baton: carry AI work between tools, people and systems. Entry point: src/bin.ts

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { verifyBundle } from './core/integrity.ts';
import type { BatonBundle } from './core/schema.ts';
import { VERSION } from './core/schema.ts';
import { detectFormat } from './parsers/detect.ts';
import { convert, type ConvertedBundle } from './pipeline.ts';
import { skillName } from './render/handoff.ts';
import { buildSink, SINKS, type SinkName } from './sinks/index.ts';
import { findSession, loadInput, readBundleFiles, writeFiles, writeZip } from './node/io.ts';
import { postSink } from './node/post.ts';
import { startMcpServer } from './mcp/server.ts';
import { pickup, sendBundle } from './relay/client.ts';
import { startRelay } from './relay/server.ts';
import { RelayStore } from './relay/store.ts';
import type { FileMap } from './core/zip.ts';

const HELP = `baton ${VERSION}: hand off AI work between tools, not just chat text

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
  session.jsonl | <dir>               Claude Code session log (dir → newest .jsonl)
  messages.json                       [{role, content}] chat log

OPTIONS
  -o, --out <dir>          output directory (default: ./handoffs/<slug>)
  --zip                    also write <out>.zip
  --pick <id|text>         choose conversation(s) from a multi-conversation export
  --sink <a,b>             add sinks/<system>.json payloads (${SINKS.join(', ')})
  --install-skill          also copy the bundle into .claude/skills/<continue-…>/ for Claude Code
  --redact <a,b>           also redact these terms (names, client codenames…)
  --redact-file <path>     … or terms listed one per line in a file
  --no-redact              keep emails, keys and tokens (default: redact)
  --include-hidden         keep private context (system prompts, memory, harness notes)
  --keep-source            store the raw input under source/
  --json                   machine-readable output
  --post                   (sink) send the payload using credentials from env
  --jira-project <KEY>     (sink) Jira project key
  --sf-parent <recordId>   (sink) attach to an existing Salesforce record

Docs: docs/SPEC.md · https://github.com/nimb-ou/App`;

interface Args {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  const valued = new Set(['o', 'out', 'pick', 'sink', 'to', 'jira-project', 'sf-parent', 'now', 'redact', 'redact-file', 'relay', 'port', 'token', 'store', 'public-url']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }
    const m = a.match(/^--?([^=]+)(?:=(.*))?$/);
    if (m && a !== '-') {
      const key = m[1];
      if (m[2] !== undefined) out.flags[key] = m[2];
      else if (valued.has(key) && i + 1 < argv.length) out.flags[key] = argv[++i];
      else out.flags[key] = true;
    } else out._.push(a);
  }
  return out;
}

const str = (v: string | boolean | undefined): string | undefined => (typeof v === 'string' ? v : undefined);

function summarize(c: ConvertedBundle, outDir?: string): string {
  const b = c.bundle;
  const s = b.stats;
  const lines = [
    `✓ ${b.title}`,
    `  source   ${b.source.tool} (${b.source.kind})${b.source.url ? ` ${b.source.url}` : ''}`,
    `  content  ${s.userMessages} prompts · ${s.assistantMessages} replies · ${s.reasoningBlocks} reasoning · ${s.toolCalls} tool calls`,
    `  files    ${s.artifacts.recovered} recovered · ${s.artifacts.stale} stale · ${s.artifacts.lost} lost${s.artifacts.attached ? ` · ${s.artifacts.attached} attached` : ''}`,
  ];
  const high = b.loss.filter((l) => l.severity === 'high');
  if (high.length) lines.push(`  loss     ${high.map((l) => `${l.count} ${l.category}`).join(' · ')} (see LOSS_AUDIT.md)`);
  const red = Object.values(b.redaction.counts).reduce((x, y) => x + y, 0);
  if (red) lines.push(`  redacted ${red} secret/PII match(es)`);
  lines.push(`  root     ${b.integrity.root}`);
  if (outDir) lines.push(`  → ${outDir}/HANDOFF.md  (start here)`);
  return lines.join('\n');
}

async function cmdImport(source: string | undefined, a: Args, fromSession = false): Promise<void> {
  if (!source) throw new Error('Missing <source>. Run `baton help`.');
  const input = fromSession ? await loadInput(findSession(source)) : await loadInput(source);
  const sinks = (str(a.flags.sink) ?? '').split(',').filter(Boolean) as SinkName[];
  for (const s of sinks) if (!SINKS.includes(s)) throw new Error(`Unknown sink "${s}". Choose from ${SINKS.join(', ')}`);
  const results = convert(input.text, input.filename, {
    url: input.url,
    pick: str(a.flags.pick),
    redact: a.flags['no-redact'] !== true,
    redactTerms: [...(str(a.flags.redact) ?? '').split(','), ...(str(a.flags['redact-file']) ? readFileSync(str(a.flags['redact-file'])!, 'utf8').split('\n') : [])].filter((t) => t.trim()),
    includeHidden: a.flags['include-hidden'] === true,
    keepSource: a.flags['keep-source'] === true,
    sinks,
    sinkOptions: { jiraProject: str(a.flags['jira-project']), salesforceParentId: str(a.flags['sf-parent']) },
    now: str(a.flags.now),
  });
  const base = str(a.flags.o) ?? str(a.flags.out);
  const report: unknown[] = [];
  for (const r of results) {
    const outDir = results.length === 1 && base ? base : join(base ?? 'handoffs', r.slug);
    writeFiles(outDir, r.files);
    if (a.flags.zip) writeZip(`${outDir.replace(/\/$/, '')}.zip`, r.files, r.slug);
    let skillDir: string | undefined;
    if (a.flags['install-skill']) {
      skillDir = join('.claude', 'skills', skillName(r.bundle));
      mkdirSync(skillDir, { recursive: true });
      cpSync(outDir, skillDir, { recursive: true });
    }
    if (a.flags.json) report.push({ out: resolve(outDir), skillDir, id: r.bundle.id, title: r.bundle.title, stats: r.bundle.stats, loss: r.bundle.loss, root: r.bundle.integrity.root });
    else {
      console.log(summarize(r, outDir));
      if (skillDir) console.log(`  skill    installed at ${skillDir}/SKILL.md`);
    }
  }
  if (a.flags.json) console.log(JSON.stringify(report.length === 1 ? report[0] : report, null, 2));
  else if (results.length > 1) console.log(`\n${results.length} conversations written under ${base ?? 'handoffs'}/`);
}

async function cmdInspect(source: string | undefined, a: Args): Promise<void> {
  if (!source) throw new Error('Missing <source>');
  const input = await loadInput(source);
  const fmt = detectFormat(input.text, input.filename);
  const results = convert(input.text, input.filename, { url: input.url, pick: str(a.flags.pick), html: false });
  if (a.flags.json) {
    console.log(JSON.stringify({ format: fmt, conversations: results.map((r) => ({ id: r.bundle.id, title: r.bundle.title, stats: r.bundle.stats, loss: r.bundle.loss, artifacts: r.bundle.artifacts.map(({ content: _c, ...rest }) => rest) })) }, null, 2));
    return;
  }
  console.log(`format: ${fmt.kind} (${fmt.reason})\n`);
  for (const r of results) {
    console.log(summarize(r));
    for (const l of r.bundle.loss) console.log(`    [${l.severity}] ${l.category} ×${l.count}: ${l.detail}`);
    console.log('');
  }
}

function loadBundle(path: string): { bundle: BatonBundle; files: Record<string, string | Uint8Array> } {
  const raw = readBundleFiles(path);
  if (!raw['bundle.json']) throw new Error(`${path}: no bundle.json found`);
  const bundle = JSON.parse(String(raw['bundle.json'])) as BatonBundle;
  const files: Record<string, string | Uint8Array> = {};
  for (const [k, v] of Object.entries(raw)) if (k.startsWith('files/')) files[k.slice(6)] = v;
  return { bundle, files };
}

function cmdVerify(path: string | undefined, a: Args): number {
  if (!path) throw new Error('Missing <bundle>');
  const { bundle, files } = loadBundle(path);
  const r = verifyBundle(bundle, files);
  if (a.flags.json) console.log(JSON.stringify(r, null, 2));
  else if (r.ok) console.log(`✓ intact: ${bundle.events.length} events, ${bundle.artifacts.length} artifacts, root ${r.root}`);
  else {
    console.log(`✗ MODIFIED: expected root ${r.expectedRoot}\n            computed root ${r.root}`);
    if (r.firstBadEvent) console.log(`  first altered event: ${r.firstBadEvent}`);
    if (r.badArtifacts.length) console.log(`  altered files: ${r.badArtifacts.join(', ')}`);
  }
  return r.ok ? 0 : 2;
}

async function cmdSink(path: string | undefined, a: Args): Promise<void> {
  if (!path) throw new Error('Missing <bundle>');
  const to = str(a.flags.to) as SinkName | undefined;
  if (!to || !SINKS.includes(to)) throw new Error(`--to must be one of ${SINKS.join(', ')}`);
  const { bundle } = loadBundle(path);
  const payload = buildSink(to, bundle, { jiraProject: str(a.flags['jira-project']), salesforceParentId: str(a.flags['sf-parent']) });
  if (!a.flags.post) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const r = await postSink(payload);
  console.log(`${r.ok ? '✓' : '✗'} ${to}: HTTP ${r.status} ${r.url}\n${r.response}`);
  if (!r.ok) process.exitCode = 1;
}

const relayUrl = (a: Args) => str(a.flags.relay) ?? process.env.BATON_RELAY_URL;

async function cmdSend(source: string | undefined, a: Args): Promise<void> {
  if (!source) throw new Error('Missing <bundle dir | source>');
  let bundle: BatonBundle;
  let files: FileMap;
  if (existsSync(join(source, 'bundle.json'))) {
    const raw = readBundleFiles(source);
    bundle = JSON.parse(String(raw['bundle.json'])) as BatonBundle;
    files = raw;
  } else {
    const input = await loadInput(source);
    const [r] = convert(input.text, input.filename, { url: input.url, pick: str(a.flags.pick) });
    bundle = r.bundle;
    files = r.files;
  }
  const res = await sendBundle(bundle, files, { relay: relayUrl(a), token: str(a.flags.token) ?? process.env.BATON_RELAY_TOKEN, sealed: a.flags.seal === true });
  if (a.flags.json) return console.log(JSON.stringify(res, null, 2));
  console.log(`✓ sent "${bundle.title}"${res.sealed ? ' (end-to-end encrypted)' : ''}`);
  console.log(`  pickup   ${res.link}`);
  console.log(`  in another AI: "baton pickup ${res.sealed ? res.link : res.code}"  ·  terminal: baton pickup ${res.sealed ? `"${res.link}"` : res.code}${relayUrl(a) ? '' : '  (local store)'}`);
}

async function cmdPickup(code: string | undefined, a: Args): Promise<void> {
  if (!code) throw new Error('Missing <code>');
  const r = await pickup(code, { relay: relayUrl(a) });
  const out = str(a.flags.o) ?? str(a.flags.out) ?? join('handoffs', r.code);
  writeFiles(out, r.files);
  console.log(`✓ picked up "${r.title}" (${r.code})\n  → ${out}/HANDOFF.md  (start here)`);
}

/** Claude Code hook: reads the hook JSON on stdin and bundles the transcript before it is compacted or closed. */
async function cmdHook(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const h = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { session_id?: string; transcript_path?: string; cwd?: string; hook_event_name?: string };
  if (!h.transcript_path || !existsSync(h.transcript_path)) return;
  const input = await loadInput(h.transcript_path);
  const [r] = convert(input.text, input.filename, {});
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const dir = join(h.cwd ?? process.cwd(), '.baton', 'sessions', `${stamp}-${(h.hook_event_name ?? 'hook').toLowerCase()}-${(h.session_id ?? r.bundle.id).slice(0, 8)}`);
  writeFiles(dir, r.files);
  let sent = '';
  if (process.env.BATON_AUTO_SEND === '1') {
    const res = await sendBundle(r.bundle, r.files, { relay: process.env.BATON_RELAY_URL, token: process.env.BATON_RELAY_TOKEN, from: 'claude-code-hook' });
    sent = ` · pickup ${res.link}`;
  }
  console.error(`baton: saved ${h.hook_event_name ?? 'session'} snapshot → ${dir}${sent}`);
}

export async function main(argv: string[]): Promise<number> {
  const a = parseArgs(argv);
  const [cmd, arg] = a._;
  if (a.flags.version || a.flags.v) {
    console.log(VERSION);
    return 0;
  }
  switch (cmd) {
    case 'import':
      await cmdImport(arg, a);
      return 0;
    case 'session':
      await cmdImport(arg ?? 'latest', a, true);
      return 0;
    case 'inspect':
      await cmdInspect(arg, a);
      return 0;
    case 'verify':
      return cmdVerify(arg, a);
    case 'sink':
      await cmdSink(arg, a);
      return process.exitCode === 1 ? 1 : 0;
    case 'mcp':
      await startMcpServer();
      return 0;
    case 'relay':
      await startRelay({ port: Number(str(a.flags.port) ?? process.env.PORT ?? 8787), store: new RelayStore({ dir: str(a.flags.store) }), publicUrl: str(a.flags['public-url']), token: str(a.flags.token), log: (m) => console.error(m) });
      return 0;
    case 'send':
      await cmdSend(arg, a);
      return 0;
    case 'pickup':
      await cmdPickup(arg, a);
      return 0;
    case 'hook':
      await cmdHook();
      return 0;
    case undefined:
    case 'help':
      console.log(HELP);
      return 0;
    default:
      // `baton <url-or-file>` is shorthand for import
      if (/^https?:\/\//.test(cmd) || existsSync(cmd)) {
        await cmdImport(cmd, a);
        return 0;
      }
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      return 1;
  }
}
