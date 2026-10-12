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

// The public Baton server the extension sends handoffs to by default (override: BATON_RELAY_URL, or Options).
const relay = test ? '' : (process.env.BATON_RELAY_URL ?? 'https://baton-relay.nimitjain-248.workers.dev').replace(/\/$/, '');
const icons = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png', 48: 'icons/icon-48.png', 128: 'icons/icon-128.png' };

const manifest = {
  manifest_version: 3,
  name: 'Baton: move AI chats between ChatGPT, Claude & Gemini',
  short_name: 'Baton',
  version: '0.4.0',
  description: 'Continue any ChatGPT, Claude or Gemini chat in another AI, with the prompts, tool outputs and files, and a list of what didn\'t transfer.',
  minimum_chrome_version: '111',
  icons,
  permissions: ['storage', 'unlimitedStorage'],
  host_permissions: [...matches, 'https://*.oaiusercontent.com/*', 'https://*.openai.com/*', ...(relay ? [relay + '/*'] : [])],
  optional_host_permissions: ['https://*/*', 'http://localhost/*'],
  background: { service_worker: 'background.js' },
  action: { default_title: 'Baton', default_icon: icons },
  options_page: 'options.html',
  content_scripts: [
    { matches, js: ['tap.js'], run_at: 'document_start', world: 'MAIN' },
    { matches, js: ['content.js'], run_at: 'document_idle' },
  ],
};

const common = { bundle: true, format: 'iife', target: 'chrome111', minify: !test, legalComments: 'none', logLevel: 'warning', define: { __BATON_RELAY__: JSON.stringify(relay) } };
await build({ ...common, entryPoints: { content: root + 'extension/src/content.ts', tap: root + 'extension/src/tap.ts', background: root + 'extension/src/background.ts', options: root + 'extension/src/options.ts' }, outdir: out });
writeFileSync(out + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
copyFileSync(root + 'extension/static/options.html', out + 'options.html');
mkdirSync(out + 'icons', { recursive: true });
for (const f of Object.values(icons)) copyFileSync(root + 'extension/static/' + f, out + f);
if (!test) {
  // Downloadable package: unzip, then chrome://extensions → Developer mode → Load unpacked.
  const { zip } = await import(root + 'src/core/zip.ts');
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const files = {};
  const walk = (dir, rel = '') => {
    for (const f of readdirSync(dir)) {
      if (statSync(dir + f).isDirectory()) walk(dir + f + '/', rel + f + '/');
      else files[`baton-extension/${rel}${f}`] = new Uint8Array(readFileSync(dir + f));
    }
  };
  walk(out);
  writeFileSync(root + 'extension/baton-extension.zip', zip(files, new Date('2026-01-01T00:00:00Z')));
}
console.log(`extension → ${out.replace(root, '')}`);
