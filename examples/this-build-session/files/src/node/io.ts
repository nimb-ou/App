// Node-only I/O: fetching a share URL, reading files/zips, locating Claude Code sessions, writing bundles.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { unzipSync, zip, type FileMap } from '../core/zip.ts';
import { pickExportMember } from '../pipeline.ts';

export interface LoadedInput {
  text: string;
  filename: string;
  url?: string;
}

const SHARE_HOSTS = new Set(['chatgpt.com', 'chat.openai.com']);
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Baton/0.1';

export function isShareUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && SHARE_HOSTS.has(u.hostname) && /^\/(?:share|s)\/[A-Za-z0-9-]+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

/** Fetch exactly one user-supplied public share page. No crawling, no auth, no retries beyond one. */
export async function fetchShare(url: string, timeoutMs = 30000): Promise<LoadedInput> {
  if (!isShareUrl(url)) {
    throw new Error(`Only public ChatGPT share links are fetched (https://chatgpt.com/share/<id>). For other sources, export the data and pass the file. Got: ${url}`);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`Fetching share link failed: HTTP ${res.status}. The link may be private, deleted, or rate-limited. Try saving the page (Ctrl/Cmd+S) and passing the .html file.`);
    const text = await res.text();
    if (!text.includes('streamController.enqueue')) {
      throw new Error('The page did not contain conversation data (possibly a login or bot-check page). Save the page from your browser and pass the .html file instead.');
    }
    return { text, filename: 'share.html', url };
  } finally {
    clearTimeout(t);
  }
}

/** Read a file or a ZIP export. For ZIPs, conversations.json is selected automatically. */
export function readInputFile(path: string): LoadedInput {
  const buf = readFileSync(path);
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) {
    const members = unzipSync(new Uint8Array(buf), (d) => new Uint8Array(inflateRawSync(d)), (n) => /\.(json|jsonl|html?)$/i.test(n));
    const name = pickExportMember(Object.keys(members));
    if (!name) throw new Error(`${path}: zip contains no conversations.json / .jsonl / .html`);
    return { text: new TextDecoder().decode(members[name]), filename: name };
  }
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    // .gz (e.g. fixtures)
    const { gunzipSync } = require_zlib();
    return { text: gunzipSync(buf).toString('utf8'), filename: path.replace(/\.gz$/, '') };
  }
  return { text: buf.toString('utf8'), filename: path };
}

function require_zlib(): typeof import('node:zlib') {
  // node:zlib is already loaded above for inflateRawSync; re-import lazily for gunzip.
  return process.getBuiltinModule('node:zlib') as typeof import('node:zlib');
}

export async function loadInput(source: string): Promise<LoadedInput> {
  if (/^https?:\/\//i.test(source)) return fetchShare(source);
  if (!existsSync(source)) throw new Error(`No such file: ${source}`);
  if (statSync(source).isDirectory()) {
    const latest = newestJsonl(source);
    if (!latest) throw new Error(`${source} is a directory without .jsonl session logs`);
    return readInputFile(latest);
  }
  return readInputFile(source);
}

// ───────────────────────────── Claude Code sessions ─────────────────────────────

export function claudeProjectsDir(): string {
  return process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, 'projects') : join(homedir(), '.claude', 'projects');
}

/** Claude Code stores sessions under ~/.claude/projects/<cwd with / and . replaced by ->/<session>.jsonl */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-');
}

function newestJsonl(dir: string): string | undefined {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f: join(dir, f), m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return files[0]?.f;
}

export function findSession(idOrLatest = 'latest', cwd = process.cwd()): string {
  const base = claudeProjectsDir();
  const projDir = join(base, projectSlug(cwd));
  if (idOrLatest !== 'latest') {
    const direct = join(projDir, `${idOrLatest}.jsonl`);
    if (existsSync(direct)) return direct;
    for (const d of existsSync(base) ? readdirSync(base) : []) {
      const p = join(base, d, `${idOrLatest}.jsonl`);
      if (existsSync(p)) return p;
    }
    throw new Error(`Session ${idOrLatest} not found under ${base}`);
  }
  const latest = existsSync(projDir) ? newestJsonl(projDir) : undefined;
  if (!latest) throw new Error(`No Claude Code sessions found for ${cwd} (looked in ${projDir})`);
  return latest;
}

// ───────────────────────────── writing ─────────────────────────────

/** Write a file map under `outDir`, refusing any path that would escape it. Returns written paths. */
export function writeFiles(outDir: string, files: FileMap): string[] {
  const root = resolve(outDir);
  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const target = resolve(root, rel);
    if (target !== root && !target.startsWith(root + sep)) throw new Error(`Refusing to write outside ${root}: ${rel}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    written.push(relative(process.cwd(), target) || target);
  }
  return written;
}

export function writeZip(path: string, files: FileMap, prefix = ''): void {
  const prefixed: FileMap = {};
  for (const [k, v] of Object.entries(files)) prefixed[prefix ? `${prefix}/${k}` : k] = v;
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, zip(prefixed));
}

/** Read a bundle back (directory, bundle.json, or .zip) for verify/sink. */
export function readBundleFiles(path: string): Record<string, string> {
  const dec = new TextDecoder();
  if (statSync(path).isDirectory()) {
    const out: Record<string, string> = {};
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else out[relative(path, p).split(sep).join('/')] = readFileSync(p, 'utf8');
      }
    };
    walk(path);
    return out;
  }
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) === 0x04034b50) {
    const members = unzipSync(new Uint8Array(buf), (d) => new Uint8Array(inflateRawSync(d)));
    const out: Record<string, string> = {};
    const names = Object.keys(members);
    const bundleJson = names.find((n) => n.endsWith('bundle.json'));
    const prefix = bundleJson ? bundleJson.slice(0, -'bundle.json'.length) : '';
    for (const n of names) if (n.startsWith(prefix)) out[n.slice(prefix.length)] = dec.decode(members[n]);
    return out;
  }
  return { 'bundle.json': buf.toString('utf8') };
}
