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
