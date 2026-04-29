import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../../../lib/admin-auth.js';
import { getTrip, putTrip, getGlobalPOI } from '@waymark/shared/lib';
import { TripPOIReferenceSchema } from '@waymark/shared/types';

const CreateTripPOIReferenceSchema = TripPOIReferenceSchema.omit({ addedAt: true });

// POST /api/admin/trips/[id]/pois - Add a global POI reference to a trip
export const POST: APIRoute = async ({ params, request }) => {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = CreateTripPOIReferenceSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify the global POI exists
  const globalPOI = await getGlobalPOI(env.TRIPS, result.data.poiId);
  if (!globalPOI) {
    return new Response(JSON.stringify({ error: 'Global POI not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check if already added to this trip
  const alreadyExists = trip.poiReferences?.some(ref => ref.poiId === result.data.poiId);
  if (alreadyExists) {
    return new Response(JSON.stringify({ error: 'POI already added to this trip' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const reference = {
    ...result.data,
    addedAt: new Date().toISOString(),
  };

  const updatedTrip = {
    ...trip,
    poiReferences: [...(trip.poiReferences ?? []), reference],
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify({ reference, globalPOI }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
