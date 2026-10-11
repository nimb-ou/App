import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { buildBundle } from '../src/core/build.ts';
import { verifyBundle } from '../src/core/integrity.ts';
import { sha256Hex } from '../src/core/sha256.ts';
import { detectFormat, parseAny } from '../src/parsers/detect.ts';

const FIXTURE = new URL('../fixtures/chatgpt-share-cricket-stumping.html.gz', import.meta.url);
const shareHtml = gunzipSync(readFileSync(FIXTURE)).toString('utf8');
const NOW = { now: '2026-10-11T00:00:00Z' };

describe('ChatGPT share page (real fixture)', () => {
  const [parsed] = parseAny(shareHtml, 'share.html', 'https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388');
  const { bundle, extraFiles } = buildBundle(parsed, NOW);

  it('detects the format', () => assert.equal(detectFormat(shareHtml, 'share.html').kind, 'chatgpt-share'));
  it('extracts title, source and all 8 user prompts verbatim', () => {
    assert.equal(bundle.title, 'Cricket Stumping Simulation');
    assert.equal(bundle.source.conversationId, '6acbc222-2500-83ee-b38c-dcfe2b46e388');
    const prompts = bundle.events.filter((e) => e.kind === 'message' && e.role === 'user').map((e) => e.text.trim());
    assert.equal(prompts.length, 8);
    assert.match(prompts[0], /^Model and plan full research paper level simulatable process/);
    assert.equal(prompts[2], 'Buuld it');
    assert.equal(prompts[7], 'It is connevted');
  });
  it('keeps reasoning summaries and executed code', () => {
    assert.equal(bundle.stats.reasoningBlocks, 47);
    const execs = bundle.events.filter((e) => e.tool?.name === 'container.exec' && e.kind === 'tool_call');
    assert.equal(execs.length, 52);
    assert.ok(execs.every((e) => e.tool?.input && !e.redactedBySource));
  });
  it('audits what the share dropped', () => {
    const byCat = Object.fromEntries(bundle.loss.map((l) => [l.category, l.count]));
    assert.equal(byCat['tool-outputs'], 163);
    assert.equal(byCat['tool-inputs'], 81);
    assert.equal(byCat['files-lost'], 16);
    assert.equal(bundle.loss[0].severity, 'high');
  });
  it('recovers project files byte-for-byte and marks the rest honestly', () => {
    const by = Object.fromEntries(bundle.artifacts.map((a) => [a.path, a]));
    assert.equal(bundle.stats.artifacts.recovered, 13);
    assert.equal(bundle.stats.artifacts.stale, 3);
    const sim = by['stumping_research_package/simulate_stumping.py'];
    assert.equal(sim.status, 'recovered');
    assert.match(sim.content ?? '', /^#!\/usr\/bin\/env python3\n"""Reproducible illustrative model of cricket stumping/);
    assert.equal(sim.sha256, sha256Hex(sim.content ?? ''));
    assert.equal(by['stumping_research_package/README.md'].versions, 2);
    assert.equal(by['stumping_research_package/make_paper.py'].status, 'stale');
    assert.equal(by['stumping_research_package/app.py'].status, 'lost');
    assert.equal(by['stumping_research_package/stumping_recovery_research_paper.pdf'].status, 'lost');
  });
  it('emits a replay kit with one cell per container.exec call', () => {
    const cells = Object.keys(extraFiles).filter((k) => k.startsWith('replay/cells/'));
    assert.equal(cells.length, 52);
    assert.match(String(extraFiles['replay/run-in-docker.sh']), /--network "\$NET"/);
  });
  it('excludes empty private context and converts GenUI markers', () => {
    assert.ok(!bundle.events.some((e) => e.role === 'system'));
    const all = bundle.events.map((e) => e.text).join('\n');
    assert.ok(!/[-]/.test(all), 'private-use markers removed');
    assert.match(all, /\[github\.com\/nimb-ou\/App\]\(https:\/\/github\.com\/nimb-ou\/App\)/);
  });
  it('is deterministic and verifiable', () => {
    const again = buildBundle(parseAny(shareHtml, 'share.html', 'https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388')[0], NOW).bundle;
    assert.equal(again.integrity.root, bundle.integrity.root);
    assert.ok(verifyBundle(bundle).ok);
    const tampered = structuredClone(bundle);
    tampered.events[0].text += ' (edited)';
    const r = verifyBundle(tampered);
    assert.equal(r.ok, false);
    assert.equal(r.firstBadEvent, tampered.events[0].id);
  });
});

describe('ChatGPT export (conversations.json)', () => {
  const conv = {
    title: 'Branchy',
    create_time: 1700000000,
    current_node: 'c',
    mapping: {
      r: { id: 'r', parent: null, children: ['a'], message: null },
      a: { id: 'a', parent: 'r', children: ['b', 'x'], message: { id: 'a', author: { role: 'user' }, content: { content_type: 'text', parts: ['Plan a trip'] }, create_time: 1700000001 } },
      x: { id: 'x', parent: 'a', children: [], message: { id: 'x', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['old branch'] } } },
      b: { id: 'b', parent: 'a', children: ['c'], message: { id: 'b', author: { role: 'assistant' }, recipient: 'python', content: { content_type: 'code', language: 'python', text: 'print(1)' } } },
      c: { id: 'c', parent: 'b', children: [], message: { id: 'c', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['Here is the plan. Email me at jane@acme.io'] } } },
    },
  };
  it('follows the active branch, records the dropped branch and redacts', () => {
    const list = parseAny(JSON.stringify([conv]), 'conversations.json');
    assert.equal(list.length, 1);
    const { bundle } = buildBundle(list[0], NOW);
    assert.deepEqual(bundle.events.map((e) => e.kind), ['message', 'tool_call', 'message']);
    assert.ok(!bundle.events.some((e) => e.text.includes('old branch')));
    assert.ok(bundle.loss.some((l) => l.category === 'branches' && l.count >= 1));
    assert.match(bundle.events[2].text, /\[REDACTED:EMAIL\]/);
    assert.equal(bundle.redaction.counts.email, 1);
  });
});

