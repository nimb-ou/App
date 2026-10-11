import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateRawSync, deflateRawSync } from 'node:zlib';
import { describe, it } from 'node:test';
import { sha256Hex } from '../src/core/sha256.ts';
import { crc32, listZip, unzipStored, unzipSync, zip } from '../src/core/zip.ts';
import { decodeTurboStream, extractEnqueuedChunks } from '../src/core/turbostream.ts';
import { Redactor } from '../src/core/redact.ts';
import { slugify, stableStringify, fence } from '../src/core/util.ts';
import { markdownToHtml } from '../src/render/mdlite.ts';

describe('sha256', () => {
  it('matches FIPS test vectors', () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('matches node:crypto on multi-block unicode input', () => {
    const s = 'Baton ⚡ ' + 'x'.repeat(1000) + ' — ünïcödé';
    assert.equal(sha256Hex(s), createHash('sha256').update(s).digest('hex'));
  });
});

describe('zip', () => {
  it('crc32 known value', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  });
  it('round-trips files with UTF-8 names', () => {
    const files = { 'a.txt': 'hello', 'dir/ü.md': '# hi\n', 'bin.dat': new Uint8Array([0, 1, 2, 255]) };
    const out = unzipStored(zip(files));
    assert.equal(new TextDecoder().decode(out['a.txt']), 'hello');
    assert.equal(new TextDecoder().decode(out['dir/ü.md']), '# hi\n');
    assert.deepEqual([...out['bin.dat']], [0, 1, 2, 255]);
  });
  it('reads deflated members via the central directory', () => {
    // Build a zip with one deflated member by hand (method 8).
    const data = new TextEncoder().encode('[{"title":"x","mapping":{}}]'.repeat(20));
    const comp = new Uint8Array(deflateRawSync(data));
    const stored = zip({ 'conversations.json': comp });
    // Patch method + uncompressed size in local and central headers.
    const v = new DataView(stored.buffer);
    v.setUint16(8, 8, true);
    v.setUint32(22, data.length, true);
    const cd = stored.length - 22 - (46 + 'conversations.json'.length);
    v.setUint16(cd + 10, 8, true);
    v.setUint32(cd + 24, data.length, true);
    assert.equal(listZip(stored)[0].method, 8);
    const out = unzipSync(stored, (d) => new Uint8Array(inflateRawSync(d)));
    assert.equal(new TextDecoder().decode(out['conversations.json']), new TextDecoder().decode(data));
  });
});

describe('turbo-stream', () => {
  it('decodes indexed objects, shared strings and sentinels', () => {
    const payload = [{ _1: 2, _3: -5, _4: 5 }, 'title', 'Hello', 'missing', 'list', [2, 6], 'World'];
    assert.deepEqual(decodeTurboStream(payload), { title: 'Hello', missing: undefined, list: ['Hello', 'World'] });
  });
  it('extracts enqueue chunks from HTML', () => {
    const html = '<script>window.__reactRouterContext.streamController.enqueue("[{\\"_1\\":2},\\"k\\",\\"v\\"]\\n");</script>';
    const chunks = extractEnqueuedChunks(html);
    assert.equal(chunks.length, 1);
    assert.deepEqual(decodeTurboStream(chunks[0].trim()), { k: 'v' });
  });
});

describe('redaction', () => {
  const r = new Redactor();
  const cases: [string, RegExp][] = [
    ['sk-ant-api03-abcdefghijklmnopqrstuvwxyz012345', /ANTHROPIC KEY/],
    ['sk-proj-abcdefghijklmnopqrstuvwxyz0123', /OPENAI KEY/],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123456789', /GITHUB TOKEN/],
    ['AKIAIOSFODNN7EXAMPLE', /AWS KEY/],
    ['jane.doe@acme.io', /EMAIL/],
    ['4111 1111 1111 1111', /CARD/],
    ['+1 415-555-1234', /PHONE/],
    ['Authorization: Bearer abcdefghijklmnopqrstuvwxyz.123', /BEARER/],
    ['-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----', /PRIVATE KEY/],
  ];
  for (const [input, label] of cases) it(`redacts ${label.source}`, () => assert.match(r.apply(input), label));
  it('leaves identifiers, decimals, dates and allowed emails alone', () => {
    for (const s of ['7907aff6-3500-4321-9387-607f9fa7562b', '0.014641999965533614', '2026-10-11 17:10', 'v1.32.1', 'noreply@anthropic.com', '4111 1111 1111 1112']) {
      assert.equal(r.apply(s), s, s);
    }
  });
  it('can be disabled', () => assert.equal(new Redactor(false).apply('jane@acme.io'), 'jane@acme.io'));
});

describe('util', () => {
  it('slugify', () => {
    assert.equal(slugify('Cricket Stumping Simulation!'), 'cricket-stumping-simulation');
    assert.equal(slugify('???'), 'conversation');
  });
  it('stableStringify sorts keys and drops undefined', () => {
    assert.equal(stableStringify({ b: 1, a: [2, { d: undefined, c: 3 }] }), '{"a":[2,{"c":3}],"b":1}');
  });
  it('fence avoids collisions', () => assert.match(fence('has ``` inside'), /^````/));
});

describe('mdlite (viewer safety)', () => {
  it('escapes raw HTML and scripts', () => {
    const html = markdownToHtml('hi <script>alert(1)</script> <img src=x onerror=alert(1)>');
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img'));
    assert.match(html, /&lt;script&gt;/);
  });
  it('does not create javascript: links', () => {
    const html = markdownToHtml('[x](javascript:alert(1)) [y](https://ok.example)');
    assert.ok(!html.includes('href="javascript:'));
    assert.match(html, /href="https:\/\/ok\.example"/);
  });
  it('renders tables, lists, code and details', () => {
    const html = markdownToHtml('| a | b |\n|---|---|\n| 1 | 2 |\n\n- x\n- y\n\n```js\nlet a = "<b>";\n```\n<details><summary>Tool call: <code>Bash</code></summary>\n\nbody\n\n</details>');
    assert.match(html, /<table>/);
    assert.match(html, /<ul><li>x<\/li><li>y<\/li><\/ul>/);
    assert.match(html, /&lt;b&gt;/);
    assert.match(html, /<details><summary>Tool call: <code>Bash<\/code><\/summary>/);
  });
});

describe('custom redaction terms', () => {
  it('redacts literal terms case-insensitively and escapes regex characters', () => {
    const r = new Redactor(true, undefined, ['Acme Corp', 'proj.x(1)', 'ab']);
    assert.equal(r.apply('acme corp ships proj.x(1) and projAx(1)'), '[REDACTED:TERM1] ships [REDACTED:TERM2] and projAx(1)');
    assert.equal(r.counts.custom, 2);
  });
});
