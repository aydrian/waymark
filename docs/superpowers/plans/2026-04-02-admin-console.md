# Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browser admin console at `/admin/*` — passkey-authenticated, shows all trips, lets the owner create and edit trips with a hybrid form + JSON editor.

**Architecture:** New Astro SSR pages under `src/pages/admin/` read KV directly. Client-side WebAuthn (via `@simplewebauthn/browser`) talks to new auth API endpoints. Existing `/api/admin/trips/*` endpoints gain session-cookie auth alongside Bearer token; no CLI behaviour changes. Trip edits POST to the existing upsert endpoint.

**Tech Stack:** `@simplewebauthn/server` + `@simplewebauthn/browser` (WebAuthn), `codemirror` + `@codemirror/lang-json` (JSON editor), existing `cookie.ts` HMAC signing for session cookie.

---

## File Map

**New files:**
```
src/lib/admin-auth.ts                              — session cookie helpers + requireAdminAccess
src/lib/admin-auth.test.ts                         — unit tests for admin-auth
src/pages/admin/index.astro                        — login page
src/pages/admin/setup.astro                        — one-time passkey registration
src/pages/admin/trips/index.astro                  — trip list
src/pages/admin/trips/new.astro                    — create trip (editor pre-seeded with empty template)
src/pages/admin/trips/[id].astro                   — edit trip
src/pages/api/admin/auth/register-options.ts       — generate registration challenge
src/pages/api/admin/auth/register-verify.ts        — verify registration, store credential, set session
src/pages/api/admin/auth/login-options.ts          — generate auth challenge
src/pages/api/admin/auth/login-verify.ts           — verify assertion, set session
src/pages/api/admin/auth/logout.ts                 — clear session cookie
```

**Modified files:**
```
src/pages/api/admin/trips/index.ts                 — use requireAdminAccess
src/pages/api/admin/trips/[id].ts                  — use requireAdminAccess
src/pages/api/admin/trips/upsert.ts                — use requireAdminAccess + handle optional pin field
src/pages/api/admin/trips/delete.ts                — use requireAdminAccess
src/pages/api/admin/trips/[id]/pois/index.ts       — use requireAdminAccess
src/pages/api/admin/trips/[id]/pois/[poiId].ts     — use requireAdminAccess
package.json                                       — add 4 new deps
```

---

## Task 1: Install dependencies and commit spec doc

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the four new packages**

```bash
bun add @simplewebauthn/server @simplewebauthn/browser codemirror @codemirror/lang-json
```

- [ ] **Step 2: Verify the installs appear in package.json**

```bash
grep -E "simplewebauthn|codemirror" package.json
```

Expected: four entries under `dependencies`.

- [ ] **Step 3: Commit spec doc and dependency update**

```bash
git add docs/superpowers/specs/2026-04-02-admin-console-design.md package.json bun.lock
git commit -m "chore(admin): add WebAuthn and CodeMirror dependencies"
```

---

## Task 2: `src/lib/admin-auth.ts` + tests

**Files:**
- Create: `src/lib/admin-auth.ts`
- Create: `src/lib/admin-auth.test.ts`

The admin session cookie reuses the existing HMAC signing scheme from `cookie.ts`. The sentinel trip ID `'admin'` is used so `verifyTripCookie` validates the cookie without conflicting with real trip cookies (which have 8-char alphanumeric IDs). `requireAdminAccess` accepts Bearer token first (for CLI callers), then falls back to session cookie.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin-auth.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import {
  getAdminSession,
  requireAdminSession,
  setAdminSession,
  clearAdminSession,
  requireAdminAccess,
} from './admin-auth';
import { signTripCookie } from './cookie';

const SECRET = 'test-secret-key-at-least-32-chars!!';
const TOKEN = 'test-admin-token';

function makeRequest(opts: { cookie?: string; bearer?: string } = {}): Request {
  const headers = new Headers();
  if (opts.cookie) headers.set('Cookie', `waymark_admin=${opts.cookie}`);
  if (opts.bearer) headers.set('Authorization', `Bearer ${opts.bearer}`);
  return new Request('https://example.com/admin', { headers });
}

describe('getAdminSession', () => {
  test('returns false when no cookie present', async () => {
    expect(await getAdminSession(makeRequest(), SECRET)).toBe(false);
  });

  test('returns false for tampered cookie value', async () => {
    expect(
      await getAdminSession(makeRequest({ cookie: 'admin%3A9999999999999%3Abad' }), SECRET)
    ).toBe(false);
  });

  test('returns false for expired cookie', async () => {
    // Manually craft an expired-looking value — verifyTripCookie will reject it
    expect(
      await getAdminSession(makeRequest({ cookie: 'admin%3A0%3Abad' }), SECRET)
    ).toBe(false);
  });

  test('returns true for a valid signed cookie', async () => {
    const raw = await signTripCookie('admin', SECRET);
    const req = makeRequest({ cookie: encodeURIComponent(raw) });
    expect(await getAdminSession(req, SECRET)).toBe(true);
  });
});

describe('requireAdminSession', () => {
  test('returns 302 to /admin when no valid session', async () => {
    const res = await requireAdminSession(makeRequest(), SECRET);
    expect(res?.status).toBe(302);
    expect(res?.headers.get('Location')).toBe('/admin');
  });

  test('returns null when session is valid', async () => {
    const raw = await signTripCookie('admin', SECRET);
    const req = makeRequest({ cookie: encodeURIComponent(raw) });
    expect(await requireAdminSession(req, SECRET)).toBeNull();
  });
});

