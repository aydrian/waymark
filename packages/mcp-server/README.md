# Waymark MCP Server

Model Context Protocol (MCP) server for Waymark travel itinerary management.

## Quick Start (OpenClaw / npx)

The easiest way to use this server is via npx (requires Node.js 18+):

```bash
npx @itsaydrian/waymark-mcp-server
```

Or configure it in your MCP client (like OpenClaw or Claude Desktop):

```json
{
  "mcpServers": {
    "waymark": {
      "command": "npx",
      "args": ["-y", "@itsaydrian/waymark-mcp-server"],
      "env": {
        "WAYMARK_BASE_URL": "https://waymark.itsaydrian.com",
        "WAYMARK_ADMIN_TOKEN": "your-admin-token"
      }
    }
  }
}
```

## Overview

This MCP server exposes Waymark's trip and POI management APIs as structured tools for Claude agents and other MCP clients. It provides:

- **Trip Management**: Create, read, update, and delete travel itineraries
- **Global POI Management**: Manage Points of Interest that can be reused across trips
- **Assignment Management**: Assign POIs to specific days and times in trip itineraries

## Development Setup

If you're contributing or want to run from source:

```bash
cd packages/mcp-server
bun install
bun run build
```

## Configuration

Set the following environment variables:

```env
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_KV_NAMESPACE_ID=your-kv-namespace-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token-with-kv-permissions
```

### Cloudflare API Token

Create a token with these permissions:
- `Cloudflare KV:Edit`
- `Cloudflare KV:Read`

## Usage

### Stdio Transport (Claude Desktop)

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "waymark": {
      "command": "bun",
      "args": ["/path/to/waymark/packages/mcp-server/src/transports/stdio.ts"],
      "env": {
        "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
        "CLOUDFLARE_KV_NAMESPACE_ID": "your-namespace-id",
        "CLOUDFLARE_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### HTTP/SSE Transport (Remote Access)

Run the HTTP server:

```bash
bun src/transports/http.ts
```

Or with a custom port:

```bash
PORT=8080 bun src/transports/http.ts
```

Endpoints:
- `GET /sse` - SSE endpoint for server-to-client messages
- `POST /messages?sessionId=<id>` - Client-to-server message endpoint
- `GET /health` - Health check

## Available Tools

### Trip Management

- **`list_trips`** - Get a summary list of all trips
- **`get_trip`** - Get full details of a trip by ID
- **`create_trip`** - Create a new itinerary (PIN auto-hashed if provided)
- **`update_trip`** - Update an existing trip
- **`delete_trip`** - Delete a trip by ID

### POI Management

- **`list_pois`** - Get all global POIs
- **`get_poi`** - Get details of a specific POI
- **`create_poi`** - Create a new global POI
- **`update_poi`** - Update an existing POI
- **`delete_poi`** - Delete a POI
- **`search_pois`** - Search POIs by city, category, or name

### Assignment Management

- **`list_assignments`** - List POI assignments for a trip/day
- **`create_assignment`** - Assign a POI to a specific day
- **`update_assignment`** - Modify an assignment (time, day, notes)
- **`delete_assignment`** - Remove an assignment from a trip

## Example Usage in Claude

Once configured, you can ask Claude:

```
List all my trips
```

```
Create a new trip to Paris from 2026-06-01 to 2026-06-07
```

```
Find restaurants in Rome
```

```
Assign the Colosseum to day 2 of my Italy trip at 10:00 AM
```

## Architecture

The server uses direct KV access via Cloudflare's REST API, providing:
- **No HTTP overhead** - Direct data layer access
- **Type safety** - Zod schema validation for all inputs/outputs
- **Discoverability** - Tools expose their schemas to MCP clients
- **Error handling** - Structured error responses

## Development

```bash
# Type check
bun run typecheck

# Run stdio transport for testing
bun run dev:stdio

# Run HTTP server
bun run dev:http
```

## License

Private - Part of the Waymark project
