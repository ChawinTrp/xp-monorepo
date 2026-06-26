import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { XpClient } from './xp-client.js';
import { toolDefinitions } from './tools.js';

export function buildServer(client: XpClient): McpServer {
  const server = new McpServer({ name: 'xp-mcp-server', version: '0.1.0' });

  for (const def of toolDefinitions) {
    const handler = async (args: Record<string, any>) => {
      try {
        const text = await def.handler(client, args);
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
        };
      }
    };

    // Cast at the registration boundary: the SDK's registerTool infers deeply
    // through the generic ZodRawShape, which trips TS2589 (instantiation too
    // deep). The runtime contract is exercised by the tools.test.ts suite.
    (server.registerTool as any)(
      def.name,
      { description: def.description, inputSchema: def.inputSchema },
      handler,
    );
  }

  return server;
}
