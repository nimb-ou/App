import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { handleMessage } from '../src/mcp/server.ts';
import { writeFiles, isShareUrl } from '../src/node/io.ts';
import { convert } from '../src/pipeline.ts';
import { buildSink } from '../src/sinks/index.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const FIXTURE = join(ROOT, 'fixtures/chatgpt-share-cricket-stumping.html.gz');
const tmp = mkdtempSync(join(tmpdir(), 'baton-test-'));
process.env.BATON_STORE = join(tmp, 'store');
after(() => rmSync(tmp, { recursive: true, force: true }));

const html = gunzipSync(readFileSync(FIXTURE)).toString('utf8');
const [cricket] = convert(html, 'share.html', { url: 'https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388', now: '2026-10-11T00:00:00Z', sinks: ['jira', 'salesforce', 'zendesk', 'slack'] });

describe('bundle layout', () => {
  it('contains every surface file', () => {
    for (const f of ['HANDOFF.md', 'PROMPT.md', 'TRANSCRIPT.md', 'LOSS_AUDIT.md', 'AGENTS.md', 'SKILL.md', 'index.html', 'bundle.json', 'replay/run-in-docker.sh', 'sinks/jira.json']) {
      assert.ok(f in cricket.files, f);
    }
    assert.ok('files/stumping_research_package/paper.md' in cricket.files);
  });
  it('HANDOFF.md carries goal, prompts, state and loss', () => {
    const h = String(cricket.files['HANDOFF.md']);
    assert.match(h, /^---\nbaton: baton\.bundle\/v1/);
    assert.match(h, /## 1\. Original goal/);
    assert.match(h, /8\. \*[^*]+\*: It is connevted/);
    assert.match(h, /403 Resource not accessible by integration/);
    assert.match(h, /\| lost \| `stumping_research_package\/app\.py`/);
  });
  it('SKILL.md has valid Agent Skill front matter', () => {
    const s = String(cricket.files['SKILL.md']);
    const name = s.match(/^---\nname: ([a-z0-9-]+)\n/)?.[1];
    assert.equal(name, 'continue-cricket-stumping-simulation');
    assert.ok(name!.length <= 64);
    const desc = s.match(/\ndescription: "(.*)"\n---/)?.[1] ?? '';
    assert.ok(desc.length > 50 && desc.length <= 1024);
  });
  it('PROMPT.md stays within its paste budget', () => {
    assert.ok(String(cricket.files['PROMPT.md']).length < 14000);
  });
  it('index.html escapes conversation content', () => {
    const [b] = convert(JSON.stringify([{ role: 'user', content: 'hi <script>alert("x")</script>' }, { role: 'assistant', content: 'ok' }]), 'x.json');
    const page = String(b.files['index.html']);
    assert.ok(!page.includes('<script>alert'));
    assert.match(page, /&lt;script&gt;alert/);
  });
});

describe('sinks', () => {
  const b = cricket.bundle;
  it('jira uses ADF and labels', () => {
    const p = buildSink('jira', b, { jiraProject: 'OPS' }) as { body: { fields: { project: { key: string }; description: { type: string; content: unknown[] }; labels: string[] } } };
    assert.equal(p.body.fields.project.key, 'OPS');
    assert.equal(p.body.fields.description.type, 'doc');
    assert.ok(p.body.fields.labels.includes('baton-handoff'));
  });
  it('salesforce composite links note and tasks to the case', () => {
    const p = buildSink('salesforce', b) as { path: string; body: { compositeRequest: { referenceId: string; body: Record<string, string> }[] } };
    assert.match(p.path, /\/composite$/);
    const refs = p.body.compositeRequest.map((r) => r.referenceId);
    assert.deepEqual(refs.slice(0, 3), ['case', 'note', 'link']);
    assert.equal(p.body.compositeRequest[2].body.LinkedEntityId, '@{case.id}');
    assert.equal(p.body.compositeRequest[0].body.Priority, 'High');
  });
  it('salesforce can attach to an existing record', () => {
    const p = buildSink('salesforce', b, { salesforceParentId: '006xx0000012345' }) as { body: { compositeRequest: { referenceId: string; body: Record<string, string> }[] } };
    assert.equal(p.body.compositeRequest[0].referenceId, 'note');
    assert.equal(p.body.compositeRequest[1].body.LinkedEntityId, '006xx0000012345');
  });
  it('zendesk is an internal note; slack has blocks', () => {
    const z = buildSink('zendesk', b) as { body: { ticket: { comment: { public: boolean } } } };
    assert.equal(z.body.ticket.comment.public, false);
    const s = buildSink('slack', b) as { body: { blocks: { type: string }[] } };
    assert.equal(s.body.blocks[0].type, 'header');
  });
});

describe('node io safety', () => {
  it('refuses to write outside the output directory', () => {
    assert.throws(() => writeFiles(join(tmp, 'out'), { '../evil.txt': 'x' }), /Refusing to write outside/);
    assert.ok(!existsSync(join(tmp, 'evil.txt')));
  });
  it('only fetches public ChatGPT share URLs', () => {
    assert.ok(isShareUrl('https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388'));
    assert.ok(!isShareUrl('https://chatgpt.com/c/6acbc222'));
    assert.ok(!isShareUrl('http://chatgpt.com/share/abc'));
    assert.ok(!isShareUrl('https://evil.example/share/abc'));
  });
});

describe('MCP server', () => {
  it('initializes and lists tools', async () => {
    const init = (await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })) as { result: { protocolVersion: string; serverInfo: { name: string } } };
    assert.equal(init.result.protocolVersion, '2025-03-26');
    assert.equal(init.result.serverInfo.name, 'baton');
    const list = (await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as { result: { tools: { name: string; inputSchema: object }[] } };
    assert.deepEqual(list.result.tools.map((t) => t.name), ['baton_import', 'baton_session', 'baton_inspect', 'baton_read_turn', 'baton_verify', 'baton_sink', 'baton_checkpoint', 'baton_pickup', 'baton_get_file', 'baton_list']);
    assert.equal(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined);
  });
  it('imports via tools/call and reports errors as tool results', async () => {
    const out = join(tmp, 'mcp-out');
    const res = (await handleMessage({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'baton_import', arguments: { source: FIXTURE, out_dir: out } } })) as { result: { content: { text: string }[] } };
    assert.match(res.result.content[0].text, /13 recovered · 3 stale · 16 lost/);
    assert.ok(existsSync(join(out, 'HANDOFF.md')));
    const bad = (await handleMessage({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'baton_import', arguments: { source: '/nope' } } })) as { result: { isError: boolean } };
    assert.equal(bad.result.isError, true);
  });
});

describe('CLI (end to end)', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [join(ROOT, 'src/bin.ts'), ...args], { encoding: 'utf8', cwd: tmp });
  it('imports, zips, verifies, and detects tampering', () => {
    const out = join(tmp, 'cli-out');
    const r = run('import', FIXTURE, '-o', out, '--zip', '--now', '2026-10-11T00:00:00Z');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /13 recovered · 3 stale · 16 lost/);
    assert.equal(run('verify', out).status, 0);
    assert.equal(run('verify', `${out}.zip`).status, 0);
    writeFileSync(join(out, 'files/stumping_research_package/LICENSE'), 'changed');
    const v = run('verify', out);
    assert.equal(v.status, 2);
    assert.match(v.stdout, /altered files: stumping_research_package\/LICENSE/);
  });
  it('prints help and fails cleanly on bad input', () => {
    assert.match(run('help').stdout, /baton import <source>/);
    const bad = run('import', 'https://example.com/whatever');
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /Only public ChatGPT share links/);
  });
});
