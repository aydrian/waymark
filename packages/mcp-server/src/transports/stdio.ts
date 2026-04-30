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
 *         "WAYMARK_ADMIN_TOKEN": "your-admin-token"
 *       }
 *     }
 *   }
 * }
 *
 * Optional: Set WAYMARK_BASE_URL to override the default production URL
 * (https://waymark.itsaydrian.com).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../server.js';

async function main() {
  // Validate required environment variable
  if (!process.env.WAYMARK_ADMIN_TOKEN) {
    console.error('Missing required environment variable: WAYMARK_ADMIN_TOKEN');
    console.error('Please set WAYMARK_ADMIN_TOKEN to your Waymark admin API token.');
    console.error('');
    console.error('Optional: Set WAYMARK_BASE_URL to override the default (https://waymark.itsaydrian.com)');
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
