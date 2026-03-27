@.claude/rules/bun-package-manager.md

# Waymark

A server-rendered Astro app for sharing trip itineraries, deployed on Cloudflare Workers with KV storage.

## Dev Commands

- `bun run dev` — start local dev server
- `bun run build` — production build
- `bun run preview` — preview built output
- `bun run deploy` — build + deploy to Cloudflare Workers
- `bun test` — run tests

## Project Structure

```
src/
  components/   — Astro UI components
  layouts/      — page wrapper layouts
  lib/          — shared utilities and data access
  pages/        — file-based routing (index, trip/*, api/*)
  types/        — TypeScript types
public/         — static assets
```

## Cloudflare Notes

- Output mode: `server` (SSR via `@astrojs/cloudflare`)
- KV binding `TRIPS` — used for trip data storage; access via `Astro.locals.runtime.env.TRIPS`
- Cloudflare Workers types: `@cloudflare/workers-types`
- Config: `wrangler.jsonc` (do not rename to `.json`)
- Custom domain: `waymark.itsaydrian.com`

## Coding Style

- TypeScript everywhere; use types from `src/types/`
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
