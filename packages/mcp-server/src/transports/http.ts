#!/usr/bin/env node
/**
 * HTTP transport for Waymark MCP Server
 *
 * NOTE: This transport is currently a placeholder. The stdio transport is the
 * primary transport for Claude Desktop integration.
 *
 * For HTTP/SSE support, the transport needs to be updated to use the new
 * StreamableHTTPServerTransport from the MCP SDK.
 *
 * Usage:
 *   bun src/transports/http.ts
 *
 * The server listens on PORT (default: 3000) and exposes:
 *   GET /health - Health check endpoint
 */

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

      // Health check
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'ok', transport: 'http-placeholder' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // MCP endpoint - returns informative message
      if (url.pathname === '/mcp' || url.pathname === '/sse' || url.pathname === '/messages') {
        return new Response(
          JSON.stringify({
            error: 'HTTP transport not fully implemented',
            message: 'Please use the stdio transport for Claude Desktop integration: bun run mcp:dev:stdio',
          }),
          {
            status: 501,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    },
  });

  console.log(`Waymark MCP Server (HTTP placeholder) running on http://localhost:${port}`);
  console.log(`  Health check: http://localhost:${port}/health`);
  console.log('');
  console.log('NOTE: HTTP transport is not fully implemented.');
  console.log('      Use the stdio transport for Claude Desktop: bun run mcp:dev:stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
