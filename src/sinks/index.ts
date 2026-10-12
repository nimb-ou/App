// Business-system sinks: turn a bundle into API-ready payloads for systems of record.
// Payload builders are pure (browser-safe). Posting lives in src/node/post.ts and is opt-in.

import type { BatonBundle } from '../core/schema.ts';
import { truncate } from '../core/util.ts';
import { renderHandoff } from '../render/handoff.ts';
import { extractOpenThreads, sourceLabel, userPrompts } from '../render/turns.ts';

export type SinkName = 'salesforce' | 'jira' | 'zendesk' | 'slack';
export const SINKS: SinkName[] = ['salesforce', 'jira', 'zendesk', 'slack'];

export interface SinkOptions {
  jiraProject?: string;
  jiraIssueType?: string;
  salesforceParentId?: string; // attach to an existing record (Opportunity, Account, Case…) instead of creating a Case
  salesforceApiVersion?: string;
}

export interface SinkPayload {
  sink: SinkName;
  method: 'POST';
  /** Path relative to the system's base URL (filled from env when posting). */
  path: string;
  body: unknown;
  notes: string[];
}

function summaryLine(b: BatonBundle): string {
  const s = b.stats;
  return `${s.userMessages} prompts · ${s.toolCalls} tool calls · files: ${s.artifacts.recovered} recovered / ${s.artifacts.stale} stale / ${s.artifacts.lost} lost`;
}

function goal(b: BatonBundle, n = 600): string {
  return truncate(userPrompts(b)[0]?.text.trim() ?? b.title, n);
}

function latest(b: BatonBundle, n = 600): string {
  const p = userPrompts(b);
  return truncate(p[p.length - 1]?.text.trim() ?? '', n);
}

function priority(b: BatonBundle): 'High' | 'Medium' | 'Low' {
  if (b.loss.some((l) => l.severity === 'high' && (l.category === 'files-lost' || l.category === 'tool-inputs'))) return 'High';
  if (b.loss.some((l) => l.severity !== 'info')) return 'Medium';
  return 'Low';
}

const toBase64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

// ───────────────────────────── Salesforce ─────────────────────────────

export function salesforcePayload(b: BatonBundle, o: SinkOptions = {}): SinkPayload {
  const v = o.salesforceApiVersion ?? 'v61.0';
  const threads = extractOpenThreads(b, 5);
  const noteHtml = renderHandoff(b)
    .replace(/^---[\s\S]*?---\n/, '')
    .split('\n')
    .map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');
  const parentRef = o.salesforceParentId ?? '@{case.id}';
  const req: unknown[] = [];
  if (!o.salesforceParentId) {
    req.push({
      method: 'POST',
      url: `/services/data/${v}/sobjects/Case`,
      referenceId: 'case',
      body: {
        Subject: truncate(`AI handoff: ${b.title}`, 255),
        Description: truncate(`${goal(b, 1500)}\n\nLatest instruction: ${latest(b, 800)}\n\n${summaryLine(b)}\nSource: ${sourceLabel(b)}${b.source.url ? ` ${b.source.url}` : ''}\nBaton bundle ${b.id} · root ${b.integrity.root}`, 32000),
        Origin: 'Web',
        Priority: priority(b),
        Status: 'New',
      },
    });
  }
  req.push({
    method: 'POST',
    url: `/services/data/${v}/sobjects/ContentNote`,
    referenceId: 'note',
    body: { Title: truncate(`Baton handoff · ${b.title}`, 255), Content: toBase64(noteHtml) },
  });
  req.push({
    method: 'POST',
    url: `/services/data/${v}/sobjects/ContentDocumentLink`,
    referenceId: 'link',
    body: { ContentDocumentId: '@{note.id}', LinkedEntityId: parentRef, ShareType: 'V' },
  });
  threads.forEach((t, i) =>
    req.push({
      method: 'POST',
      url: `/services/data/${v}/sobjects/Task`,
      referenceId: `task${i + 1}`,
      body: { Subject: truncate(t, 255), WhatId: parentRef, Status: 'Not Started', Priority: 'Normal', Description: `Open thread from Baton handoff ${b.id}` },
    }),
  );
  return {
    sink: 'salesforce',
    method: 'POST',
    path: `/services/data/${v}/composite`,
    body: { allOrNone: true, compositeRequest: req },
    notes: [
      o.salesforceParentId ? `Attaches to existing record ${o.salesforceParentId}.` : 'Creates a Case, attaches the handoff as a ContentNote, and adds one Task per open thread.',
      'Env for --post: SALESFORCE_INSTANCE_URL, SALESFORCE_ACCESS_TOKEN (OAuth access token from a Connected App).',
    ],
  };
}

// ───────────────────────────── Jira (Atlassian Document Format) ─────────────────────────────

type Adf = Record<string, unknown>;
const text = (t: string, marks?: string[]): Adf => ({ type: 'text', text: t, ...(marks ? { marks: marks.map((m) => ({ type: m })) } : {}) });
const para = (...content: Adf[]): Adf => ({ type: 'paragraph', content });
const heading = (level: number, t: string): Adf => ({ type: 'heading', attrs: { level }, content: [text(t)] });
const bullets = (items: string[]): Adf => ({ type: 'bulletList', content: items.map((i) => ({ type: 'listItem', content: [para(text(i))] })) });

