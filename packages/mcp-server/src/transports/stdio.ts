#!/usr/bin/env node
/**
 * Stdio transport for Waymark MCP Server
 *
 * This is the entry point for Claude Desktop integration.
 * Usage in Claude Desktop config:
 * {
 *   "mcpServers": {
 *     "waymark": {
 *       "command": "bun",
 *       "args": ["/path/to/waymark/packages/mcp-server/src/transports/stdio.ts"],
 *       "env": {
 *         "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
 *         "CLOUDFLARE_KV_NAMESPACE_ID": "your-namespace-id",
 *         "CLOUDFLARE_API_TOKEN": "your-api-token"
 *       }
 *     }
 *   }
 * }
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../server.js';

async function main() {
  // Validate environment variables
  const requiredEnvVars = [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_KV_NAMESPACE_ID',
    'CLOUDFLARE_API_TOKEN',
  ];

  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please set these variables before running the MCP server.');
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('Waymark MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