describe('Claude.ai export', () => {
  const conv = [
    {
      uuid: 'u1',
      name: 'Pricing page',
      created_at: '2026-01-01T10:00:00Z',
      chat_messages: [
        { uuid: 'm1', sender: 'human', text: 'Draft a pricing page', created_at: '2026-01-01T10:00:00Z', attachments: [{ file_name: 'notes.txt', extracted_content: 'tiers: free, pro' }], files: [] },
        { uuid: 'm2', sender: 'assistant', created_at: '2026-01-01T10:00:05Z', content: [{ type: 'thinking', thinking: 'Consider anchoring.' }, { type: 'text', text: 'Here is a draft.' }] },
      ],
    },
  ];
  it('parses blocks, thinking and attachments', () => {
    assert.equal(detectFormat(JSON.stringify(conv)).kind, 'claude-export');
    const { bundle } = buildBundle(parseAny(JSON.stringify(conv), 'conversations.json')[0], NOW);
    assert.equal(bundle.title, 'Pricing page');
    assert.deepEqual(bundle.events.map((e) => e.kind), ['message', 'attachment', 'reasoning', 'message']);
    const att = bundle.artifacts.find((a) => a.path === 'attachments/notes.txt');
    assert.equal(att?.status, 'attached');
    assert.equal(att?.content, 'tiers: free, pro');
  });
});

describe('Claude Code JSONL', () => {
  const lines = [
    { type: 'user', sessionId: 's1', cwd: '/repo', gitBranch: 'main', uuid: 'u1', timestamp: '2026-10-11T10:00:00Z', message: { role: 'user', content: 'Add a greeting <system-reminder>secret harness context</system-reminder>' } },
    { type: 'assistant', sessionId: 's1', uuid: 'a1', timestamp: '2026-10-11T10:00:02Z', message: { model: 'claude-x', role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 'abc' }, { type: 'text', text: 'Creating the file.' }, { type: 'tool_use', id: 't1', name: 'Write', input: { file_path: '/repo/hello.ts', content: 'export const hi = "hello";\n' } }] } },
    { type: 'user', sessionId: 's1', uuid: 'u2', timestamp: '2026-10-11T10:00:03Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'File created' }] } },
    { type: 'assistant', sessionId: 's1', uuid: 'a2', timestamp: '2026-10-11T10:00:04Z', message: { model: 'claude-x', role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: '/repo/hello.ts', old_string: '"hello"', new_string: '"hello, baton"' } }, { type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'npm test', description: 'Run tests' } }] } },
    { type: 'user', sessionId: 's1', uuid: 'u3', isMeta: true, timestamp: '2026-10-11T10:00:05Z', message: { role: 'user', content: 'internal caveat' } },
  ].map((o) => JSON.stringify(o));

  it('parses, strips harness context and replays file edits', () => {
    const text = lines.join('\n');
    assert.equal(detectFormat(text, 'x.jsonl').kind, 'claude-code');
    const { bundle } = buildBundle(parseAny(text, 'x.jsonl')[0], NOW);
    assert.equal(bundle.source.cwd, '/repo');
    assert.equal(bundle.source.model, 'claude-x');
    assert.equal(bundle.events[0].text, 'Add a greeting');
    assert.ok(!JSON.stringify(bundle).includes('secret harness context'));
    assert.ok(!JSON.stringify(bundle).includes('internal caveat'), 'isMeta dropped by default');
    const f = bundle.artifacts.find((a) => a.path === 'hello.ts');
    assert.equal(f?.status, 'recovered');
    assert.equal(f?.content, 'export const hi = "hello, baton";\n');
    const tr = bundle.events.find((e) => e.kind === 'tool_result');
    assert.equal(tr?.tool?.name, 'Write');
    assert.ok(bundle.loss.some((l) => l.category === 'reasoning-depth'));
    assert.ok(bundle.loss.some((l) => l.category === 'harness-context'));
  });
});

describe('generic message logs', () => {
  it('parses [{role, content}] with tool calls', () => {
    const log = { title: 'API log', messages: [{ role: 'system', content: 'be nice' }, { role: 'user', content: 'weather?' }, { role: 'assistant', content: null, tool_calls: [{ id: 'c1', function: { name: 'get_weather', arguments: '{"city":"Pune"}' } }] }, { role: 'tool', tool_call_id: 'c1', name: 'get_weather', content: '31C' }, { role: 'assistant', content: 'It is 31C.' }] };
    const { bundle } = buildBundle(parseAny(JSON.stringify(log), 'log.json')[0], NOW);
    assert.deepEqual(bundle.events.map((e) => e.kind), ['message', 'tool_call', 'tool_result', 'message']);
    assert.ok(bundle.loss.some((l) => l.category === 'private-context'));
  });
  it('rejects unknown input clearly', () => {
    assert.throws(() => parseAny('just some text', 'notes.txt'), /Unsupported input/);
  });
});
