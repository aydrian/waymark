import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth.js';
import { putTrip, getTrip, hashPin, generateSalt } from '@itsaydrian/waymark-shared/lib';
import { ItinerarySchema } from '@itsaydrian/waymark-shared/types';

export const POST: APIRoute = async ({ request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If a plain `pin` string is provided, hash it server-side and inject pinSalt/pinHash
  if (typeof body.pin === 'string') {
    const pin = body.pin;
    delete body.pin;
    if (pin.length > 0) {
      const salt = generateSalt();
      const hash = await hashPin(pin, salt);
      body.pinSalt = salt;
      body.pinHash = hash;
    }
  }

  // Auto-set statusChangedAt when status changes on existing trips
  const existing = await getTrip(env.TRIPS, body.id as string);
  if (existing && typeof body.status === 'string' && body.status !== existing.status) {
    body.statusChangedAt = new Date().toISOString();
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
