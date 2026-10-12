import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBundle } from '../src/core/build.ts';
import { adapterFor, chatgpt, claude, type Net } from '../extension/src/adapters.ts';

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64');

function mockNet(routes: Record<string, unknown>, binaries: Record<string, { body: Buffer | string; type: string }>, seen: string[] = []): Net {
  return {
    async json(url, init) {
      seen.push(`${url} ${init?.headers?.authorization ?? ''}`.trim());
      const key = Object.keys(routes).find((k) => url.startsWith(k));
      if (!key) throw new Error(`HTTP 404 ${url}`);
      const v = routes[key];
      return typeof v === 'function' ? (v as (u: string) => unknown)(url) : v;
    },
    async binary(url) {
      const b = binaries[url];
      if (!b) throw new Error('HTTP 403');
      return { base64: b64(b.body), type: b.type, size: Buffer.from(b.body).length };
    },
  };
}

const doc = {} as Document;

describe('site detection', () => {
  it('maps hosts to adapters', () => {
    assert.equal(adapterFor(new URL('https://chatgpt.com/c/abc')).id, 'chatgpt');
    assert.equal(adapterFor(new URL('https://claude.ai/chat/x')).id, 'claude');
    assert.equal(adapterFor(new URL('https://gemini.google.com/app/1')).id, 'gemini');
    assert.equal(adapterFor(new URL('https://example.com/')).id, 'dom');
    assert.equal(chatgpt.conversationId(new URL('https://chatgpt.com/g/g-abc/c/6acbc222-2500-83ee-b38c-dcfe2b46e388')), '6acbc222-2500-83ee-b38c-dcfe2b46e388');
  });
});

describe('ChatGPT in-page capture', () => {
  const CONV = '6acbc222-2500-83ee-b38c-dcfe2b46e388';
  const conv = {
    title: 'Live',
    current_node: 'b',
    mapping: {
      r: { id: 'r', parent: null, children: ['a'], message: null },
      a: { id: 'a', parent: 'r', children: ['t'], message: { id: 'a', author: { role: 'user' }, content: { content_type: 'text', parts: ['make a chart'] }, metadata: { attachments: [{ id: 'file-1', name: 'data.csv' }] } } },
      t: { id: 't', parent: 'a', children: ['b'], message: { id: 't', author: { role: 'tool', name: 'python' }, content: { content_type: 'execution_output', text: 'saved chart.png' } } },
      b: { id: 'b', parent: 't', children: [], message: { id: 'b', author: { role: 'assistant' }, content: { content_type: 'text', parts: ['[chart](sandbox:/mnt/data/chart.png) [gone](sandbox:/mnt/data/old.zip)'] } } },
    },
  };
  it('captures tool outputs, sandbox files and uploads; reports what failed', async () => {
    const seen: string[] = [];
    const net = mockNet(
      {
        '/api/auth/session': { accessToken: 'T' },
        [`/backend-api/conversation/${CONV}/interpreter/download`]: (u: string) => (u.includes('chart.png') ? { download_url: 'https://files.example/chart' } : { error_code: 'sandbox_expired' }),
        [`/backend-api/conversation/${CONV}`]: conv,
        '/backend-api/files/file-1/download': { download_url: 'https://files.example/data' },
      },
      { 'https://files.example/chart': { body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]), type: 'image/png' }, 'https://files.example/data': { body: 'x,y\n1,2\n', type: 'text/csv' } },
      seen,
    );
    const res = await chatgpt.capture({ url: new URL(`https://chatgpt.com/c/${CONV}`), net, doc });
    assert.ok(seen.some((s) => s.endsWith('Bearer T')));
    assert.equal(res.captured, 2);
    assert.equal(res.failed.length, 1);
    const { bundle } = buildBundle(res.parsed, { now: '2026-01-01T00:00:00Z' });
    assert.equal(bundle.events.find((e) => e.kind === 'tool_result')?.text, 'saved chart.png');
    const chart = bundle.artifacts.find((a) => a.path === 'chart.png')!;
    assert.equal(chart.encoding, 'base64');
    assert.equal(chart.status, 'recovered');
    assert.equal(bundle.artifacts.find((a) => a.path === 'uploads/data.csv')?.content, 'x,y\n1,2\n', 'text uploads stay utf8');
    assert.equal(bundle.artifacts.find((a) => a.path === 'old.zip')?.status, 'lost');
    assert.ok(bundle.loss.some((l) => l.category === 'files-not-captured' && /sandbox_expired/.test(l.detail)));
  });
  it('explains when not on a conversation or signed out', async () => {
    await assert.rejects(chatgpt.capture({ url: new URL('https://chatgpt.com/'), net: mockNet({}, {}), doc }), /Open a saved ChatGPT conversation/);
    await assert.rejects(chatgpt.capture({ url: new URL(`https://chatgpt.com/c/${CONV}`), net: mockNet({ '/api/auth/session': {} }, {}), doc }), /Not signed in/);
  });
});

describe('Claude in-page capture', () => {
  it('captures tool use, artifacts and created files from the full conversation API', async () => {
    const id = '0f0e0d0c-0b0a-0908-0706-050403020100';
    const conv = {
      uuid: id,
      name: 'Landing page',
      chat_messages: [
        { uuid: 'h1', sender: 'human', content: [{ type: 'text', text: 'Build a landing page' }] },
        {
          uuid: 'a1',
          sender: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Hero first.' },
            { type: 'tool_use', name: 'artifacts', input: { command: 'create', id: 'landing', type: 'text/html', title: 'Landing', content: '<h1>Hi</h1>' } },
            { type: 'tool_use', name: 'artifacts', input: { command: 'update', id: 'landing', old_str: 'Hi', new_str: 'Hello' } },
            { type: 'tool_use', name: 'create_file', input: { path: '/mnt/user-data/outputs/notes.md', file_text: '# Notes\n' } },
            { type: 'tool_result', name: 'create_file', content: [{ type: 'text', text: 'File created' }] },
            { type: 'text', text: 'Done.' },
          ],
        },
      ],
    };
    const net = mockNet({ '/api/organizations/org-1/chat_conversations/': conv, '/api/organizations': [{ uuid: 'org-1', capabilities: ['chat'] }] }, {});
    const res = await claude.capture({ url: new URL(`https://claude.ai/chat/${id}`), net, doc });
    const { bundle } = buildBundle(res.parsed, { now: '2026-01-01T00:00:00Z' });
    assert.equal(bundle.title, 'Landing page');
    assert.equal(bundle.artifacts.find((a) => a.path === 'landing.html')?.content, '<h1>Hello</h1>');
    assert.equal(bundle.artifacts.find((a) => a.path === 'notes.md')?.content, '# Notes\n');
    assert.equal(bundle.stats.reasoningBlocks, 1);
  });
});
