/** Extract bearer token from Authorization header */
export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

/** Constant-time string comparison */
function safeEqual(a: string, b: string): boolean {
  // Always iterate full length of `a` to avoid leaking length of `b`
  const len = a.length;
  let diff = a.length ^ b.length; // non-zero if different lengths
  for (let i = 0; i < len; i++) {
    diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) ?? 0);
  }
  return diff === 0;
}

/** Validate bearer token against ADMIN_API_TOKEN; returns 401 Response or null */
export function requireAdminAuth(request: Request, adminToken: string): Response | null {
  const token = getBearerToken(request);
  if (!token || !safeEqual(token, adminToken)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}
