import { GraphQLClient } from 'graphql-request';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { XpClient } from './xp-client.js';
import { buildServer } from './server.js';

async function main() {
  const endpoint = process.env.XP_API_URL ?? 'https://xp-monorepo.onrender.com/graphql';
  const gql = new GraphQLClient(endpoint);
  const client = new XpClient(gql);
  const server = buildServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio servers must not write to stdout (it carries the protocol).
  console.error(`xp-mcp-server connected to ${endpoint}`);
}

main().catch((err) => {
  console.error('xp-mcp-server failed to start:', err);
  process.exit(1);
});
