// One-command relay deploy to Cloudflare Workers + KV.
//   CLOUDFLARE_API_TOKEN=… node scripts/deploy-relay.mjs     (token: "Edit Cloudflare Workers" template)
// Creates (or reuses) the BATON_KV namespace, deploys worker/index.ts, sets a random BATON_MCP_SECRET,
// checks /healthz and prints the URLs to paste into Claude and ChatGPT. Re-running is safe.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN (Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template).');
  process.exit(1);
}
const wrangler = (args, input) =>
  execFileSync('npx', ['-y', 'wrangler@4', ...args], { cwd: root, encoding: 'utf8', input, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } });

// 1. KV namespace (reuse by title).
const list = JSON.parse(wrangler(['kv', 'namespace', 'list']).trim() || '[]');
let ns = list.find((n) => n.title === 'baton-relay-BATON_KV' || n.title === 'BATON_KV');
if (!ns) {
  const out = wrangler(['kv', 'namespace', 'create', 'BATON_KV']);
  const id = out.match(/"?id"?\s*[:=]\s*"([0-9a-f]{32})"/)?.[1];
  if (!id) throw new Error(`Could not read the new namespace id from:\n${out}`);
  ns = { id };
}
console.log(`KV namespace: ${ns.id}`);

// 2. Deploy with a generated config that carries the id (wrangler.jsonc stays account-neutral).
const base = JSON.parse(readFileSync(root + 'wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
base.kv_namespaces = [{ binding: 'BATON_KV', id: ns.id }];
const cfg = root + '.wrangler.deploy.json';
writeFileSync(cfg, JSON.stringify(base, null, 2));
const deployed = wrangler(['deploy', '--config', cfg]);
const url = deployed.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0];
if (!url) throw new Error(`Deploy finished but no workers.dev URL was printed:\n${deployed}`);
console.log(`Deployed: ${url}`);

// 3. Secret MCP path (kept in .baton-relay.json locally; re-used on re-deploys).
const statePath = root + '.baton-relay.json';
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
state.secret ??= randomBytes(16).toString('hex');
wrangler(['secret', 'put', 'BATON_MCP_SECRET', '--config', cfg], state.secret + '\n');
state.url = url;
writeFileSync(statePath, JSON.stringify(state, null, 2));

// 4. Smoke test.
const health = await fetch(`${url}/healthz`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
const mcp = `${url}/mcp/${state.secret}`;
const tools = await fetch(mcp, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
  .then((r) => r.json())
  .then((j) => j.result.tools.map((t) => t.name).join(', '))
  .catch((e) => `error: ${e}`);
console.log(`\nhealth: ${JSON.stringify(health)}\ntools : ${tools}\n`);
console.log(`MCP URL (Claude connector / ChatGPT developer mode):\n  ${mcp}\n`);
console.log(`Extension → Options → Relay URL:\n  ${url}\n`);
