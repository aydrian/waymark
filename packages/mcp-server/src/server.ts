import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { tripTools } from './tools/trips.js';
import { poiTools } from './tools/pois.js';
import { assignmentTools } from './tools/assignments.js';
import { createAdminApiBackend } from './backends/admin-api.js';
import type { WaymarkBackend } from './backends/types.js';

// Combine all tools
const allTools: Tool[] = [
  ...tripTools,
  ...poiTools,
  ...assignmentTools,
];

export type WaymarkMCPServer = Server;

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
export function createServer(): Server {
  const server = new Server(
    {
      name: 'waymark-mcp-server',
      version: '0.1.2',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  // Register tool call handler with all tool implementations
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Check for admin token
    if (!process.env.WAYMARK_ADMIN_TOKEN) {
      return {
        content: [
          {
            type: 'text',
            text: 'Configuration error: WAYMARK_ADMIN_TOKEN is not set. Please set your Waymark admin API token.',
          },
        ],
        isError: true,
      };
    }

    // Create the admin API backend
    const backend = createBackend();

    // Route to appropriate tool handler
    try {
      // Trip tools
      const tripResult = await handleTripTool(name, args, backend);
      if (tripResult !== undefined) return tripResult;

      // POI tools
      const poiResult = await handlePoiTool(name, args, backend);
      if (poiResult !== undefined) return poiResult;

      // Assignment tools
      const assignmentResult = await handleAssignmentTool(name, args, backend);
      if (assignmentResult !== undefined) return assignmentResult;

      // Unknown tool
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// Import tool handlers
import { handleTripTool } from './tools/trips.js';
import { handlePoiTool } from './tools/pois.js';
import { handleAssignmentTool } from './tools/assignments.js';
