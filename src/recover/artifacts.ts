// Artifact recovery: rebuild the files an AI session created, from the code and tool calls it logged.
//
// Ops are extracted in event order and folded per path:
//   write/append  ← shell heredocs (`cat > f <<'EOF'`, `tee f <<EOF`), Claude Code Write
//   replace       ← Claude Code Edit / MultiEdit (applied exactly when the prior content is known)
//   touch         ← modifications we cannot replay statically (python open(p,'w'), sed -i, `> f`, cp/mv)
//   reference     ← files the conversation links to (sandbox:/mnt/data/...) but never shows the bytes of
// Result statuses: recovered (exact), stale (exact up to a later unreplayable change), lost.

import type { ArtifactStatus, BatonArtifact, BatonEvent, SourceKind } from '../core/schema.ts';
import { sha256Hex } from '../core/sha256.ts';
import { asString, isRecord } from '../core/util.ts';
import type { FileMap } from '../core/zip.ts';

export type FileOpKind = 'write' | 'append' | 'replace' | 'touch' | 'reference';

export interface FileOp {
  kind: FileOpKind;
  path: string; // absolute or original path as written in the source
  eventId: string;
  content?: string;
  old?: string;
  new?: string;
  all?: boolean;
  note?: string;
}

const IGNORED_PREFIXES = ['/tmp/', '/dev/', '/proc/', '/sys/', '/etc/', '/usr/', '/home/oai/', '/root/.'];
const IGNORED_PARTS = ['/node_modules/', '/.git/', '/__pycache__/'];

