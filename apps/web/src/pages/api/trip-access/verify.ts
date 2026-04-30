import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getTrip, verifyPin } from '@itsaydrian/waymark-shared/lib';
import { signTripCookie, buildSetCookieHeader } from '../../../lib/cookie';
import { z } from 'zod';

// Sentinel used for constant-time dummy PIN check when trip is not found
const SENTINEL_SALT = '0000000000000000000000000000000000000000';
const SENTINEL_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const BodySchema = z.object({
  id: z.string(),
  pin: z.string().min(1).max(20),
});

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = BodySchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Missing id or pin' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id, pin } = result.data;
  const trip = await getTrip(env.TRIPS, id);
  if (!trip) {
    // Run dummy verifyPin to match timing of the successful-lookup path
    await verifyPin(pin, SENTINEL_SALT, SENTINEL_HASH);
    return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const valid = await verifyPin(pin, trip.pinSalt, trip.pinHash);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookieValue = await signTripCookie(id, env.COOKIE_SIGNING_SECRET);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSetCookieHeader(cookieValue),
    },
  });
};
