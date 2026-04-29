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

// Environment configuration schema
const EnvSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string(),
  CLOUDFLARE_KV_NAMESPACE_ID: z.string(),
  CLOUDFLARE_API_TOKEN: z.string(),
});

export type WaymarkConfig = z.infer<typeof EnvSchema>;

// Combine all tools
const allTools: Tool[] = [
  ...tripTools,
  ...poiTools,
  ...assignmentTools,
];

export type WaymarkMCPServer = Server;

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

    // Validate environment
    const envResult = EnvSchema.safeParse(process.env);
    if (!envResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Configuration error: Missing required environment variables. Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, and CLOUDFLARE_API_TOKEN.`,
          },
        ],
        isError: true,
      };
    }

    const config = envResult.data;

    // Create KV namespace binding using Cloudflare API
    const kv = createKVNamespace(config);

    // Route to appropriate tool handler
    try {
      // Trip tools
      const tripResult = await handleTripTool(name, args, kv);
      if (tripResult !== undefined) return tripResult;

      // POI tools
      const poiResult = await handlePoiTool(name, args, kv);
      if (poiResult !== undefined) return poiResult;

      // Assignment tools
      const assignmentResult = await handleAssignmentTool(name, args, kv);
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

/**
 * Create a KV namespace binding that uses Cloudflare API
 */
function createKVNamespace(config: WaymarkConfig): KVNamespace {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${config.CLOUDFLARE_KV_NAMESPACE_ID}`;
  const authHeader = `Bearer ${config.CLOUDFLARE_API_TOKEN}`;

  return {
    async get(key: string, type?: string): Promise<string | null> {
      const response = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        headers: { Authorization: authHeader },
      });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`KV get failed: ${response.statusText}`);

      if (type === 'json') {
        return response.json() as Promise<string>;
      }
      return response.text();
    },

    async put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<void> {
      // Convert value to Blob for FormData
      let blob: Blob;
      if (typeof value === 'string') {
        blob = new Blob([value], { type: 'text/plain' });
      } else if (value instanceof ArrayBuffer) {
        blob = new Blob([value]);
      } else {
        // ReadableStream - convert to blob
        const reader = value.getReader();
        const chunks: ArrayBuffer[] = [];
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          chunks.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
        }
        blob = new Blob(chunks);
      }

      const formData = new FormData();
      formData.append('value', blob);

      const response = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { Authorization: authHeader },
        body: formData,
      });

      if (!response.ok) throw new Error(`KV put failed: ${response.statusText}`);
    },

    async delete(key: string): Promise<void> {
      const response = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      });

      if (!response.ok) throw new Error(`KV delete failed: ${response.statusText}`);
    },

    async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number }[]; list_complete: boolean; cursor?: string }> {
      const params = new URLSearchParams();
      if (options?.prefix) params.append('prefix', options.prefix);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.cursor) params.append('cursor', options.cursor);

      const response = await fetch(`${baseUrl}/keys?${params}`, {
        headers: { Authorization: authHeader },
      });

      if (!response.ok) throw new Error(`KV list failed: ${response.statusText}`);

      const data = await response.json() as { result: { name: string; expiration?: number }[]; result_info?: { cursor?: string } };
      return {
        keys: data.result,
        list_complete: !data.result_info?.cursor,
        cursor: data.result_info?.cursor,
      };
    },
  } as KVNamespace;
}

// Import tool handlers
import { handleTripTool } from './tools/trips.js';
import { handlePoiTool } from './tools/pois.js';
import { handleAssignmentTool } from './tools/assignments.js';
