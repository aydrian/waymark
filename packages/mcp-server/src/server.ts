import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTripTools } from './tools/trips.js';
import { registerPoiTools } from './tools/pois.js';
import { registerAssignmentTools } from './tools/assignments.js';
import { createAdminApiBackend } from './backends/admin-api.js';
import type { WaymarkBackend } from './backends/types.js';

export type WaymarkMCPServer = McpServer;

/**
 * Create the admin API backend with environment configuration
 */
function createBackend(): WaymarkBackend {
  const baseUrl = (process.env.WAYMARK_BASE_URL || 'https://waymark.itsaydrian.com').replace(/\/$/, '');
  const authToken = process.env.WAYMARK_ADMIN_TOKEN || '';
  return createAdminApiBackend({ baseUrl, authToken });
}

/**
 * Create an MCP server instance with all Waymark tools registered
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'waymark-mcp-server',
    version: '0.1.6',
  });

  // Register all tool modules
  registerTripTools(server, createBackend);
  registerPoiTools(server, createBackend);
  registerAssignmentTools(server, createBackend);

  return server;
}
