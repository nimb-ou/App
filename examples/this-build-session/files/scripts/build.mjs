// Build:
//   dist/baton.mjs                      single-file CLI (runs on Node ≥18 without TypeScript support)
//   skills/baton/scripts/baton.mjs      same file, shipped inside the Agent Skill
//   web/dist/baton.html                 standalone web app (full document, works from file:// or any static host)
//   web/dist/artifact.html              same app as body content for the claude.ai Artifact viewer
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;

await build({
  entryPoints: [root + 'src/bin.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outfile: root + 'dist/baton.mjs',
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
});
mkdirSync(root + 'skills/baton/scripts', { recursive: true });
copyFileSync(root + 'dist/baton.mjs', root + 'skills/baton/scripts/baton.mjs');

// Embed the real public share used throughout the docs as the example the page opens with.
const html = gunzipSync(readFileSync(root + 'fixtures/chatgpt-share-cricket-stumping.html.gz')).toString('utf8');
const m = html.match(/streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/);
const sample = m ? JSON.parse(m[1]).split('\n')[0] : '';

const res = await build({
  entryPoints: [root + 'web/app.ts'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
  write: false,
  legalComments: 'none',
  define: { __SAMPLE__: JSON.stringify(sample), __SAMPLE_URL__: JSON.stringify('https://chatgpt.com/share/6acbc222-2500-83ee-b38c-dcfe2b46e388') },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const page = readFileSync(root + 'web/page.html', 'utf8').replace('/*__APP__*/', () => js);
mkdirSync(root + 'web/dist', { recursive: true });
writeFileSync(root + 'web/dist/artifact.html', page);
writeFileSync(
  root + 'web/dist/baton.html',
  `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n${page}\n</body></html>\n`,
);
const kb = (p) => (readFileSync(root + p).length / 1024).toFixed(0) + ' KB';
console.log(`dist/baton.mjs ${kb('dist/baton.mjs')} · web/dist/baton.html ${kb('web/dist/baton.html')}`);