describe('setAdminSession', () => {
  test('writes waymark_admin cookie with HttpOnly and SameSite=Strict', async () => {
    const headers = new Headers();
    await setAdminSession(headers, SECRET);
    const cookie = headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('waymark_admin=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
  });
});

describe('clearAdminSession', () => {
  test('sets Max-Age=0 to expire the cookie', () => {
    const headers = new Headers();
    clearAdminSession(headers);
    const cookie = headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('waymark_admin=');
    expect(cookie).toContain('Max-Age=0');
  });
});

describe('requireAdminAccess', () => {
  test('returns null for a valid Bearer token', async () => {
    const req = makeRequest({ bearer: TOKEN });
    expect(await requireAdminAccess(req, TOKEN, SECRET)).toBeNull();
  });

  test('returns null for a valid session cookie', async () => {
    const raw = await signTripCookie('admin', SECRET);
    const req = makeRequest({ cookie: encodeURIComponent(raw) });
    expect(await requireAdminAccess(req, TOKEN, SECRET)).toBeNull();
  });

  test('returns 401 when neither token nor cookie is valid', async () => {
    const res = await requireAdminAccess(makeRequest(), TOKEN, SECRET);
    expect(res?.status).toBe(401);
  });

  test('returns 401 for wrong Bearer token', async () => {
    const req = makeRequest({ bearer: 'wrong-token' });
    const res = await requireAdminAccess(req, TOKEN, SECRET);
    expect(res?.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/lib/admin-auth.test.ts
```

Expected: `Cannot find module './admin-auth'`

- [ ] **Step 3: Create `src/lib/admin-auth.ts`**

```typescript
import { signTripCookie, verifyTripCookie, parseCookies } from './cookie';
import { requireAdminAuth } from './auth';

const ADMIN_COOKIE_NAME = 'waymark_admin';
const ADMIN_SESSION_DAYS = 7;
// Sentinel value used as the "tripId" slot in signed cookie — won't collide with real trip IDs
const ADMIN_SENTINEL = 'admin';

/** Returns true if the request carries a valid, unexpired admin session cookie */
export async function getAdminSession(request: Request, cookieSecret: string): Promise<boolean> {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const raw = cookies[ADMIN_COOKIE_NAME];
  if (!raw) return false;
  const tripId = await verifyTripCookie(decodeURIComponent(raw), cookieSecret);
  return tripId === ADMIN_SENTINEL;
}

/** Returns a 302 → /admin Response when no valid session, null when authenticated */
export async function requireAdminSession(
  request: Request,
  cookieSecret: string,
): Promise<Response | null> {
  if (!(await getAdminSession(request, cookieSecret))) {
    return new Response(null, { status: 302, headers: { Location: '/admin' } });
  }
  return null;
}

/** Appends a signed waymark_admin Set-Cookie header to `headers` */
export async function setAdminSession(headers: Headers, cookieSecret: string): Promise<void> {
  const value = await signTripCookie(ADMIN_SENTINEL, cookieSecret);
  const maxAge = ADMIN_SESSION_DAYS * 24 * 60 * 60;
  headers.set(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`,
  );
}

/** Appends a Max-Age=0 Set-Cookie header to expire the session */
export function clearAdminSession(headers: Headers): void {
  headers.set(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`,
  );
}

/**
 * Returns null if the request is authorized via Bearer token OR admin session cookie.
 * Returns a 401 JSON Response otherwise.
 * Use this in all /api/admin/trips/* endpoints instead of requireAdminAuth.
 */
export async function requireAdminAccess(
  request: Request,
  adminToken: string,
  cookieSecret: string,
): Promise<Response | null> {
  // Bearer token (existing CLI callers — unchanged behaviour)
  if (requireAdminAuth(request, adminToken) === null) return null;
  // Session cookie (browser admin UI)
  if (await getAdminSession(request, cookieSecret)) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 4: Run tests again to verify they pass**

```bash
bun test src/lib/admin-auth.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-auth.ts src/lib/admin-auth.test.ts
git commit -m "feat(admin): add admin session auth helpers"
```

---

## Task 3: Update existing admin trip endpoints

**Files:**
- Modify: `src/pages/api/admin/trips/index.ts`
- Modify: `src/pages/api/admin/trips/[id].ts`
- Modify: `src/pages/api/admin/trips/delete.ts`
- Modify: `src/pages/api/admin/trips/upsert.ts`
- Modify: `src/pages/api/admin/trips/[id]/pois/index.ts`
- Modify: `src/pages/api/admin/trips/[id]/pois/[poiId].ts`

Six files all get the same auth swap. The upsert endpoint also gains optional `pin` handling.

- [ ] **Step 1: Update `src/pages/api/admin/trips/index.ts`**

Replace the file contents:

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth';
import { listTrips } from '../../../../lib/kv';

export const GET: APIRoute = async ({ request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const trips = await listTrips(env.TRIPS);
  return new Response(JSON.stringify({ trips, count: trips.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Update `src/pages/api/admin/trips/[id].ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth';
import { getTrip } from '../../../../lib/kv';

export const GET: APIRoute = async ({ params, request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(env.TRIPS, id);
  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(trip), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 3: Update `src/pages/api/admin/trips/delete.ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth';
import { deleteTrip } from '../../../../lib/kv';
import { z } from 'zod';

const DeleteBodySchema = z.object({ id: z.string() });

export const POST: APIRoute = async ({ request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = DeleteBodySchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Missing id field' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deleted = await deleteTrip(env.TRIPS, result.data.id);

  return new Response(JSON.stringify({ ok: true, deleted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 4: Update `src/pages/api/admin/trips/upsert.ts`**

This version adds optional `pin` field handling — if present, it's hashed server-side and the result replaces `pinSalt`/`pinHash`. This keeps PBKDF2 out of the browser.

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth';
import { putTrip } from '../../../../lib/kv';
import { hashPin, generateSalt } from '../../../../lib/pin';
import { ItinerarySchema } from '../../../../types/itinerary';

export const POST: APIRoute = async ({ request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If a plain `pin` string is provided, hash it server-side and inject pinSalt/pinHash
  if (
    body !== null &&
    typeof body === 'object' &&
    'pin' in body &&
    typeof (body as Record<string, unknown>).pin === 'string'
  ) {
    const pin = (body as Record<string, unknown>).pin as string;
    delete (body as Record<string, unknown>).pin;
    if (pin.length > 0) {
      const salt = generateSalt();
      const hash = await hashPin(pin, salt);
      (body as Record<string, unknown>).pinSalt = salt;
      (body as Record<string, unknown>).pinHash = hash;
    }
  }

  const result = ItinerarySchema.safeParse(body);
  if (!result.success) {
    return new Response(
      JSON.stringify({ error: 'Validation failed', issues: result.error.issues }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    );
  }

  await putTrip(env.TRIPS, result.data);

  return new Response(
    JSON.stringify({ ok: true, id: result.data.id, updatedAt: result.data.updatedAt }),
    { status: 201, headers: { 'Content-Type': 'application/json' } },
  );
};
```

- [ ] **Step 5: Update POI endpoints — read current `[id]/pois/index.ts` first**

```bash
cat src/pages/api/admin/trips/\[id\]/pois/index.ts
```

Apply the same auth swap: replace `requireAdminAuth(request, env.ADMIN_API_TOKEN)` with `await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET)`, and update the import from `'../../../../../lib/auth'` to `'../../../../../lib/admin-auth'`.

- [ ] **Step 6: Update `[id]/pois/[poiId].ts`**

Same change — swap import and replace `requireAdminAuth` with `await requireAdminAccess`.

- [ ] **Step 7: Verify the build compiles**

```bash
bun run build
```

Expected: successful build with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/api/admin/trips/
git commit -m "feat(admin): accept session cookie auth on admin trip endpoints"
```

---

## Task 4: Passkey registration endpoints

**Files:**
- Create: `src/pages/api/admin/auth/register-options.ts`
- Create: `src/pages/api/admin/auth/register-verify.ts`

Challenges are stored in KV at `admin:challenge:{uuid}` with a 2-minute TTL and deleted after use to prevent replay attacks. Credentials are stored at `admin:credential` as JSON with `publicKey` serialised as a `number[]` (JSON-safe Uint8Array).

> **Note:** Pin down the exact `@simplewebauthn/server` version you installed (`bun pm ls | grep simplewebauthn`) and verify `generateRegistrationOptions` / `verifyRegistrationResponse` signatures against the package's TypeScript types. The field names below match v9+.

- [ ] **Step 1: Create `src/pages/api/admin/auth/register-options.ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { generateRegistrationOptions } from '@simplewebauthn/server';

const RP_NAME = 'Waymark Admin';

export const POST: APIRoute = async ({ request }) => {
  const rpID = new URL(request.url).hostname;

  // Include existing credential in excludeCredentials to prevent accidental re-registration
  const existingRaw = await env.TRIPS.get('admin:credential', 'text');
  const excludeCredentials = existingRaw
    ? [{ id: (JSON.parse(existingRaw) as { id: string }).id }]
    : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: 'admin',
    userID: new TextEncoder().encode('waymark-admin'),
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  const challengeId = crypto.randomUUID();
  await env.TRIPS.put(`admin:challenge:${challengeId}`, options.challenge, {
    expirationTtl: 120,
  });

  return new Response(JSON.stringify({ options, challengeId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create `src/pages/api/admin/auth/register-verify.ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { setAdminSession } from '../../../../lib/admin-auth';

export const POST: APIRoute = async ({ request }) => {
  let body: { challengeId: string; response: unknown };
  try {
    body = (await request.json()) as { challengeId: string; response: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const challenge = await env.TRIPS.get(`admin:challenge:${body.challengeId}`, 'text');
  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge expired or not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  await env.TRIPS.delete(`admin:challenge:${body.challengeId}`);

  const origin = new URL(request.url).origin;
  const rpID = new URL(request.url).hostname;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Verification failed', detail: String(e) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { credential } = verification.registrationInfo;
  const storedCredential = {
    id: credential.id,
    publicKey: Array.from(credential.publicKey), // number[] — JSON-serialisable
    counter: credential.counter,
    transports: credential.transports ?? [],
  };

  await env.TRIPS.put('admin:credential', JSON.stringify(storedCredential));

  const headers = new Headers({ 'Content-Type': 'application/json' });
  await setAdminSession(headers, env.COOKIE_SIGNING_SECRET);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
```

- [ ] **Step 3: Build to check types**

```bash
bun run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/auth/register-options.ts src/pages/api/admin/auth/register-verify.ts
git commit -m "feat(admin): add passkey registration API endpoints"
```

---

## Task 5: Passkey authentication endpoints + logout

**Files:**
- Create: `src/pages/api/admin/auth/login-options.ts`
- Create: `src/pages/api/admin/auth/login-verify.ts`
- Create: `src/pages/api/admin/auth/logout.ts`

- [ ] **Step 1: Create `src/pages/api/admin/auth/login-options.ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

export const POST: APIRoute = async ({ request }) => {
  const credentialRaw = await env.TRIPS.get('admin:credential', 'text');
  if (!credentialRaw) {
    return new Response(JSON.stringify({ error: 'No passkey registered' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cred = JSON.parse(credentialRaw) as { id: string; transports: string[] };
  const rpID = new URL(request.url).hostname;

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: cred.id, transports: cred.transports as AuthenticatorTransport[] }],
    userVerification: 'required',
  });

  const challengeId = crypto.randomUUID();
  await env.TRIPS.put(`admin:challenge:${challengeId}`, options.challenge, {
    expirationTtl: 120,
  });

  return new Response(JSON.stringify({ options, challengeId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Create `src/pages/api/admin/auth/login-verify.ts`**

```typescript
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { setAdminSession } from '../../../../lib/admin-auth';

export const POST: APIRoute = async ({ request }) => {
  let body: { challengeId: string; response: unknown };
  try {
    body = (await request.json()) as { challengeId: string; response: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const credentialRaw = await env.TRIPS.get('admin:credential', 'text');
  if (!credentialRaw) {
    return new Response(JSON.stringify({ error: 'No passkey registered' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const storedCred = JSON.parse(credentialRaw) as {
    id: string;
    publicKey: number[];
    counter: number;
    transports: string[];
  };

  const challenge = await env.TRIPS.get(`admin:challenge:${body.challengeId}`, 'text');
  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge expired or not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  await env.TRIPS.delete(`admin:challenge:${body.challengeId}`);

  const origin = new URL(request.url).origin;
  const rpID = new URL(request.url).hostname;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: storedCred.id,
        credentialPublicKey: new Uint8Array(storedCred.publicKey),
        counter: storedCred.counter,
        transports: storedCred.transports as AuthenticatorTransport[],
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Verification failed', detail: String(e) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!verification.verified) {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update counter to prevent replay attacks
  storedCred.counter = verification.authenticationInfo.newCounter;
  await env.TRIPS.put('admin:credential', JSON.stringify(storedCred));

  const headers = new Headers({ 'Content-Type': 'application/json' });
  await setAdminSession(headers, env.COOKIE_SIGNING_SECRET);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
```

- [ ] **Step 3: Create `src/pages/api/admin/auth/logout.ts`**

```typescript
import type { APIRoute } from 'astro';
import { clearAdminSession } from '../../../../lib/admin-auth';

export const POST: APIRoute = async () => {
  const headers = new Headers({ Location: '/admin' });
  clearAdminSession(headers);
  return new Response(null, { status: 302, headers });
};
```

- [ ] **Step 4: Build to check types**

```bash
bun run build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/admin/auth/
git commit -m "feat(admin): add passkey login and logout API endpoints"
```

---

## Task 6: Login page + setup page

**Files:**
- Create: `src/pages/admin/index.astro`
- Create: `src/pages/admin/setup.astro`

Both pages use TripLayout for consistent theme/styling. Client-side `<script>` tags import from `@simplewebauthn/browser` — Astro/Vite bundles these automatically.

- [ ] **Step 1: Create `src/pages/admin/index.astro`**

```astro
---
import { env } from 'cloudflare:workers';
import { getAdminSession } from '../../lib/admin-auth';
import TripLayout from '../../layouts/TripLayout.astro';

if (await getAdminSession(Astro.request, env.COOKIE_SIGNING_SECRET)) {
  return Astro.redirect('/admin/trips');
}

const hasCredential = Boolean(await env.TRIPS.get('admin:credential', 'text'));
if (!hasCredential) {
  return Astro.redirect('/admin/setup');
}
---
<TripLayout title="Admin Login">
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">🗺️</div>
        <h1 class="text-2xl font-bold">Waymark Admin</h1>
        <p class="mt-1 text-sm text-[var(--color-text-secondary)]">Authenticate to continue</p>
      </div>
      <button
        id="signin-btn"
        class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        Sign in with passkey
      </button>
      <p id="error-msg" class="text-red-400 text-sm mt-3 text-center hidden"></p>
    </div>
  </div>
  <script>
    import { startAuthentication } from '@simplewebauthn/browser';

    const btn = document.getElementById('signin-btn') as HTMLButtonElement;
    const errMsg = document.getElementById('error-msg') as HTMLParagraphElement;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Authenticating…';
      errMsg.classList.add('hidden');
      try {
        const optRes = await fetch('/api/admin/auth/login-options', { method: 'POST' });
        if (!optRes.ok) throw new Error((await optRes.json() as { error: string }).error);
        const { options, challengeId } = await optRes.json() as { options: unknown; challengeId: string };

        const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });

        const verifyRes = await fetch('/api/admin/auth/login-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId, response }),
          credentials: 'same-origin',
        });
        const data = await verifyRes.json() as { ok?: boolean; error?: string };
        if (data.ok) {
          window.location.href = '/admin/trips';
        } else {
          throw new Error(data.error ?? 'Authentication failed');
        }
      } catch (e) {
        errMsg.textContent = e instanceof Error ? e.message : 'Authentication failed';
        errMsg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Sign in with passkey';
      }
    });
  </script>
</TripLayout>
```

- [ ] **Step 2: Create `src/pages/admin/setup.astro`**

```astro
---
import { env } from 'cloudflare:workers';
import TripLayout from '../../layouts/TripLayout.astro';

const hasCredential = Boolean(await env.TRIPS.get('admin:credential', 'text'));
if (hasCredential) {
  return Astro.redirect('/admin');
}
---
<TripLayout title="Admin Setup">
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">🔑</div>
        <h1 class="text-2xl font-bold">Set up your passkey</h1>
        <p class="mt-1 text-sm text-[var(--color-text-secondary)]">
          One-time setup. Uses your device biometric or security key.
        </p>
      </div>
      <button
        id="register-btn"
        class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
      >
        Register passkey
      </button>
      <p id="error-msg" class="text-red-400 text-sm mt-3 text-center hidden"></p>
    </div>
  </div>
  <script>
    import { startRegistration } from '@simplewebauthn/browser';

    const btn = document.getElementById('register-btn') as HTMLButtonElement;
    const errMsg = document.getElementById('error-msg') as HTMLParagraphElement;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Registering…';
      errMsg.classList.add('hidden');
      try {
        const optRes = await fetch('/api/admin/auth/register-options', { method: 'POST' });
        if (!optRes.ok) throw new Error((await optRes.json() as { error: string }).error);
        const { options, challengeId } = await optRes.json() as { options: unknown; challengeId: string };

        const response = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] });

        const verifyRes = await fetch('/api/admin/auth/register-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId, response }),
          credentials: 'same-origin',
        });
        const data = await verifyRes.json() as { ok?: boolean; error?: string };
        if (data.ok) {
          window.location.href = '/admin/trips';
        } else {
          throw new Error(data.error ?? 'Registration failed');
        }
      } catch (e) {
        errMsg.textContent = e instanceof Error ? e.message : 'Registration failed';
        errMsg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Register passkey';
      }
    });
  </script>
</TripLayout>
```

- [ ] **Step 3: Build to check types**

```bash
bun run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/index.astro src/pages/admin/setup.astro
git commit -m "feat(admin): add passkey login and setup pages"
```

---

## Task 7: Trip list page

**Files:**
- Create: `src/pages/admin/trips/index.astro`

Uses `listTrips` from `kv.ts` directly (no HTTP round-trip). Status computed from dates — `TripSummary` doesn't carry timezone so a simple ISO date comparison is used.

- [ ] **Step 1: Create `src/pages/admin/trips/index.astro`**

```astro
---
import { env } from 'cloudflare:workers';
import { requireAdminSession } from '../../../lib/admin-auth';
import { listTrips } from '../../../lib/kv';
import TripLayout from '../../../layouts/TripLayout.astro';

const redirect = await requireAdminSession(Astro.request, env.COOKIE_SIGNING_SECRET);
if (redirect) return redirect;

const trips = await listTrips(env.TRIPS);
// Sort most-recently-updated first
trips.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

function getStatus(startDate: string, endDate: string): 'upcoming' | 'live' | 'completed' {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'completed';
  return 'live';
}

const statusClass = {
  upcoming: 'bg-blue-900/40 text-blue-300',
  live: 'bg-green-900/40 text-green-300',
  completed: 'bg-gray-800 text-gray-400',
} as const;
---
<TripLayout title="Admin — Trips">
  <div class="max-w-3xl mx-auto px-4 py-10">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">All Trips</h1>
      <div class="flex items-center gap-3">
        <a
          href="/admin/trips/new"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Trip
        </a>
        <form method="POST" action="/api/admin/auth/logout">
          <button
            type="submit"
            class="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </div>

    {trips.length === 0 ? (
      <p class="text-[var(--color-text-secondary)]">
        No trips yet.{' '}
        <a href="/admin/trips/new" class="text-blue-400 hover:underline">Create one</a>.
      </p>
    ) : (
      <div class="flex flex-col gap-2">
        {trips.map((trip) => {
          const status = getStatus(trip.startDate, trip.endDate);
          return (
            <a
              href={`/admin/trips/${trip.id}`}
              class="flex items-center justify-between p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-500 transition-colors"
            >
              <div class="min-w-0">
                <div class="font-medium truncate">{trip.title}</div>
                <div class="text-sm text-[var(--color-text-secondary)] mt-0.5">
                  {trip.startDate} – {trip.endDate}
                  <span class="font-mono text-xs ml-2 opacity-50">{trip.id}</span>
                </div>
              </div>
              <span class={`ml-4 shrink-0 text-xs px-2 py-0.5 rounded-full ${statusClass[status]}`}>
                {status}
              </span>
            </a>
          );
        })}
      </div>
    )}
  </div>
</TripLayout>
```

- [ ] **Step 2: Build and verify**

```bash
bun run build
```

Expected: clean build.

- [ ] **Step 3: Manual smoke test**

```bash
bun run dev
```

Visit `http://localhost:4321/admin/setup` — register a passkey. After registration, visit `http://localhost:4321/admin/trips` — the list should render (empty or with existing trips). Confirm "Log out" form submits and redirects back to `/admin`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/trips/index.astro
git commit -m "feat(admin): add trip list page"
```

---

## Task 8: Trip editor — edit page + new trip page

**Files:**
- Create: `src/pages/admin/trips/[id].astro`
- Create: `src/pages/admin/trips/new.astro`

Both pages render the same editor UI. The edit page loads an existing trip from KV; the new page generates a fresh ID server-side and pre-seeds an empty template. Both tabs (Info and Raw JSON) save to `POST /api/admin/trips/upsert` via `fetch`. The CodeMirror JSON editor runs client-side via a Vite-bundled `<script>`.

**Important:** `pinSalt` and `pinHash` are required by `ItinerarySchema`. For the edit page, these are preserved from the loaded trip. For the new trip page, the user must set a PIN — the form validates this before save. For an empty new trip, `days: []` is the minimum valid array; `transportLegs` and `pois` default to `[]`.

- [ ] **Step 1: Create `src/pages/admin/trips/[id].astro`**

```astro
---
import { env } from 'cloudflare:workers';
import { requireAdminSession } from '../../../lib/admin-auth';
import { getTrip } from '../../../lib/kv';
import TripLayout from '../../../layouts/TripLayout.astro';

const redirect = await requireAdminSession(Astro.request, env.COOKIE_SIGNING_SECRET);
if (redirect) return redirect;

const { id } = Astro.params;
if (!id) return Astro.redirect('/admin/trips');

const trip = await getTrip(env.TRIPS, id);
if (!trip) {
  return new Response('Trip not found', { status: 404 });
}

const complexData = {
  days: trip.days,
  stays: trip.stays ?? [],
  transportLegs: trip.transportLegs ?? [],
  pois: trip.pois ?? [],
  map: trip.map ?? null,
  notes: trip.notes ?? null,
};
---
<TripLayout title={`Admin — ${trip.title}`}>
  <div class="max-w-2xl mx-auto px-4 py-10">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <a href="/admin/trips" class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          ← Trips
        </a>
        <h1 class="text-xl font-bold">{trip.title}</h1>
        <span class="font-mono text-xs text-[var(--color-text-secondary)]">{trip.id}</span>
      </div>
      <form method="POST" action="/api/admin/auth/logout">
        <button type="submit" class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Log out</button>
      </form>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-[var(--color-border)] mb-6">
      <button id="tab-info" class="tab-btn px-4 py-2 text-sm font-medium border-b-2 border-blue-500 text-blue-400">Info</button>
      <button id="tab-raw" class="tab-btn px-4 py-2 text-sm font-medium border-b-2 border-transparent text-[var(--color-text-secondary)]">Raw JSON</button>
    </div>

    <!-- Info Tab -->
    <div id="panel-info">
      <form id="info-form" class="flex flex-col gap-4">
        <input type="hidden" name="id" value={trip.id} />
        <input type="hidden" name="pinSalt" value={trip.pinSalt} />
        <input type="hidden" name="pinHash" value={trip.pinHash} />
        <input type="hidden" name="updatedAt" value={new Date().toISOString()} />

        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Title</label>
          <input name="title" value={trip.title} required
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Start Date</label>
            <input name="startDate" type="date" value={trip.startDate} required
              class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">End Date</label>
            <input name="endDate" type="date" value={trip.endDate} required
              class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Timezone</label>
            <input name="timezone" value={trip.timezone} required placeholder="America/New_York"
              class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Destinations (comma-separated)</label>
            <input name="destinations" value={trip.destinations.join(', ')} required
              class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Travelers (optional, comma-separated)</label>
            <input name="travelers" value={(trip.travelers ?? []).join(', ')}
              class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Summary (optional)</label>
          <textarea name="summary" rows="2"
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500 resize-none"
          >{trip.summary ?? ''}</textarea>
        </div>

        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
            New PIN (leave blank to keep existing)
          </label>
          <input name="pin" type="password" placeholder="••••••"
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
            Days / Stays / Transport / POIs / Map (JSON)
          </label>
          <div id="complex-editor" class="rounded-lg border border-[var(--color-border)] overflow-hidden" style="height:260px"></div>
        </div>

        <div class="flex items-center justify-between pt-2">
          <button type="submit"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            Save changes
          </button>
          <button type="button" id="delete-btn"
            class="text-sm text-red-400 hover:text-red-300 transition-colors">
            Delete trip…
          </button>
        </div>
      </form>
      <p id="info-status" class="text-sm mt-3 hidden"></p>
    </div>

    <!-- Raw JSON Tab -->
    <div id="panel-raw" class="hidden">
      <div id="raw-editor" class="rounded-lg border border-[var(--color-border)] overflow-hidden" style="height:500px"></div>
      <div class="flex items-center gap-3 mt-4">
        <button id="raw-save-btn"
          class="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          Save JSON
        </button>
        <p id="raw-status" class="text-sm hidden"></p>
      </div>
    </div>
  </div>

  <!-- Pass server data to client via data attributes (define:vars disables ES module bundling) -->
  <div
    id="trip-data"
    data-complex={JSON.stringify(complexData)}
    data-trip-json={JSON.stringify(trip, null, 2)}
    data-trip-id={trip.id}
    class="hidden"
  ></div>

  <script>
    import { EditorView, basicSetup } from 'codemirror';
    import { json } from '@codemirror/lang-json';

    const dataEl = document.getElementById('trip-data')!;
    const complexData = JSON.parse(dataEl.dataset.complex!);
    const tripJson = dataEl.dataset.tripJson!;
    const tripId = dataEl.dataset.tripId!;

    // --- Tab switching ---
    const tabInfo = document.getElementById('tab-info');
    const tabRaw = document.getElementById('tab-raw');
    const panelInfo = document.getElementById('panel-info');
    const panelRaw = document.getElementById('panel-raw');

    function activateTab(which) {
      const isInfo = which === 'info';
      tabInfo.classList.toggle('border-blue-500', isInfo);
      tabInfo.classList.toggle('text-blue-400', isInfo);
      tabInfo.classList.toggle('border-transparent', !isInfo);
      tabInfo.classList.toggle('text-[var(--color-text-secondary)]', !isInfo);
      tabRaw.classList.toggle('border-blue-500', !isInfo);
      tabRaw.classList.toggle('text-blue-400', !isInfo);
      tabRaw.classList.toggle('border-transparent', isInfo);
      tabRaw.classList.toggle('text-[var(--color-text-secondary)]', isInfo);
      panelInfo.classList.toggle('hidden', !isInfo);
      panelRaw.classList.toggle('hidden', isInfo);
    }

    tabInfo.addEventListener('click', () => activateTab('info'));
    tabRaw.addEventListener('click', () => activateTab('raw'));

    // --- CodeMirror editors ---
    const complexEditor = new EditorView({
      doc: JSON.stringify(complexData, null, 2),
      extensions: [basicSetup, json()],
      parent: document.getElementById('complex-editor'),
    });

    const rawEditor = new EditorView({
      doc: tripJson,
      extensions: [basicSetup, json()],
      parent: document.getElementById('raw-editor'),
    });

    // --- Info form save ---
    async function saveTrip(payload) {
      const res = await fetch('/api/admin/trips/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
      });
      return res.json();
    }

    const infoForm = document.getElementById('info-form');
    const infoStatus = document.getElementById('info-status');

    infoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(infoForm);
      const submitBtn = infoForm.querySelector('button[type=submit]');
      submitBtn.disabled = true;

      let complexParsed;
      try {
        complexParsed = JSON.parse(complexEditor.state.doc.toString());
      } catch {
        infoStatus.textContent = 'Complex data JSON is invalid — fix syntax errors before saving.';
        infoStatus.className = 'text-sm mt-3 text-red-400';
        infoStatus.classList.remove('hidden');
        submitBtn.disabled = false;
        return;
      }

      const pin = fd.get('pin');
      const payload = {
        id: fd.get('id'),
        title: fd.get('title'),
        startDate: fd.get('startDate'),
        endDate: fd.get('endDate'),
        timezone: fd.get('timezone'),
        destinations: fd.get('destinations').split(',').map(s => s.trim()).filter(Boolean),
        travelers: fd.get('travelers') ? fd.get('travelers').split(',').map(s => s.trim()).filter(Boolean) : [],
        summary: fd.get('summary') || undefined,
        pinSalt: fd.get('pinSalt'),
        pinHash: fd.get('pinHash'),
        updatedAt: new Date().toISOString(),
        ...complexParsed,
        ...(pin ? { pin } : {}),
      };

      try {
        const data = await saveTrip(payload);
        if (data.ok) {
          infoStatus.textContent = 'Saved.';
          infoStatus.className = 'text-sm mt-3 text-green-400';
        } else {
          infoStatus.textContent = data.error ?? 'Save failed';
          infoStatus.className = 'text-sm mt-3 text-red-400';
        }
      } catch (err) {
        infoStatus.textContent = 'Network error';
        infoStatus.className = 'text-sm mt-3 text-red-400';
      }
      infoStatus.classList.remove('hidden');
      submitBtn.disabled = false;
    });

    // --- Raw JSON save ---
    const rawSaveBtn = document.getElementById('raw-save-btn');
    const rawStatus = document.getElementById('raw-status');

    rawSaveBtn.addEventListener('click', async () => {
      rawSaveBtn.disabled = true;
      let parsed;
      try {
        parsed = JSON.parse(rawEditor.state.doc.toString());
      } catch {
        rawStatus.textContent = 'Invalid JSON — fix syntax errors before saving.';
        rawStatus.className = 'text-sm text-red-400';
        rawStatus.classList.remove('hidden');
        rawSaveBtn.disabled = false;
        return;
      }
      try {
        const data = await saveTrip(parsed);
        if (data.ok) {
          rawStatus.textContent = 'Saved.';
          rawStatus.className = 'text-sm text-green-400';
        } else {
          rawStatus.textContent = JSON.stringify(data.issues ?? data.error ?? 'Save failed');
          rawStatus.className = 'text-sm text-red-400';
        }
      } catch {
        rawStatus.textContent = 'Network error';
        rawStatus.className = 'text-sm text-red-400';
      }
      rawStatus.classList.remove('hidden');
      rawSaveBtn.disabled = false;
    });

    // --- Delete ---
    const deleteBtn = document.getElementById('delete-btn');
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete trip "${tripId}"? This cannot be undone.`)) return;
      const res = await fetch('/api/admin/trips/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tripId }),
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = '/admin/trips';
      } else {
        alert(data.error ?? 'Delete failed');
      }
    });
  </script>
</TripLayout>
```

- [ ] **Step 2: Create `src/pages/admin/trips/new.astro`**

The new trip ID is generated server-side. A minimal empty template satisfies `ItinerarySchema` (days required as array; transportLegs/pois default to []). PIN is required for new trips — the save handler validates this.

```astro
---
import { env } from 'cloudflare:workers';
import { requireAdminSession } from '../../../lib/admin-auth';
import TripLayout from '../../../layouts/TripLayout.astro';

const redirect = await requireAdminSession(Astro.request, env.COOKIE_SIGNING_SECRET);
if (redirect) return redirect;

// Generate an 8-char lowercase alphanumeric ID server-side
function generateTripId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes)
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '0')
    .slice(0, 8);
}

const newId = generateTripId();
const today = new Date().toISOString().slice(0, 10);

const emptyComplexData = {
  days: [],
  stays: [],
  transportLegs: [],
  pois: [],
  map: null,
  notes: null,
};
---
<TripLayout title="Admin — New Trip">
  <div class="max-w-2xl mx-auto px-4 py-10">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <a href="/admin/trips" class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          ← Trips
        </a>
        <h1 class="text-xl font-bold">New Trip</h1>
        <span class="font-mono text-xs text-[var(--color-text-secondary)]">{newId}</span>
      </div>
      <form method="POST" action="/api/admin/auth/logout">
        <button type="submit" class="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Log out</button>
      </form>
    </div>

    <form id="new-trip-form" class="flex flex-col gap-4">
      <input type="hidden" name="id" value={newId} />
      <input type="hidden" name="updatedAt" value={new Date().toISOString()} />

      <div>
        <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Title</label>
        <input name="title" required placeholder="Paris Spring 2026"
          class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Start Date</label>
          <input name="startDate" type="date" value={today} required
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">End Date</label>
          <input name="endDate" type="date" value={today} required
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Timezone</label>
          <input name="timezone" required placeholder="America/New_York"
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Destinations (comma-separated)</label>
          <input name="destinations" required placeholder="Paris, Lyon"
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Travelers (optional)</label>
          <input name="travelers" placeholder="Alice, Bob"
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div>
        <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">Summary (optional)</label>
        <textarea name="summary" rows="2" placeholder="A short trip description…"
          class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500 resize-none"></textarea>
      </div>

      <div>
        <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
          PIN <span class="text-red-400">*</span> (required — controls trip access)
        </label>
        <input name="pin" type="password" required placeholder="Set an access PIN"
          class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <div>
        <label class="block text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
          Days / Stays / Transport / POIs / Map (JSON)
        </label>
        <div id="complex-editor" class="rounded-lg border border-[var(--color-border)] overflow-hidden" style="height:200px"></div>
      </div>

      <div class="pt-2">
        <button type="submit"
          class="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          Create trip
        </button>
      </div>
    </form>
    <p id="form-status" class="text-sm mt-3 hidden"></p>
  </div>

  <!-- Pass server data to client via data attributes (define:vars disables ES module bundling) -->
  <div
    id="trip-data"
    data-complex={JSON.stringify(emptyComplexData)}
    data-trip-id={newId}
    class="hidden"
  ></div>

  <script>
    import { EditorView, basicSetup } from 'codemirror';
    import { json } from '@codemirror/lang-json';

    const dataEl = document.getElementById('trip-data')!;
    const complexData = JSON.parse(dataEl.dataset.complex!);
    const newId = dataEl.dataset.tripId!;

    const complexEditor = new EditorView({
      doc: JSON.stringify(complexData, null, 2),
      extensions: [basicSetup, json()],
      parent: document.getElementById('complex-editor'),
    });

    const form = document.getElementById('new-trip-form');
    const formStatus = document.getElementById('form-status');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type=submit]');
      submitBtn.disabled = true;

      const fd = new FormData(form);

      let complexParsed;
      try {
        complexParsed = JSON.parse(complexEditor.state.doc.toString());
      } catch {
        formStatus.textContent = 'Complex data JSON is invalid — fix syntax errors before saving.';
        formStatus.className = 'text-sm text-red-400';
        formStatus.classList.remove('hidden');
        submitBtn.disabled = false;
        return;
      }

      const pin = fd.get('pin');
      if (!pin) {
        formStatus.textContent = 'PIN is required.';
        formStatus.className = 'text-sm text-red-400';
        formStatus.classList.remove('hidden');
        submitBtn.disabled = false;
        return;
      }

      const payload = {
        id: fd.get('id'),
        title: fd.get('title'),
        startDate: fd.get('startDate'),
        endDate: fd.get('endDate'),
        timezone: fd.get('timezone'),
        destinations: fd.get('destinations').split(',').map(s => s.trim()).filter(Boolean),
        travelers: fd.get('travelers') ? fd.get('travelers').split(',').map(s => s.trim()).filter(Boolean) : [],
        summary: fd.get('summary') || undefined,
        updatedAt: new Date().toISOString(),
        pin,
        ...complexParsed,
      };

      try {
        const res = await fetch('/api/admin/trips/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (data.ok) {
          window.location.href = `/admin/trips/${newId}`;
        } else {
          formStatus.textContent = JSON.stringify(data.issues ?? data.error ?? 'Save failed');
          formStatus.className = 'text-sm text-red-400';
          formStatus.classList.remove('hidden');
          submitBtn.disabled = false;
        }
      } catch {
        formStatus.textContent = 'Network error';
        formStatus.className = 'text-sm text-red-400';
        formStatus.classList.remove('hidden');
        submitBtn.disabled = false;
      }
    });
  </script>
</TripLayout>
```

- [ ] **Step 3: Build to check types**

```bash
bun run build
```

Expected: clean build.

- [ ] **Step 4: Full end-to-end smoke test**

```bash
bun run dev
```

Run through each verification step:
1. Visit `/admin/setup` → register passkey → confirm redirect to `/admin/trips`
2. Trip list renders existing trips (or empty state)
3. Click "New Trip" → fill title, dates, timezone, destinations, PIN → create → redirects to editor
4. Edit the new trip via Info tab → change title → save → "Saved." appears
5. Switch to Raw JSON tab → edit a field → save → "Saved." appears
6. Open the public trip page at `/trip/{id}` → confirm PIN gate works with the PIN you set
7. Delete the test trip → redirects to list
8. CLI Bearer token: `curl -s -H "Authorization: Bearer $ADMIN_API_TOKEN" http://localhost:4321/api/admin/trips | jq .count`
9. Log out → redirects to `/admin` login

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/trips/
git commit -m "feat(admin): add trip editor, edit page, and new trip page"
```

---

## Final: Deploy

```bash
bun run deploy
```

Visit `https://waymark.itsaydrian.com/admin/setup` to register your passkey on the production domain.

> The passkey credential is domain-scoped — registering on localhost does **not** carry over to the production domain. You must register once per origin.
