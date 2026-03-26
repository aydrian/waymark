const enc = new TextEncoder();

const COOKIE_NAME = 'waymark_access';
const COOKIE_TTL_DAYS = 7;

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Create a signed cookie value for a trip: "{tripId}:{expiry}:{signature}" */
export async function signTripCookie(tripId: string, secret: string): Promise<string> {
  const expiry = Date.now() + COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${tripId}:${expiry}`;
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return `${payload}:${toHex(sig)}`;
}

/** Verify a signed cookie value; returns tripId if valid, null otherwise */
export async function verifyTripCookie(
  cookieValue: string,
  secret: string,
): Promise<string | null> {
  const firstColon = cookieValue.indexOf(':');
  const secondColon = cookieValue.indexOf(':', firstColon + 1);
  if (firstColon === -1 || secondColon === -1) return null;
  const tripId = cookieValue.slice(0, firstColon);
  const expiryStr = cookieValue.slice(firstColon + 1, secondColon);
  const sig = cookieValue.slice(secondColon + 1);
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) return null;
  const payload = `${tripId}:${expiryStr}`;
  const key = await getHmacKey(secret);
  const expectedSig = toHex(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  // Constant-time comparison
  if (expectedSig.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0 ? tripId : null;
}

export function cookieName(): string {
  return COOKIE_NAME;
}

/** Parse cookies from a Cookie header string */
export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map(c => {
      const idx = c.indexOf('=');
      if (idx === -1) return [decodeURIComponent(c.trim()), ''] as [string, string];
      return [
        decodeURIComponent(c.slice(0, idx).trim()),
        decodeURIComponent(c.slice(idx + 1)),
      ] as [string, string];
    }),
  );
}

/** Build a Set-Cookie header value (HttpOnly, Secure, SameSite=Lax) */
export function buildSetCookieHeader(value: string): string {
  const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
