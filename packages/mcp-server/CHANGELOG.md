# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.5] - 2026-05-02

### Fixed

- `create_poi` tool now correctly uses POST endpoint instead of PUT, fixing the 404 "POI not found" error
- Server now generates UUID and timestamps for new POIs instead of client-side generation

## [0.1.4] - 2026-04-30

### Fixed

- Fixed package.json exports paths to match actual build output (`dist/src/` instead of `dist/mcp-server/src/`)
- Cleaned up stale build artifacts that were incorrectly included in 0.1.3

## [0.1.3] - 2026-04-30

### Fixed

- HTTP transport (`http.ts`) now properly uses `WAYMARK_ADMIN_TOKEN` instead of requiring legacy Cloudflare KV variables (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_API_TOKEN`)
- Updated README.md to document correct admin API configuration

## [0.1.2] - 2026-04-30

### Changed

- Simplified to admin API only backend mode (removed direct KV access)
- Fixed TypeScript configuration for proper builds
- Server version now synced with package version

## [0.1.1] - 2025-04-30

### Changed

- Renamed package from `@waymark/mcp-server` to `@itsaydrian/waymark-mcp-server`
- Updated dependencies and package metadata

## [0.1.0] - 2025-04-30

### Added

- Initial release of @waymark/mcp-server
- Trip management tools: `list_trips`, `get_trip`, `create_trip`, `update_trip`, `delete_trip`
- POI management tools: `list_pois`, `get_poi`, `create_poi`, `update_poi`, `delete_poi`, `search_pois`
- Assignment management tools: `list_assignments`, `create_assignment`, `update_assignment`, `delete_assignment`
- Dual backend support:
  - Admin API mode (recommended for agents): Connect via `WAYMARK_BASE_URL` and `WAYMARK_ADMIN_TOKEN`
  - Direct KV mode: Connect via Cloudflare KV REST API using `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, and `CLOUDFLARE_API_TOKEN`
- Stdio transport for MCP client integration (Claude Desktop, OpenClaw, etc.)
- HTTP/SSE transport for remote access
- Full TypeScript type safety with Zod schema validation

### Notes

- This is the first public release. The API is considered stable but may evolve based on feedback.
- The Admin API backend is recommended for most use cases as it provides better security and abstraction.
- See README.md for detailed configuration and usage instructions.
