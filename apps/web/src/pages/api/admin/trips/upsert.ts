import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth.js';
import { putTrip, hashPin, generateSalt } from '@waymark/shared/lib';
import { ItinerarySchema } from '@waymark/shared/types';

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
