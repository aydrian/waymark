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
