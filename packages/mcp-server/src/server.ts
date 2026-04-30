import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { tripTools, registerTripTools } from './tools/trips.js';
import { poiTools, registerPoiTools } from './tools/pois.js';
import { assignmentTools, registerAssignmentTools } from './tools/assignments.js';
import { createKVBackend } from './backends/kv.js';
import { createAdminApiBackend } from './backends/admin-api.js';
import type { WaymarkBackend } from './backends/types.js';

// Environment configuration schemas
const KVConfigSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  CLOUDFLARE_KV_NAMESPACE_ID: z.string(),
  CLOUDFLARE_API_TOKEN: z.string(),
});

const AdminApiConfigSchema = z.object({
  WAYMARK_BASE_URL: z.string().url(),
  WAYMARK_ADMIN_TOKEN: z.string(),
});

// Combine all tools
const allTools: Tool[] = [
  ...tripTools,
  ...poiTools,
  ...assignmentTools,
];

export type WaymarkMCPServer = Server;

/**
 * Detect which backend mode to use based on available environment variables
 */
function detectBackendMode(): { mode: 'kv'; config: z.infer<typeof KVConfigSchema> } | { mode: 'admin-api'; config: z.infer<typeof AdminApiConfigSchema> } | null {
  // Check for admin API mode first (preferred for agents)
  const adminApiResult = AdminApiConfigSchema.safeParse(process.env);
  if (adminApiResult.success) {
    return { mode: 'admin-api', config: adminApiResult.data };
  }

  // Fall back to direct KV mode
  const kvResult = KVConfigSchema.safeParse(process.env);
  if (kvResult.success) {
    return { mode: 'kv', config: kvResult.data };
  }

  return null;
}

/**
 * Create a backend instance based on the detected mode
 */
function createBackend(mode: 'kv' | 'admin-api', config: unknown): WaymarkBackend {
  if (mode === 'kv') {
    return createKVBackend(config as z.infer<typeof KVConfigSchema>);
  }
  return createAdminApiBackend(config as z.infer<typeof AdminApiConfigSchema>);
}

/**
 * Create an MCP server instance with all Waymark tools registered
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'waymark-mcp-server',
      version: '0.0.1',
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

    // Detect backend mode
    const backendConfig = detectBackendMode();
    if (!backendConfig) {
      return {
        content: [
          {
            type: 'text',
            text: `Configuration error: Missing required environment variables.\n\nFor admin API mode (recommended for agents):\n  Set WAYMARK_BASE_URL and WAYMARK_ADMIN_TOKEN\n\nFor direct KV mode:\n  Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, and CLOUDFLARE_API_TOKEN`,
          },
        ],
        isError: true,
      };
    }

    // Create the appropriate backend
    const backend = createBackend(backendConfig.mode, backendConfig.config);

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
