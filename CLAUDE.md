@.claude/rules/bun-package-manager.md

# Waymark

A server-rendered Astro app for sharing trip itineraries, deployed on Cloudflare Workers with KV storage.

## Dev Commands

- `bun run web:dev` — start local dev server
- `bun run web:build` — production build
- `bun run web:preview` — preview built output
- `bun run web:deploy` — build + deploy to Cloudflare Workers
- `bun run mcp:dev:stdio` — run MCP server (stdio transport)
- `bun run mcp:dev:http` — run MCP server (HTTP transport)

## Project Structure

Monorepo with Bun workspaces:

```
apps/
  web/          — Astro app (itinerary site)
    src/
      components/   — Astro UI components
      layouts/      — page wrapper layouts
      lib/          — KV helpers, auth, PIN/crypto
      pages/        — file-based routing (trip/*, api/*)
      types/        — Zod schemas + TypeScript types
packages/
  shared/       — Shared types/utilities (consumed by apps)
  mcp-server/   — MCP server for agent access
```

## Cloudflare Notes

- Output mode: `server` (SSR via `@astrojs/cloudflare`)
- KV binding `TRIPS` — used for trip data storage; access via `Astro.locals.runtime.env.TRIPS`
- Cloudflare Workers types: `@cloudflare/workers-types`
- Config: `wrangler.jsonc` (do not rename to `.json`)
- Custom domain: `waymark.itsaydrian.com`

## Coding Style

- TypeScript everywhere; use types from `packages/shared/src/types/` or `apps/web/src/types/`
- Tailwind CSS v4 via Vite plugin — use utility classes, no CSS-in-JS
- Zod for data validation at boundaries (API routes, KV reads)
- Leaflet for map components (loaded client-side only)

## Do / Don't

- **Do** colocate component logic in `.astro` frontmatter
- **Do** validate KV data with Zod before use
- **Don't** add `npm`/`yarn`/`pnpm` scripts or lockfiles
- **Don't** switch `output` away from `server` in `astro.config.ts`
- **Don't** hardcode env values — use `Astro.locals.runtime.env`
- **Don't** import Leaflet at the top level — it requires a browser environment
