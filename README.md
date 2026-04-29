# Waymark

Mobile-first travel itinerary app built on Astro v6 + Cloudflare Workers. Itineraries are gated by a PIN, stored in Cloudflare KV, and accessible via a machine-to-machine admin API for AI agents.

## Stack

- **Astro v6** — SSR on Cloudflare Workers
- **Cloudflare KV** — one JSON document per trip
- **Tailwind CSS v4** — mobile-first styling
- **Zod** — schema validation
- **Web Crypto API** — PBKDF2 PIN hashing, HMAC-SHA256 cookie signing

## Setup

```bash
bun install
```

This is a Bun monorepo with workspaces:
- `apps/web` — Astro app (main itinerary site)
- `packages/shared` — shared types and utilities
- `packages/mcp-server` — MCP server for agent access

All commands below should be run from `apps/web/` unless noted.

## Required Bindings & Secrets

| Name | Type | Description |
|---|---|---|
| `TRIPS` | KV Namespace | Stores itinerary documents |
| `ADMIN_API_TOKEN` | Secret | Bearer token for admin API |
| `COOKIE_SIGNING_SECRET` | Secret | HMAC key for signed access cookies |

## Local Dev

1. Create a `.dev.vars` file in the project root:

```
ADMIN_API_TOKEN=dev-admin-token-change-in-prod
COOKIE_SIGNING_SECRET=dev-cookie-secret-32-chars-minimum
```

2. Create KV namespaces (one-time setup):

```bash
wrangler kv namespace create TRIPS
wrangler kv namespace create TRIPS --preview
```

Update `wrangler.jsonc` with the returned IDs.

3. Start the dev server:

```bash
bun run dev
```

The app runs at `http://localhost:4321`.

## Seeding Sample Data

The sample trip has ID `a8k3m2q9` and PIN `1234`.

```bash
cd apps/web

# 1. Generate the seed JSON
bun scripts/seed.ts > /tmp/trip.json

# 2. Seed into local KV (--preview targets the namespace the dev server uses)
wrangler kv key put --binding=TRIPS --local --preview "trip:a8k3m2q9" --path /tmp/trip.json

# 3. Visit the trip
open http://localhost:4321/trip/a8k3m2q9
# Enter PIN: 1234
```

To generate a PIN hash for a new trip:

```bash
cd apps/web
bun scripts/hash-pin.ts <pin> <salt>
# Example: bun scripts/hash-pin.ts mysecretpin abc123salt456
```

## Build & Deploy

```bash
# Build (from root)
bun run build

# Deploy to Cloudflare Workers (from root, runs: bun run --filter @waymark/web deploy)
bun run deploy

# Or manually from apps/web:
cd apps/web
wrangler deploy

# Set secrets (from apps/web, one-time)
cd apps/web
wrangler secret put ADMIN_API_TOKEN
wrangler secret put COOKIE_SIGNING_SECRET
```

## Admin API

All admin endpoints require `Authorization: Bearer <ADMIN_API_TOKEN>`.

### GET trip

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  https://waymark.<subdomain>.workers.dev/api/admin/trips/a8k3m2q9
```

Returns the full itinerary JSON document.

### Upsert trip

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/trip.json \
  https://waymark.<subdomain>.workers.dev/api/admin/trips/upsert
```

Returns: `{ "ok": true, "id": "a8k3m2q9", "updatedAt": "..." }`

### Delete trip

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"a8k3m2q9"}' \
  https://waymark.<subdomain>.workers.dev/api/admin/trips/delete
```

Returns: `{ "ok": true, "deleted": true }`

## Traveler Access

### Verify PIN

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"id":"a8k3m2q9","pin":"1234"}' \
  https://waymark.<subdomain>.workers.dev/api/trip-access/verify
```

Returns: `{ "ok": true }` with a `Set-Cookie` header on success, or `{ "error": "Invalid PIN" }` on failure.

## Data Model

One KV document per trip, stored under `trip:{id}`.

The full schema is defined in `src/types/itinerary.ts`. Key fields:

- `id` — 8-character alphanumeric slug (e.g. `a8k3m2q9`)
- `stays[]` — hotel stays with explicit `checkinDate`/`checkoutDate`; check-in/checkout timeline entries are generated from this at render time
- `days[]` — array of day objects, each with `items[]`
- `items[].type` — `transport | activity | note | restaurant | transfer` (do not store `hotel` items — use `stays[]`)
- `items[].status` — `booked | quoted | pending | canceled`
- `pinSalt` + `pinHash` — PBKDF2-SHA256 PIN verification (never expose to clients)

## Security Notes

- PIN hashes use PBKDF2-SHA256 with 100,000 iterations and a random salt
- Access cookies are HMAC-SHA256 signed, HttpOnly, Secure, SameSite=Lax, expire after 7 days
- Admin token comparisons use constant-time XOR to prevent timing attacks
- Trip URLs contain no personal information
- Admin token is never rendered in public HTML

## Agent Skill

This repo includes a `waymark-trips` skill for Claude Code and OpenClaw agents, enabling them to create, read, update, and delete trips via the admin API.

Install it with the [skills CLI](https://github.com/vercel-labs/skills):

```bash
# Project-scoped (current directory)
npx skills add aydrian/waymark

# Global (available in every session)
npx skills add aydrian/waymark -g
```

Once installed, an agent can manage trips on `https://waymark.itsaydrian.com` with just your `WAYMARK_ADMIN_TOKEN`. See [`waymark-trips/SKILL.md`](./waymark-trips/SKILL.md) for full details.

## Project Structure

```
apps/
  web/
    src/
      components/   # Astro UI components
      layouts/      # Page wrapper layouts
      lib/          # KV helpers, auth, PIN/crypto utils
      pages/        # File-based routing (trip/*, api/*)
      types/        # Zod schemas + TypeScript types
      scripts/      # hash-pin.ts, seed.ts
    public/         # Static assets
    wrangler.jsonc  # Cloudflare Workers config
packages/
  shared/         # Shared types and utilities (workspace package)
  mcp-server/     # MCP server for agent access (workspace package)
```