export function jiraPayload(b: BatonBundle, o: SinkOptions = {}): SinkPayload {
  const prompts = userPrompts(b);
  const threads = extractOpenThreads(b, 8);
  const lostFiles = b.artifacts.filter((a) => a.status === 'lost').map((a) => a.path);
  const content: Adf[] = [
    para(text('Handed off from '), text(sourceLabel(b), ['strong']), text(` via Baton. ${summaryLine(b)}.`)),
    heading(3, 'Goal'),
    para(text(goal(b, 2000))),
    heading(3, 'Latest instruction'),
    para(text(latest(b, 1000) || '—')),
  ];
  if (prompts.length > 1) content.push(heading(3, 'Prompt history'), { type: 'orderedList', content: prompts.map((p) => ({ type: 'listItem', content: [para(text(truncate(p.text.replace(/\s+/g, ' ').trim(), 400)))] })) });
  if (threads.length) content.push(heading(3, 'Open threads / blockers'), bullets(threads));
  if (lostFiles.length) content.push(heading(3, 'Files to rebuild (lost in transfer)'), bullets(lostFiles.slice(0, 30)));
  content.push(heading(3, 'Integrity'), para(text(`bundle ${b.id} · sha256 root `), text(b.integrity.root, ['code'])));
  if (b.source.url) content.push(para({ type: 'text', text: 'Source conversation', marks: [{ type: 'link', attrs: { href: b.source.url } }] }));

  return {
    sink: 'jira',
    method: 'POST',
    path: '/rest/api/3/issue',
    body: {
      fields: {
        project: { key: o.jiraProject ?? '${JIRA_PROJECT}' },
        issuetype: { name: o.jiraIssueType ?? 'Task' },
        summary: truncate(`AI handoff: ${b.title}`, 250),
        labels: ['baton-handoff', `source-${b.source.kind}`],
        description: { type: 'doc', version: 1, content },
      },
    },
    notes: ['Env for --post: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT (or --jira-project).'],
  };
}

// ───────────────────────────── Zendesk ─────────────────────────────

export function zendeskPayload(b: BatonBundle): SinkPayload {
  const threads = extractOpenThreads(b, 8);
  const body = [
    `AI conversation handed off from ${sourceLabel(b)} via Baton.`,
    '',
    `Goal: ${goal(b, 1500)}`,
    '',
    `Latest instruction: ${latest(b, 800)}`,
    '',
    summaryLine(b),
    ...(threads.length ? ['', 'Open threads:', ...threads.map((t) => `- ${t}`)] : []),
    '',
    `Bundle ${b.id} · sha256 root ${b.integrity.root}`,
    b.source.url ? `Source: ${b.source.url}` : '',
  ].join('\n');
  return {
    sink: 'zendesk',
    method: 'POST',
    path: '/api/v2/tickets.json',
    body: {
      ticket: {
        subject: truncate(`AI handoff: ${b.title}`, 250),
        comment: { body, public: false },
        priority: priority(b).toLowerCase() === 'medium' ? 'normal' : priority(b).toLowerCase(),
        tags: ['baton_handoff', `source_${b.source.kind.replace(/-/g, '_')}`],
      },
    },
    notes: ['Creates a ticket with an internal note (public: false).', 'Env for --post: ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN.'],
  };
}

// ───────────────────────────── Slack (Block Kit) ─────────────────────────────

export function slackPayload(b: BatonBundle): SinkPayload {
  const threads = extractOpenThreads(b, 5);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: truncate(`Handoff: ${b.title}`, 150) } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: esc(`${sourceLabel(b)} · ${summaryLine(b)}`) }] },
    { type: 'section', text: { type: 'mrkdwn', text: `*Goal*\n${esc(goal(b, 700))}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Latest instruction*\n${esc(latest(b, 500) || '—')}` } },
  ];
  if (threads.length) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Open threads*\n${threads.map((t) => `• ${esc(truncate(t, 280))}`).join('\n')}` } });
  const high = b.loss.filter((l) => l.severity === 'high');
  if (high.length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `:warning: ${esc(high.map((l) => `${l.count} ${l.category}`).join(' · '))}. See LOSS_AUDIT.md` }] });
  if (b.source.url) blocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open source conversation' }, url: b.source.url }] });
  return {
    sink: 'slack',
    method: 'POST',
    path: '(incoming webhook URL)',
    body: { text: `Handoff: ${b.title}`, blocks },
    notes: ['Env for --post: SLACK_WEBHOOK_URL (incoming webhook).'],
  };
}

export function buildSink(name: SinkName, b: BatonBundle, o: SinkOptions = {}): SinkPayload {
  switch (name) {
    case 'salesforce':
      return salesforcePayload(b, o);
    case 'jira':
      return jiraPayload(b, o);
    case 'zendesk':
      return zendeskPayload(b);
    case 'slack':
      return slackPayload(b);
  }
}
