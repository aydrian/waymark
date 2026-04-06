# Admin Console Design

**Date:** 2026-04-02  
**Status:** Draft

## Context

Waymark has a set of admin API endpoints (`/api/admin/*`) protected by a Bearer token, but no browser-based admin UI. Managing trips currently requires raw API calls (curl, Insomnia, etc.). This spec covers a simple browser admin console that lets the owner view, create, and edit trips, protected by a WebAuthn passkey.

## Goals

- List all trips with status (upcoming / live / completed)
- Create new trips
- Edit trips: form fields for top-level data, CodeMirror JSON editor for complex nested data (days, stays, transport legs, POIs)
- Authentication via WebAuthn passkey (FIDO2) — single admin user, one registered credential

## Out of Scope

- Multiple admin users
- PIN management UI (pins are set via the editor's Info form)
- POI management UI (handled via Raw JSON tab for now)

---

## Architecture

New Astro SSR pages under `src/pages/admin/` call KV directly (no HTTP round-trip). The existing `/api/admin/trips/*` endpoints are updated to accept either a Bearer token **or** a valid admin session cookie, preserving CLI access while enabling browser-based writes from the CodeMirror editor.

### Page Routes

| Route | Purpose |
|---|---|
| `GET /admin` | Login — if session valid → redirect to `/admin/trips`; if no credential registered → redirect to `/admin/setup` |
| `GET /admin/setup` | One-time passkey registration — if credential already in KV → redirect to `/admin` |
| `GET /admin/trips` | Trip list |
| `GET /admin/trips/new` | Create trip (empty editor) |
| `GET /admin/trips/[id]` | Edit trip |

### Auth API Routes (new)

| Route | Purpose |
|---|---|
| `POST /api/admin/auth/register-options` | Generate WebAuthn registration challenge |
| `POST /api/admin/auth/register-verify` | Verify registration, store credential, set session cookie |
| `POST /api/admin/auth/login-options` | Generate WebAuthn authentication challenge |
| `POST /api/admin/auth/login-verify` | Verify assertion, set session cookie |
| `POST /api/admin/auth/logout` | Clear session cookie |

### Existing Trip API Routes (modified)

All existing `/api/admin/trips/*` endpoints updated to call `requireAdminAccess` (accepts Bearer token **or** session cookie) instead of `requireAdminAuth` (Bearer token only). No behaviour change for existing CLI callers.

---

## Passkey Auth

### Dependencies

```
@simplewebauthn/server   — edge-compatible, uses Web Crypto API
@simplewebauthn/browser  — client-side credential creation/assertion
```

### KV Keys

| Key | Value | TTL |
|---|---|---|
| `admin:credential` | `{ id, publicKey, counter, transports, credentialDeviceType, credentialBackedUp }` | none |
| `admin:challenge:{uuid}` | challenge string | 2 minutes |

### Session Cookie

- Name: `waymark_admin`
- Value: `admin:{expiry_unix}:{hmac-sha256}` — same signing scheme as existing `waymark_access` cookie
- Signing secret: `COOKIE_SIGNING_SECRET` (existing secret, no new env var needed)
- TTL: 7 days
- Flags: `HttpOnly; Secure; SameSite=Strict`

### Registration Flow (`/admin/setup`)

1. Server checks KV for `admin:credential` — if found, redirect to `/admin`
2. User clicks "Register passkey"
3. `POST /api/admin/auth/register-options` → server generates options via `generateRegistrationOptions()`, stores challenge at `admin:challenge:{uuid}` with 2-min KV TTL, returns options + challenge ID
4. Client calls `startRegistration(options)` from `@simplewebauthn/browser` — triggers device biometric/security key prompt
5. `POST /api/admin/auth/register-verify` → server loads challenge from KV, calls `verifyRegistrationResponse()`, deletes challenge, stores credential at `admin:credential`, sets session cookie, returns `{ ok: true }`
6. Client redirects to `/admin/trips`

### Authentication Flow (`/admin`)

1. Server checks session cookie — if valid, redirect to `/admin/trips`
2. Server checks `admin:credential` in KV — if missing, redirect to `/admin/setup`
3. User clicks "Sign in with passkey"
4. `POST /api/admin/auth/login-options` → server generates options, stores challenge with 2-min TTL
5. Client calls `startAuthentication(options)` — triggers device prompt
6. `POST /api/admin/auth/login-verify` → server loads credential + challenge from KV, calls `verifyAuthenticationResponse()`, updates counter in stored credential, deletes challenge, sets session cookie
7. Client redirects to `/admin/trips`

---

## Admin Pages

### `/admin/trips` — Trip List

- Calls `listTrips(env.TRIPS)` directly
- Displays: title, ID, date range, status badge (reuses `getTripStatus()` from `src/lib/trip-state.ts`)
- Each row links to `/admin/trips/[id]`
- "New Trip" button links to `/admin/trips/new`
- "Log out" link → `POST /api/admin/auth/logout`

### `/admin/trips/[id]` and `/admin/trips/new` — Editor

Two-tab layout:

**Info tab (form)**  
Fields: title, startDate, endDate, timezone, destinations (comma-separated → array), travelers (comma-separated → array, optional), summary (optional), PIN (optional — blank = keep existing hash/salt).

**Complex data section (within Info tab)**  
CodeMirror JSON editor (client-side, `client:load`, using `codemirror` package) for: `days`, `stays`, `transportLegs`, `pois`, `map`. Loaded separately from the Info fields and merged on save.

**Raw JSON tab**  
Full CodeMirror editor for the entire trip object. Useful for surgical edits.

**Save behaviour**  
Both tabs POST to `POST /api/admin/trips/upsert` via `fetch` (credentials: `'same-origin'`). On `/trips/new`, the Astro page generates a new 8-char lowercase alphanumeric ID server-side (using `crypto.getRandomValues` + base36 encoding) and passes it to the editor as a prop — so the ID is already set before the user clicks Save. On success, the client redirects to `/admin/trips/[id]`.

**PIN handling**  
If the PIN field is non-empty on save: hash with `hashPin(pin, generateSalt())` from `src/lib/pin.ts` and include `pinHash`/`pinSalt` in the upsert payload. If blank: omit both fields from the payload (upsert preserves existing values).

**Delete**  
"Delete trip…" button → confirm dialog → `DELETE /api/admin/trips/delete` → redirect to `/admin/trips`.

---

## New File: `src/lib/admin-auth.ts`

```ts
// Session helpers for admin console
getAdminSession(request, env)       → boolean
requireAdminSession(request, env)   → Response (302) | null
setAdminSession(headers, env)       → void  (writes Set-Cookie header)
clearAdminSession(headers)          → void
requireAdminAccess(request, env)    → Response (401) | null  // accepts Bearer OR session cookie
```

`requireAdminAccess` replaces `requireAdminAuth` in all existing admin trip endpoints.

---

## Files

### New

```
src/lib/admin-auth.ts
src/pages/admin/index.astro
src/pages/admin/setup.astro
src/pages/admin/trips/index.astro
src/pages/admin/trips/new.astro
src/pages/admin/trips/[id].astro
src/pages/api/admin/auth/register-options.ts
src/pages/api/admin/auth/register-verify.ts
src/pages/api/admin/auth/login-options.ts
src/pages/api/admin/auth/login-verify.ts
src/pages/api/admin/auth/logout.ts
```

### Modified

```
src/lib/auth.ts                          — no changes; requireAdminAuth stays for reference
src/pages/api/admin/trips/index.ts       — use requireAdminAccess
src/pages/api/admin/trips/[id].ts        — use requireAdminAccess
src/pages/api/admin/trips/upsert.ts      — use requireAdminAccess
src/pages/api/admin/trips/delete.ts      — use requireAdminAccess
src/pages/api/admin/trips/[id]/pois/*.ts — use requireAdminAccess
package.json                             — add @simplewebauthn/server, @simplewebauthn/browser, codemirror
```

---

## Verification

1. `bun run dev` — local dev server
2. Visit `http://localhost:4321/admin/setup` — register a passkey using browser biometrics
3. Verify `admin:credential` written to KV (wrangler kv key list or dev KV UI)
4. Visit `/admin` — authenticate with passkey, confirm redirect to `/admin/trips`
5. Trip list shows all existing trips
6. Create a new trip via `/admin/trips/new` — save, confirm it appears in the list
7. Edit an existing trip via Info tab — change title, save, verify change persists
8. Edit via Raw JSON tab — make a change, save, verify
9. Delete a trip — confirm removed from list
10. Confirm existing CLI Bearer token access still works: `curl -H "Authorization: Bearer $TOKEN" /api/admin/trips`
11. Log out — confirm `/admin` redirects back to login
