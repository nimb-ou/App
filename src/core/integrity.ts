// Tamper-evidence: a SHA-256 hash chain over normalised events and artifacts.
// h_0 = sha256(schema id); h_i = sha256(h_{i-1} + stableJSON(event_i without hash)).
// The root also commits to every artifact's content hash, so edited files are detected too.

import type { BatonArtifact, BatonBundle, BatonEvent } from './schema.ts';
import { SCHEMA_ID } from './schema.ts';
import { sha256Hex } from './sha256.ts';
import { stableStringify } from './util.ts';

function eventPayload(e: BatonEvent): string {
  const { hash: _ignored, ...rest } = e;
  return stableStringify(rest);
}

function artifactPayload(a: BatonArtifact): string {
  return stableStringify({ path: a.path, status: a.status, sha256: a.sha256 ?? null });
}

export function chainEvents(events: BatonEvent[], artifacts: BatonArtifact[]): string {
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

export interface VerifyResult {
  ok: boolean;
  root: string;
  expectedRoot: string;
  firstBadEvent?: string;
  badArtifacts: string[];
}

/** Recompute the chain from a bundle (and optionally the shipped file contents) and compare. */
export function verifyBundle(bundle: BatonBundle, files?: Record<string, string>): VerifyResult {
  let h = sha256Hex(SCHEMA_ID);
  let firstBad: string | undefined;
  for (const e of bundle.events) {
    h = sha256Hex(h + eventPayload(e));
    if (!firstBad && e.hash && e.hash !== h) firstBad = e.id;
  }
  const badArtifacts: string[] = [];
  for (const a of [...bundle.artifacts].sort((x, y) => x.path.localeCompare(y.path))) {
    if (files && a.sha256 && files[a.path] !== undefined && sha256Hex(files[a.path]) !== a.sha256) {
      badArtifacts.push(a.path);
    }
    h = sha256Hex(h + artifactPayload(a));
  }
  return {
    ok: h === bundle.integrity.root && !firstBad && badArtifacts.length === 0,
    root: h,
    expectedRoot: bundle.integrity.root,
    firstBadEvent: firstBad,
    badArtifacts,
  };
}
