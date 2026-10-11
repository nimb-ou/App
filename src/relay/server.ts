// Node host for the portable relay handler (src/relay/handler.ts), backed by the file store.
// Env: PORT, BATON_STORE, BATON_PUBLIC_URL, BATON_RELAY_TOKEN, BATON_MCP_SECRET, BATON_TTL_DAYS, BATON_MAX_BYTES.

import { createServer, type IncomingMessage } from 'node:http';
import { VERSION } from '../core/schema.ts';
import { createRelayHandler } from './handler.ts';
import { RelayStore } from './store.ts';

export interface RelayServerOptions {
  port?: number;
  host?: string;
  store?: RelayStore;
  publicUrl?: string;
  token?: string;
  mcpSecret?: string;
  rateLimitPerMinute?: number;
  log?: (msg: string) => void;
}

async function toRequest(req: IncomingMessage, origin: string): Promise<Request> {
  const chunks: Buffer[] = [];
  if (req.method !== 'GET' && req.method !== 'HEAD') for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  if (!headers.has('x-forwarded-for') && req.socket.remoteAddress) headers.set('x-forwarded-for', req.socket.remoteAddress);
  return new Request(origin + (req.url ?? '/'), { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
}

export function createRelayServer(o: RelayServerOptions = {}) {
  const store = o.store ?? new RelayStore();
  const handler = createRelayHandler({
    store,
    publicUrl: o.publicUrl ?? process.env.BATON_PUBLIC_URL,
    token: o.token ?? process.env.BATON_RELAY_TOKEN,
    mcpSecret: o.mcpSecret ?? process.env.BATON_MCP_SECRET,
    rateLimitPerMinute: o.rateLimitPerMinute,
    log: o.log,
  });
  const mcpPath = (o.mcpSecret ?? process.env.BATON_MCP_SECRET) ? `/mcp/${o.mcpSecret ?? process.env.BATON_MCP_SECRET}` : '/mcp';
  const server = createServer(async (req, res) => {
    try {
      const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0];
      const response = await handler(await toRequest(req, `${proto}://${req.headers.host ?? 'localhost'}`));
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });
  const timer = setInterval(() => void store.purgeExpired(), 3600000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return { server, store, mcpPath };
}

export function startRelay(o: RelayServerOptions = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const { server, mcpPath } = createRelayServer(o);
  const port = o.port ?? Number(process.env.PORT ?? 8787);
  return new Promise((resolve) => {
    server.listen(port, o.host ?? '0.0.0.0', () => {
      const addr = server.address();
      const actual = typeof addr === 'object' && addr ? addr.port : port;
      const url = `http://localhost:${actual}`;
      (o.log ?? console.error)(`Baton relay ${VERSION} listening on ${url} · MCP at ${url}${mcpPath}`);
      resolve({ url, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
