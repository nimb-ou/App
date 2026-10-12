// Transport-independent MCP (JSON-RPC 2.0) handling, shared by the stdio server and the HTTP relay.

export const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export interface ToolContext {
  clientName: string; // from initialize.clientInfo.name
}

export interface Tool {
  name: string;
  title?: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

export interface ServerInfo {
  name: string;
  version: string;
  instructions: string;
}

type Json = Record<string, unknown>;

export interface McpSession {
  clientName: string;
}

export async function handleRpc(msg: Json, tools: Tool[], info: ServerInfo, session: McpSession): Promise<Json | undefined> {
  const id = msg.id as string | number | undefined;
  const method = msg.method as string | undefined;
  const reply = (result: unknown): Json => ({ jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string): Json => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (method === 'initialize') {
    const params = (msg.params ?? {}) as Json;
    const ci = params.clientInfo as Json | undefined;
    if (ci && typeof ci.name === 'string') session.clientName = ci.name;
  }
  if (id === undefined || id === null) return undefined; // notification

  switch (method) {
    case 'initialize': {
      const requested = (msg.params as Json | undefined)?.protocolVersion as string | undefined;
      return reply({
        protocolVersion: requested && SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: info.name, version: info.version },
        instructions: info.instructions,
      });
    }
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: tools.map(({ run: _r, ...t }) => t) });
    case 'tools/call': {
      const params = (msg.params ?? {}) as Json;
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) return fail(-32602, `Unknown tool: ${String(params.name)}`);
      try {
        const text = await tool.run((params.arguments ?? {}) as Record<string, unknown>, { clientName: session.clientName });
        return reply({ content: [{ type: 'text', text }] });
      } catch (err) {
        return reply({ content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true });
      }
    }
    case 'resources/list':
      return reply({ resources: [] });
    case 'resources/templates/list':
      return reply({ resourceTemplates: [] });
    case 'prompts/list':
      return reply({ prompts: [] });
    default:
      return fail(-32601, `Method not found: ${String(method)}`);
  }
}
