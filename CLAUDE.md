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

## MCP Server Release Process

To release a new version of `@itsaydrian/waymark-mcp-server`:

### Option 1: Use the release script (recommended)

```bash
./scripts/release-mcp-server.sh 0.1.7
```

This handles the mechanical steps (build verification, version bump, changelog entry). Then:

1. Edit the changelog entry to add proper release notes
2. Run the git commit/tag/push commands shown by the script
3. Create GitHub release
4. Publish to npm (requires 2FA OTP)

### Option 2: Manual steps

1. **Ensure clean build from correct directory:**
   ```bash
   cd packages/mcp-server
   rm -rf dist
   npx tsc
   ls dist/src/transports/  # Should show stdio.js and http.js
   ```

2. **Update version and changelog:**
   - Edit `package.json` - bump version
   - Edit `CHANGELOG.md` - add new section with date (format: `## [X.Y.Z] - YYYY-MM-DD`)

3. **Commit changes:**
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore(mcp-server): release vX.Y.Z"
   ```

4. **Create and push git tag:**
   ```bash
   git tag "@itsaydrian/waymark-mcp-server@X.Y.Z"
   git push origin "@itsaydrian/waymark-mcp-server@X.Y.Z"
   ```

5. **Create GitHub release:**
   ```bash
   gh release create "@itsaydrian/waymark-mcp-server@X.Y.Z" \
     --title "@itsaydrian/waymark-mcp-server@X.Y.Z" \
     --notes "Release notes from CHANGELOG" \
     --repo aydrian/waymark
   ```

6. **Publish to npm (requires 2FA):**
   ```bash
   cd packages/mcp-server
   npm publish
   # Enter OTP from authenticator app when prompted
   ```

**Important:** The build must be run from `packages/mcp-server/` directory (not root), otherwise transport files won't be included in the output.
