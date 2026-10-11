// Baton bundle format: the canonical, vendor-neutral representation of a piece of AI work.
// Spec: docs/SPEC.md. Keep this file free of runtime code other than constants.

export const SCHEMA_ID = 'baton.bundle/v1';
export const VERSION = '0.1.0';

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export type EventKind =
  | 'message' // prose from user or assistant
  | 'reasoning' // reasoning summary / thinking block
  | 'tool_call' // code execution, search, connector call
  | 'tool_result' // output of a tool call
  | 'attachment' // file or image attached to a message
  | 'note'; // structural marker (e.g. "worked for 24m")

export type SourceKind =
  | 'chatgpt-share'
  | 'chatgpt-export'
  | 'claude-export'
  | 'claude-code'
  | 'openai-messages'
  | 'unknown';

export interface ToolInfo {
  name: string;
  title?: string; // human label, e.g. "Searching OpenAlex…"
  language?: string;
  input?: string; // code / query / JSON args, as displayed
  args?: Record<string, unknown>; // structured args for file-editing tools (Write/Edit/MultiEdit)
  callId?: string;
}

export interface BatonEvent {
  id: string;
  seq: number;
  kind: EventKind;
  role: Role;
  time?: string; // ISO-8601
  text: string; // Markdown
  tool?: ToolInfo;
  model?: string;
  hidden?: boolean; // hidden in the source UI (system, memory, commentary)
  redactedBySource?: boolean; // the source replaced the content with a placeholder
  meta?: Record<string, unknown>;
  hash?: string; // chain hash, filled by integrity.ts
}

export type ArtifactStatus =
  | 'recovered' // full content reconstructed exactly from source
  | 'stale' // reconstructed, but later modified by code we could not replay statically
  | 'lost' // referenced/created in source, content unavailable
  | 'attached'; // content shipped with the source itself (e.g. Claude export attachment)

export interface BatonArtifact {
  path: string; // relative path inside bundle files/ (POSIX)
  originalPath: string;
  status: ArtifactStatus;
  content?: string;
  bytes?: number;
  sha256?: string;
  versions?: number;
  recoveredFrom?: string[]; // event ids
  modifiedBy?: string[]; // event ids that touched it after the last full write
  note?: string;
}

export type Severity = 'info' | 'warn' | 'high';

export interface LossItem {
  category: string;
  count: number;
  severity: Severity;
  detail: string;
}

export interface BatonSource {
  kind: SourceKind;
  tool: string; // human name: "ChatGPT", "Claude", "Claude Code"
  url?: string;
  conversationId?: string;
  createdAt?: string;
  updatedAt?: string;
  model?: string;
  cwd?: string;
  gitBranch?: string;
}

export interface BatonBundle {
  schema: typeof SCHEMA_ID;
  id: string;
  title: string;
  source: BatonSource;
  events: BatonEvent[];
  artifacts: BatonArtifact[];
  loss: LossItem[];
  links: string[];
  redaction: { enabled: boolean; counts: Record<string, number> };
  integrity: { algorithm: 'sha256-chain'; root: string; count: number };
  stats: BundleStats;
  generator: { name: 'baton'; version: string; generatedAt: string };
}

export interface BundleStats {
  userMessages: number;
  assistantMessages: number;
  reasoningBlocks: number;
  toolCalls: number;
  toolResults: number;
  hiddenEvents: number;
  redactedBySource: number;
  artifacts: Record<ArtifactStatus, number>;
  durationSeconds?: number;
}

/** Output of a parser, before normalisation/redaction/recovery. */
export interface ParsedConversation {
  title: string;
  source: BatonSource;
  events: Omit<BatonEvent, 'seq' | 'hash'>[];
  /** Files that came with the source (attachments with extracted text). */
  attachments?: { path: string; content: string; note?: string }[];
  /** URLs the source itself lists (e.g. ChatGPT safe_urls). */
  sourceLinks?: string[];
  /** Parser-level loss observations (things only the parser can know). */
  loss?: LossItem[];
}

export interface BuildOptions {
  redact?: boolean; // default true
  redactTerms?: string[]; // extra literal terms to redact (case-insensitive)
  includeHidden?: boolean; // default false
  now?: string; // ISO timestamp override for reproducible output
}
