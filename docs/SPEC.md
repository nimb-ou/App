# Baton bundle format: `baton.bundle/v1`

**Status:** draft 1 (2026-10-11) · **License:** CC-BY-4.0 for this document, Apache-2.0 for the reference implementation

A Baton bundle is a vendor-neutral record of a piece of AI work: what the user asked, what the assistant
said and reasoned, which tools it ran, which files it produced, and **what the source failed to include**.
A bundle is designed to be read by three audiences at once: an AI agent continuing the work, a person reviewing it, and a
system of record filing it.

## 1. Layout

A bundle is a directory (or a ZIP of one). Only `bundle.json` is normative. Everything else is a rendering of it.

```
<slug>/
  bundle.json      REQUIRED  canonical record (this spec)
  HANDOFF.md       RECOMMENDED  agent + human brief; front matter repeats id, source and root_hash
  PROMPT.md        paste-ready single block for chat UIs
  TRANSCRIPT.md    chronological rendering
  LOSS_AUDIT.md    rendering of `loss` + `artifacts`
  index.html       offline viewer (must not load remote resources)
  SKILL.md         Agent Skills front matter (`name`, `description`) so the folder is a skill
  AGENTS.md        pointer for agents that read AGENTS.md
  files/<path>     artifact contents for status recovered | stale | attached
  replay/          optional: source code cells + a sandboxed runner
  sinks/<system>.json  optional: business-system payloads
  source/          optional: the raw input
```

## 2. `bundle.json`

```ts
interface BatonBundle {
  schema: 'baton.bundle/v1';
  id: string;                 // 16 hex chars, sha256(kind ␀ conversationId|url ␀ title ␀ firstEventText)[:16]
  title: string;
  source: {
    kind: 'chatgpt-share' | 'chatgpt-export' | 'claude-export' | 'claude-code' | 'openai-messages' | 'baton-relay' | 'unknown';
    tool: string;             // human name of the source product
    url?: string; conversationId?: string; createdAt?: string; updatedAt?: string;
    model?: string; cwd?: string; gitBranch?: string;
  };
  events: BatonEvent[];       // chronological, the active branch only
  artifacts: BatonArtifact[]; // sorted by path
  loss: LossItem[];           // sorted by severity: high, warn, info
  links: string[];            // URLs referenced by messages or listed by the source
  redaction: { enabled: boolean; counts: Record<string, number> };
  integrity: { algorithm: 'sha256-chain'; root: string; count: number };
  stats: BundleStats;
  generator: { name: string; version: string; generatedAt: string };
}
```

### 2.1 Events

| `kind` | `role` | `text` | Other fields |
|---|---|---|---|
| `message` | user / assistant | Markdown | `hidden` = progress update hidden in the source UI |
| `reasoning` | assistant | reasoning text or summary | `meta.granularity` = `summary` \| `full`. `redactedBySource` when only a signature or ciphertext exists. |
| `tool_call` | assistant | short label | `tool.{name,title,language,input,args,callId}`. `redactedBySource` when the input is missing. |
| `tool_result` | tool | output | `tool.name`, `tool.callId`. `redactedBySource` when the source shows a placeholder. |
| `attachment` | user | description | `meta.{name,size,mimeType}` |
| `note` | any | structural marker | `meta.private = true` for private context (excluded by default) |

`tool.args` carries structured arguments only for file-editing tools (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`),
because artifact recovery replays them.

### 2.2 Artifacts

| `status` | Meaning | `content` |
|---|---|---|
| `recovered` | reconstructed byte for byte from the code or tool call that wrote it | present |
| `stale` | the last full write was recovered, but later modifications could not be replayed statically | present |
| `lost` | created or linked by the conversation, but its content is not in the source | absent |
| `attached` | content shipped with the source (for example, text extracted from an upload) | present |

`encoding` is `utf8` (default) or `base64` for binary files captured as bytes (PDFs, images, archives). `mimeType` is optional.
Files captured live from the source (in-page capture, model checkpoints) use status `recovered` with a `note` naming the capture.

`sha256` is the hex digest of the UTF-8 content. `recoveredFrom` / `modifiedBy` list event ids. `note` explains the status.
Paths are POSIX, relative and normalised. Absolute paths outside the source's working root are prefixed `_abs/`.
Paths never contain `..`.

### 2.3 Loss items

`{category, count, severity: 'high'|'warn'|'info', detail}`. Categories in v1: `tool-outputs`, `tool-inputs`,
`files-lost`, `files-stale`, `files-recovered`, `citations`, `images`, `user-attachments`, `branches`,
`reasoning-depth`, `memory`, `harness-context`, `subagents`, `private-context`, `baton-redactions`, `unreadable-lines`.
Producers may add categories. Consumers must display unknown ones verbatim.

## 3. Integrity

```
h0 = sha256("baton.bundle/v1")
hi = sha256(h(i-1) || stableJSON(event_i without "hash"))    for each event, in order; event_i.hash = hi
then, for each artifact sorted by path:
h  = sha256(h || stableJSON({path, status, sha256}))
root = h
```

`stableJSON` is JSON with object keys sorted lexicographically, `undefined` members dropped, and no whitespace.
A verifier recomputes artifact digests from `files/<path>` when present (otherwise from embedded `content`) and compares
the root. This gives **tamper-evidence** only. Anchoring the root externally (for example in WORM storage or a transparency log)
is out of scope for v1.

## 4. Privacy requirements for producers

1. Redaction of secrets and personal data **on by default**, with counts recorded in `redaction.counts`.
2. Private context (system prompts, memory, custom instructions, harness metadata) **excluded by default** and counted in `loss`.
3. Replay code is never executed by the producer.
4. Network access is limited to the single URL the user supplied.

## 5. Relay records (draft)

A relay stores records `{code, title, createdAt, updatedAt, expiresAt, from[], bundle?, checkpoints[], sealed?}`.
`checkpoints[]` are model-written states (`goal, state, decisions[], next_steps[], open_questions[], user_prompts[], files[], tool_outputs[]`).
A record renders to a normal bundle with `source.kind = 'baton-relay'`. `sealed` is `{alg: 'AES-GCM-256', iv, data}` over
`{title, handoff, prompt, zip}`. The key is never sent to the relay. Codes match `BTN-XXXX-XXXX-XXXX` (Crockford base32, 60 bits).

## 6. Versioning

Additive fields do not change the schema id. A breaking change bumps it to `baton.bundle/v2`. Consumers should
ignore unknown fields and reject unknown major versions.
