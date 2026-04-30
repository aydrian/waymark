#!/usr/bin/env node
/**
 * HTTP/SSE transport for Waymark MCP Server
 *
 * This runs an HTTP server that exposes the MCP protocol over SSE.
 * Useful for remote access or integration with other MCP clients.
 *
 * Usage:
 *   bun src/transports/http.ts
 *
 * The server listens on PORT (default: 3000) and exposes:
 *   GET /sse - SSE endpoint for server-to-client messages
 *   POST /messages - Client-to-server message endpoint
 */

import { createServer } from '../server.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

// Simple SSE transport implementation
class SSETransport {
  private server: Server;
  private sessions: Map<string, ReadableStreamDefaultController<Uint8Array>> = new Map();

  constructor(server: Server) {
    this.server =

 server;
  }

  async handleSSE(request: Request): Promise<Response> {
    const sessionId = crypto.randomUUID();

    const stream = new ReadableStream({
      start: (controller) => {
        this.sessions.set(sessionId, controller);

        // Send endpoint event
        const endpointEvent = `event: endpoint\ndata: ${encodeURIComponent(`/messages?sessionId=${sessionId}`)}\n\n`;
        controller.enqueue(new TextEncoder().encode(endpointEvent));
      },
      cancel: () => {
        this.sessions.delete(sessionId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  async handleMessage(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId || !this.sessions.has(sessionId)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const message = await request.json() as JSONRPCMessage;

      // Handle the message through the MCP server
      // The server will send responses back through the SSE connection
      const controller = this.sessions.get(sessionId);
      if (controller) {
        // Forward message to server's handler and get response
        // This is a simplified implementation - the actual SDK may require different handling
        const response = await this.processMessage(message);
        if (response) {
          const sseMessage = `data: ${JSON.stringify(response)}\n\n`;
          controller.enqueue(new TextEncoder().encode(sseMessage));
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async processMessage(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    // This is a placeholder - the actual implementation would use the SDK's internal handling
    // For now, we return a simple acknowledgement
    if ('method' in message && 'id' in message && message.id !== undefined) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {},
      };
    }
    return null;
  }

  sendMessage(sessionId: string, message: JSONRPCMessage): void {
    const controller = this.sessions.get(sessionId);
    if (controller) {
      const sseMessage = `data: ${JSON.stringify(message)}\n\n`;
      controller.enqueue(new TextEncoder().encode(sseMessage));
    }
  }
}

async function main() {
  // Validate required environment variable
  if (!process.env.WAYMARK_ADMIN_TOKEN) {
    console.error('Missing required environment variable: WAYMARK_ADMIN_TOKEN');
    console.error('Please set WAYMARK_ADMIN_TOKEN to your Waymark admin API token.');
    console.error('');
    console.error('Optional: Set WAYMARK_BASE_URL to override the default (https://waymark.itsaydrian.com)');
    process.exit(1);
  }

  const port = parseInt(process.env.PORT || '3000', 10);

  const mcpServer = createServer();
  const sseTransport = new SSETransport(mcpServer);

  // Create HTTP server using Bun's serve API
  const server = Bun.serve({
    port,
    async fetch(request: Request) {
      const url = new URL(request.url);

      // Enable CORS
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // SSE endpoint
      if (url.pathname === '/sse' && request.method === 'GET') {
        const response = await sseTransport.handleSSE(request);
        // Add CORS headers
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        });
      }

      // Message endpoint
      if (url.pathname === '/messages' && request.method === 'POST') {
        const response = await sseTransport.handleMessage(request);
        // Add CORS headers
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        });
      }

      // Health check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
  });

  console.log(`Waymark MCP Server running on http://localhost:${port}`);
  console.log(`  SSE endpoint: http://localhost:${port}/sse`);
  console.log(`  Health check: http://localhost:${port}/health`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
