// Regenerate examples/ from committed fixtures (deterministic: fixed timestamp).
import { readFileSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { writeFiles, writeZip } from '../src/node/io.ts';
import { convert } from '../src/pipeline.ts';

const root = new URL('..', import.meta.url).pathname;
const html = gunzipSync(readFileSync(root + 'fixtures/chatgpt-share-cricket-stumping.html.gz')).toString('utf8');
const [r] = convert(html, 'share.html', {
  url: 'https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388',
  now: '2026-10-11T17:06:47Z',
  sinks: ['salesforce', 'jira', 'zendesk', 'slack'],
  sinkOptions: { jiraProject: 'DEMO' },
});
const out = root + 'examples/cricket-stumping';
rmSync(out, { recursive: true, force: true });
writeFiles(out, r.files);
writeZip(root + 'examples/cricket-stumping.baton.zip', r.files, r.slug);
console.log(`examples/cricket-stumping: ${Object.keys(r.files).length} files, root ${r.bundle.integrity.root}`);