function ignorable(p: string): boolean {
  if (/[$`*?{}]/.test(p)) return true; // unexpanded variables / globs: not a concrete file
  return IGNORED_PREFIXES.some((x) => p.startsWith(x)) || IGNORED_PARTS.some((x) => p.includes(x)) || p === '/dev/null';
}

function resolvePath(p: string, cwd: string): string {
  const unq = p.replace(/^['"]|['"]$/g, '');
  if (unq.startsWith('/')) return normaliseDots(unq);
  if (unq.startsWith('~')) return unq;
  return normaliseDots(`${cwd.replace(/\/$/, '')}/${unq}`);
}

function normaliseDots(p: string): string {
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

// ───────────────────────────── shell scripts ─────────────────────────────

const HEREDOC_RE = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/g;
// A possibly-quoted path; `q` is the capture-group number of the opening quote (for the backreference).
const pathToken = (q: number): string => `(['"]?)([^\\s'"<>|;&()]+)\\${q}`;

/** Unwrap `bash -lc <script>` and JSON `{"cmd":["bash","-lc","..."]}` forms. */
export function unwrapShell(input: string): string {
  const t = input.trim();
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as { cmd?: unknown };
      if (Array.isArray(o.cmd) && typeof o.cmd[o.cmd.length - 1] === 'string') return o.cmd[o.cmd.length - 1] as string;
    } catch {
      /* not JSON */
    }
  }
  return t.replace(/^(?:bash|sh)\s+-l?c\s+/, '');
}

function segmentAt(line: string, index: number): string {
  const seps = /&&|\|\||;|\|/g;
  let start = 0;
  let end = line.length;
  let m: RegExpExecArray | null;
  while ((m = seps.exec(line)) !== null) {
    if (m.index < index) start = m.index + m[0].length;
    else {
      end = m.index;
      break;
    }
  }
  return line.slice(start, end);
}

export function extractShellOps(input: string, eventId: string, initialCwd = '/'): FileOp[] {
  const script = unwrapShell(input);
  const lines = script.split('\n');
  const ops: FileOp[] = [];
  let cwd = initialCwd;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // `cd` changes the directory for the segments after it on the same line and for later lines.
    const lineCwd = cwd;
    const cds = [...line.matchAll(/(?:^|&&|;|\|\|)\s*cd\s+(['"]?)([^\s'";&|]+)\1/g)];
    const cwdAt = (idx: number): string => cds.reduce((c, m) => ((m.index ?? 0) < idx ? resolvePath(m[2], c) : c), lineCwd);

    const heredocs = [...line.matchAll(HEREDOC_RE)];
    // Modifications per command segment; heredoc segments (`cat > f <<'EOF'`) are writes, handled below.
    for (const seg of line.matchAll(/[^;&|]+/g)) {
      const start = seg.index ?? 0;
      const end = start + seg[0].length;
      if (heredocs.some((h) => (h.index ?? 0) >= start && (h.index ?? 0) < end)) continue;
      ops.push(...shellModifications(seg[0], eventId, cwdAt(start)));
    }
    cwd = cwdAt(line.length);

    let j = i + 1;
    for (const h of heredocs) {
      const strip = h[1] === '-';
      const quoted = h[2] !== '';
      const delim = h[3];
      const body: string[] = [];
      while (j < lines.length) {
        const raw = lines[j];
        const cmp = strip ? raw.replace(/^\t+/, '') : raw;
        j++;
        if (cmp === delim) break;
        body.push(strip ? cmp : raw);
      }
      const seg = segmentAt(line, h.index ?? 0);
      const catT = seg.match(new RegExp(String.raw`\bcat\b[^>]*?(>>?)\s*` + pathToken(2)));
      const teeT = seg.match(new RegExp(String.raw`\btee\s+(-a\s+)?` + pathToken(2)));
      const content = body.length ? body.join('\n') + '\n' : '';
      if (catT || teeT) {
        const append = catT ? catT[1] === '>>' : Boolean(teeT && teeT[1]);
        const path = resolvePath(catT ? catT[3] : (teeT as RegExpMatchArray)[3], cwdAt(h.index ?? 0));
        if (!ignorable(path)) {
          const expands = !quoted && /[$`\\]/.test(content);
          ops.push({ kind: append ? 'append' : 'write', path, eventId, content, note: expands ? 'unquoted heredoc: shell expansions ($VAR, `cmd`) were not evaluated' : undefined });
        }
      } else {
        // e.g. python - <<'PY' … PY: not a file, but its code may rewrite files.
        ops.push(...pythonModifications(content, eventId, cwdAt(h.index ?? 0)));
      }
    }
    i = j;
  }
  return ops;
}

function shellModifications(line: string, eventId: string, cwd: string): FileOp[] {
  const ops: FileOp[] = [];
  const add = (p: string, note: string) => {
    if (!/[./]/.test(p)) return; // not path-like (e.g. `x>0` inside an inline expression)
    const path = resolvePath(p, cwd);
    if (!ignorable(path) && !/^-/.test(p)) ops.push({ kind: 'touch', path, eventId, note });
  };
  // Output redirection (not 2>, &>, heredocs already stripped).
  for (const m of line.matchAll(new RegExp(String.raw`(?<![0-9&<>=-])(>>?)\s*` + pathToken(2), 'g'))) add(m[3], m[1] === '>>' ? 'appended by shell redirect' : 'overwritten by shell redirect');
  for (const m of line.matchAll(new RegExp(String.raw`(?<![\w./-])sed\s+-i\S*\s+(?:'[^']*'|"[^"]*"|\S+)\s+` + pathToken(1), 'g'))) add(m[2], 'edited in place by sed -i');
  for (const m of line.matchAll(new RegExp(String.raw`(?<![\w./-])(?:cp|mv)\s+(?:-\S+\s+)*\S+\s+` + pathToken(1), 'g'))) add(m[2], 'replaced by cp/mv');
  for (const m of line.matchAll(new RegExp(String.raw`(?<![\w./-])zip\s+(?:-\S+\s+)*` + pathToken(1), 'g'))) add(m[2], 'archive produced by zip');
  return ops;
}

function pythonModifications(code: string, eventId: string, cwd: string): FileOp[] {
  const ops: FileOp[] = [];
  const vars = new Map<string, string>();
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\s*=\s*(?:Path\(\s*)?(['"])([^'"\n]+)\2/g)) {
    if (m[3].includes('/') || /\.\w{1,6}$/.test(m[3])) vars.set(m[1], m[3]);
  }
  const touch = (raw: string, note: string) => {
    const lit = raw.match(/^(['"])(.+)\1$/);
    const p = lit ? lit[2] : vars.get(raw);
    if (!p || !/\.\w{1,6}$/.test(p)) return; // directories and non-file values
    const path = resolvePath(p, cwd);
    if (!ignorable(path)) ops.push({ kind: 'touch', path, eventId, note });
  };
  for (const m of code.matchAll(/open\(\s*([A-Za-z_]\w*|(['"])[^'"\n]+\2)\s*,\s*['"](?:w|a|wb|ab|w\+|a\+)['"]/g)) touch(m[1], 'rewritten by Python open(…, "w")');
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\.write_(?:text|bytes)\(/g)) touch(m[1], 'rewritten by Python write_text');
  for (const m of code.matchAll(/Path\(\s*((['"])[^'"\n]+\2)\s*\)\.write_(?:text|bytes)\(/g)) touch(m[1], 'rewritten by Python write_text');
  for (const m of code.matchAll(/\.(?:save|savefig|to_csv|to_json|to_excel|write_pdf)\(\s*([A-Za-z_]\w*|(['"])[^'"\n]+\2)/g)) touch(m[1], 'generated by Python (binary or derived output)');
  return ops;
}

// ───────────────────────────── structured tools (Claude Code) ─────────────────────────────

const ARTIFACT_EXT: Record<string, string> = {
  'application/vnd.ant.code': '', 'text/markdown': '.md', 'text/html': '.html', 'image/svg+xml': '.svg',
  'application/vnd.ant.react': '.jsx', 'application/vnd.ant.mermaid': '.mmd',
};
const LANG_EXT: Record<string, string> = { python: '.py', javascript: '.js', typescript: '.ts', tsx: '.tsx', jsx: '.jsx', html: '.html', css: '.css', json: '.json', bash: '.sh', shell: '.sh', sql: '.sql', rust: '.rs', go: '.go', java: '.java', markdown: '.md', yaml: '.yaml' };

/** claude.ai "artifacts" tool: create / update / rewrite a named artifact. */
function artifactOps(args: Record<string, unknown>, eventId: string, paths: Map<string, string>): FileOp[] {
  const id = asString(args.id) || 'artifact';
  const type = asString(args.type);
  // Updates carry no type; reuse the path chosen when the artifact was created.
  const ext = ARTIFACT_EXT[type] || LANG_EXT[asString(args.language).toLowerCase()] || (type ? '' : '.txt');
  const known = paths.get(id);
  const path = known && (args.command === 'update' || !type) ? known : `/claude-artifacts/${id}${ext || '.txt'}`;
  paths.set(id, path);
  const cmd = asString(args.command);
  if (cmd === 'update') return [{ kind: 'replace', path, eventId, old: asString(args.old_str), new: asString(args.new_str) }];
  if (cmd === 'create' || cmd === 'rewrite') return [{ kind: 'write', path, eventId, content: asString(args.content) }];
  return [];
}

export function extractToolArgOps(name: string, args: Record<string, unknown>, eventId: string, artifactPaths: Map<string, string> = new Map()): FileOp[] {
  if (name === 'artifacts') return artifactOps(args, eventId, artifactPaths);
  const path = asString(args.file_path || args.notebook_path || args.path);
  if (!path) return [];
  if (name === 'Write') return [{ kind: 'write', path, eventId, content: asString(args.content) }];
  if (name === 'create_file') return [{ kind: 'write', path, eventId, content: asString(args.file_text) }];
  if (name === 'str_replace') return [{ kind: 'replace', path, eventId, old: asString(args.old_str), new: asString(args.new_str) }];
  if (name === 'Edit') return [{ kind: 'replace', path, eventId, old: asString(args.old_string), new: asString(args.new_string), all: args.replace_all === true }];
  if (name === 'MultiEdit' && Array.isArray(args.edits)) {
    return (args.edits as unknown[]).filter(isRecord).map((e) => ({ kind: 'replace' as const, path, eventId, old: asString(e.old_string), new: asString(e.new_string), all: e.replace_all === true }));
  }
  return [{ kind: 'touch', path, eventId, note: `modified by ${name}` }];
}

// ───────────────────────────── text references ─────────────────────────────

export function extractSandboxReferences(text: string, eventId: string): FileOp[] {
  const ops: FileOp[] = [];
  for (const m of text.matchAll(/sandbox:(\/mnt\/data\/[^\s)\]"'>`]+)/g)) {
    const p = m[1].replace(/[.,;:]+$/, '');
    if (!p.endsWith('/')) ops.push({ kind: 'reference', path: decodeURI(p), eventId });
  }
  return ops;
}

// ───────────────────────────── fold ─────────────────────────────

export interface RecoveryResult {
  artifacts: BatonArtifact[];
  replay?: FileMap;
}

// Vendor sandbox roots that map to the top of files/ (ChatGPT, claude.ai file tools and artifacts).
const SANDBOX_ROOTS = ['/mnt/data/', '/mnt/user-data/outputs/', '/home/claude/', '/claude-artifacts/'];

export function bundlePath(original: string, kind: SourceKind, cwd?: string): string {
  let p = original.replace(/^sandbox:/, '');
  if (p.startsWith('/')) p = normaliseDots(p);
  const sandboxRoot = SANDBOX_ROOTS.find((r) => p.startsWith(r));
  if (sandboxRoot) p = p.slice(sandboxRoot.length);
  else if (cwd && p.startsWith(cwd.replace(/\/$/, '') + '/')) p = p.slice(cwd.replace(/\/$/, '').length + 1);
  else if (p.startsWith('/')) p = '_abs' + p;
  // Never allow escaping the bundle directory.
  const safe = p.split('/').filter((s) => s && s !== '.' && s !== '..').join('/');
  return safe || (kind === 'unknown' ? 'file' : 'unnamed');
}

const BINARY_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|gif|webp|svg|mp4|mov|wav|mp3|pkl|npy|npz|parquet|sqlite|db)$/i;

export function collectOps(events: BatonEvent[], kind: SourceKind, cwd?: string): FileOp[] {
  const ops: FileOp[] = [];
  const artifactPaths = new Map<string, string>();
  for (const e of events) {
    if (e.kind === 'tool_call' && e.tool) {
      const { name, input, args } = e.tool;
      if (args && isRecord(args)) ops.push(...extractToolArgOps(name, args, e.id, artifactPaths));
      else if (input && (name === 'container.exec' || name === 'python' || name === 'Bash' || name === 'bash_tool' || e.tool.language === 'bash')) {
        ops.push(...extractShellOps(input, e.id, kind === 'claude-code' && cwd ? cwd : '/'));
      }
    }
    if ((kind === 'chatgpt-share' || kind === 'chatgpt-export') && (e.kind === 'message' || e.kind === 'tool_call')) {
      ops.push(...extractSandboxReferences(e.text, e.id));
    }
  }
  return ops;
}

export function foldOps(ops: FileOp[], kind: SourceKind, cwd?: string): BatonArtifact[] {
  interface S { original: string; content?: string; versions: number; status: ArtifactStatus; from: string[]; modified: string[]; notes: Set<string> }
  const state = new Map<string, S>();
  const get = (p: string): S => {
    let s = state.get(p);
    if (!s) {
      s = { original: p, versions: 0, status: 'lost', from: [], modified: [], notes: new Set() };
      state.set(p, s);
    }
    return s;
  };

  for (const op of ops) {
    const s = get(op.path);
    switch (op.kind) {
      case 'write':
        s.content = op.content ?? '';
        s.versions++;
        s.status = 'recovered';
        s.from.push(op.eventId);
        s.modified = [];
        s.notes.clear();
        if (op.note) s.notes.add(op.note);
        break;
      case 'append':
        if (s.content !== undefined) {
          s.content += op.content ?? '';
          s.versions++;
          s.from.push(op.eventId);
        } else {
          s.content = op.content ?? '';
          s.status = 'stale';
          s.notes.add('appended to a file whose earlier content is not in the source');
          s.from.push(op.eventId);
        }
        break;
      case 'replace':
        if (s.content !== undefined && op.old !== undefined && s.content.includes(op.old)) {
          s.content = op.all ? s.content.split(op.old).join(op.new ?? '') : s.content.replace(op.old, () => op.new ?? '');
          s.versions++;
          s.from.push(op.eventId);
        } else {
          if (s.content === undefined) s.notes.add(kind === 'claude-code' ? 'pre-existing file edited during the session; only the edit hunks are in the transcript' : 'edit target content unknown');
          else s.notes.add('an edit did not match the reconstructed content');
          s.status = s.content === undefined ? 'lost' : 'stale';
          s.modified.push(op.eventId);
        }
        break;
      case 'touch':
        if (s.content !== undefined) s.status = 'stale';
        s.modified.push(op.eventId);
        if (op.note) s.notes.add(op.note);
        break;
      case 'reference':
        break;
    }
  }

  const artifacts: BatonArtifact[] = [];
  for (const [p, s] of state) {
    if (s.content === undefined) {
      if (kind === 'chatgpt-share' || kind === 'chatgpt-export') {
        s.notes.add(BINARY_EXT.test(p) ? 'binary/derived output; regenerate with replay/' : 'created by code the source did not include');
      } else {
        s.notes.add('exists in the original working directory; contents not reconstructable from the log');
      }
    }
    artifacts.push({
      path: bundlePath(p, kind, cwd),
      originalPath: s.original,
      status: s.content === undefined ? 'lost' : s.status,
      content: s.content,
      bytes: s.content === undefined ? undefined : new TextEncoder().encode(s.content).length,
      sha256: s.content === undefined ? undefined : sha256Hex(s.content),
      versions: s.versions || undefined,
      recoveredFrom: s.from.length ? s.from : undefined,
      modifiedBy: s.modified.length ? s.modified : undefined,
      note: s.notes.size ? [...s.notes].join('; ') : undefined,
    });
  }
  return artifacts.sort((a, b) => a.path.localeCompare(b.path));
}

export function recoverArtifacts(events: BatonEvent[], kind: SourceKind, cwd?: string): RecoveryResult {
  const artifacts = foldOps(collectOps(events, kind, cwd), kind, cwd);
  // De-duplicate bundle paths (two originals could map to the same safe path).
  const seen = new Map<string, number>();
  for (const a of artifacts) {
    const n = seen.get(a.path) ?? 0;
    seen.set(a.path, n + 1);
    if (n) a.path = a.path.replace(/(\.[^./]+)?$/, `~${n}$1`);
  }
  return { artifacts, replay: buildReplay(events) };
}

// ───────────────────────────── replay kit ─────────────────────────────

export function buildReplay(events: BatonEvent[]): FileMap | undefined {
  const cells = events.filter((e) => e.kind === 'tool_call' && e.tool?.name === 'container.exec' && e.tool.input);
  if (!cells.length) return undefined;
  const files: FileMap = {};
  cells.forEach((e, i) => {
    const n = String(i + 1).padStart(3, '0');
    files[`replay/cells/${n}.sh`] = `# Cell ${n} · source event ${e.id}${e.time ? ' · ' + e.time : ''}\n# ${e.tool?.title ?? ''}\n${unwrapShell(e.tool!.input!)}\n`;
  });
  files['replay/run-in-docker.sh'] = REPLAY_SH;
  files['replay/README.md'] = replayReadme(cells.length);
  return files;
}

const REPLAY_SH = `#!/usr/bin/env bash
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
  bash -c "$SETUP; for c in /cells/*.sh; do echo \\"── \\$(basename \\$c)\\"; bash \\"\\$c\\" || echo '   (cell failed, continuing)'; done"
`;

function replayReadme(n: number): string {
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
