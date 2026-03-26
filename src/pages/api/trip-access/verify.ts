import type { APIRoute } from 'astro';
import { getTrip } from '../../../lib/kv';
import { verifyPin } from '../../../lib/pin';
import { signTripCookie, buildSetCookieHeader } from '../../../lib/cookie';
import { z } from 'zod';

const BodySchema = z.object({
  id: z.string(),
  pin: z.string().min(1).max(20),
});

export const POST: APIRoute = async ({ request, locals }) => {
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
  const trip = await getTrip(locals.runtime.env.TRIPS, id);
  if (!trip) {
    // Return 401 (not 404) to avoid leaking trip existence via timing
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

  const cookieValue = await signTripCookie(id, locals.runtime.env.COOKIE_SIGNING_SECRET);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSetCookieHeader(cookieValue),
    },
  });
};
