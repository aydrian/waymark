import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../../../lib/admin-auth.js';
import { getTrip, putTrip } from '@itsaydrian/waymark-shared/lib';
import { TripPOIReferenceSchema } from '@itsaydrian/waymark-shared/types';
import { z } from 'zod';

const UpdateTripPOIReferenceSchema = z.object({
  tripAdvisorNotes: z.string().optional(),
});

// PUT /api/admin/trips/[id]/pois/[poiId] - Update trip-specific POI notes
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

  const existingIndex = trip.poiReferences?.findIndex(ref => ref.poiId === poiId);
  if (existingIndex === undefined || existingIndex === -1) {
    return new Response(JSON.stringify({ error: 'POI reference not found' }), {
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

  const result = UpdateTripPOIReferenceSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = trip.poiReferences![existingIndex];
  const updated = { ...existing, ...result.data };
  const updatedReferences = [...(trip.poiReferences ?? [])];
  updatedReferences[existingIndex] = updated;

  const updatedTrip = {
    ...trip,
    poiReferences: updatedReferences,
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// DELETE /api/admin/trips/[id]/pois/[poiId] - Remove POI reference from trip
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

  const exists = trip.poiReferences?.some(ref => ref.poiId === poiId);
  if (!exists) {
    return new Response(JSON.stringify({ error: 'POI reference not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedTrip = {
    ...trip,
    poiReferences: trip.poiReferences?.filter(ref => ref.poiId !== poiId) ?? [],
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
