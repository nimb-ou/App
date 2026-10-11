// Build the MV3 extension into extension/dist (load it via chrome://extensions → "Load unpacked").
// `--test` builds extension/dist-test, which also matches http://127.0.0.1 for the end-to-end harness.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const test = process.argv.includes('--test');
const out = root + (test ? 'extension/dist-test/' : 'extension/dist/');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const sites = ['https://chatgpt.com/*', 'https://chat.openai.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*'];
const matches = test ? [...sites, 'http://127.0.0.1/*'] : sites;

const manifest = {
  manifest_version: 3,
  name: 'Baton: carry AI work between assistants',
  short_name: 'Baton',
  version: '0.3.0',
  description: 'Capture a conversation inside ChatGPT, Claude or Gemini (prompts, tool outputs, generated files) and continue it in another AI.',
  minimum_chrome_version: '111',
  permissions: ['storage', 'unlimitedStorage'],
  host_permissions: [...matches, 'https://*.oaiusercontent.com/*', 'https://*.openai.com/*'],
  optional_host_permissions: ['https://*/*', 'http://localhost/*'],
  background: { service_worker: 'background.js' },
  action: { default_title: 'Baton' },
  options_page: 'options.html',
  content_scripts: [
    { matches, js: ['tap.js'], run_at: 'document_start', world: 'MAIN' },
    { matches, js: ['content.js'], run_at: 'document_idle' },
  ],
};

const common = { bundle: true, format: 'iife', target: 'chrome111', minify: !test, legalComments: 'none', logLevel: 'warning' };
await build({ ...common, entryPoints: { content: root + 'extension/src/content.ts', tap: root + 'extension/src/tap.ts', background: root + 'extension/src/background.ts', options: root + 'extension/src/options.ts' }, outdir: out });
writeFileSync(out + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
copyFileSync(root + 'extension/static/options.html', out + 'options.html');
if (!test) {
  // Downloadable package: unzip, then chrome://extensions → Developer mode → Load unpacked.
  const { zip } = await import(root + 'src/core/zip.ts');
  const { readdirSync, readFileSync } = await import('node:fs');
  const files = {};
  for (const f of readdirSync(out)) files[`baton-extension/${f}`] = new Uint8Array(readFileSync(out + f));
  writeFileSync(root + 'extension/baton-extension.zip', zip(files, new Date('2026-01-01T00:00:00Z')));
}
console.log(`extension → ${out.replace(root, '')}`);
