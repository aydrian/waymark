import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../../../lib/admin-auth';
import { getTrip, putTrip } from '../../../../../../lib/kv';
import { PlaceOfInterestSchema } from '../../../../../../types/itinerary';

const UpdatePoiSchema = PlaceOfInterestSchema.omit({ id: true }).partial();

export const PUT: APIRoute = async ({ params, request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const { id, poiId } = params as { id: string; poiId: string };
  if (!id || !poiId) {
    return new Response(JSON.stringify({ error: 'Missing id or poiId' }), {
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

  const existing = trip.pois.find(p => p.id === poiId);
  if (!existing) {
    return new Response(JSON.stringify({ error: 'POI not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = UpdatePoiSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = { ...existing, ...result.data };
  const updatedTrip = {
    ...trip,
    pois: trip.pois.map(p => p.id === poiId ? updated : p),
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const { id, poiId } = params as { id: string; poiId: string };
  if (!id || !poiId) {
    return new Response(JSON.stringify({ error: 'Missing id or poiId' }), {
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

  const exists = trip.pois.some(p => p.id === poiId);
  if (!exists) {
    return new Response(JSON.stringify({ error: 'POI not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedTrip = {
    ...trip,
    pois: trip.pois.filter(p => p.id !== poiId),
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
