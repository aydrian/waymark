import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyTripAccess } from '../../../../../lib/cookie.js';
import { getTrip, putTrip, getGlobalPOI } from '@itsaydrian/waymark-shared/lib';
import { PoiAssignmentSchema } from '@itsaydrian/waymark-shared/types';

const CreateAssignmentSchema = PoiAssignmentSchema.omit({
  type: true,
  id: true,
  poiSnapshot: true,
  assignedAt: true,
}).extend({
  poiId: z.string(), // Reference to global POI or trip POI reference
});

import { z } from 'zod';

// POST /api/trips/[tripId]/assignments - Create a new POI assignment
export const POST: APIRoute = async ({ params, request }) => {
  const tripId = params.tripId;
  if (!tripId) {
    return new Response(JSON.stringify({ error: 'Missing tripId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authorized = await verifyTripAccess(request, tripId, env.COOKIE_SIGNING_SECRET);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(env.TRIPS, tripId);
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

  const result = CreateAssignmentSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { poiId, dayNumber, startTime, endTime, allDay, clientNotes } = result.data;

  // Verify the day exists
  const day = trip.days.find(d => d.dayNumber === dayNumber);
  if (!day) {
    return new Response(JSON.stringify({ error: 'Day not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get the trip POI reference
  const tripPOIRef = trip.poiReferences?.find(ref => ref.poiId === poiId);
  if (!tripPOIRef) {
    return new Response(JSON.stringify({ error: 'POI not found in trip' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get the global POI data
  const globalPOI = await getGlobalPOI(env.TRIPS, poiId);
  if (!globalPOI) {
    return new Response(JSON.stringify({ error: 'Global POI not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create the assignment with snapshot
  const assignment: z.infer<typeof PoiAssignmentSchema> = {
    type: 'poi-assignment',
    id: crypto.randomUUID(),
    poiSnapshot: {
      id: globalPOI.id,
      name: globalPOI.name,
      category: globalPOI.category,
      city: globalPOI.city,
      address: globalPOI.address,
      lat: globalPOI.lat,
      lng: globalPOI.lng,
      website: globalPOI.website,
      googleMapsUrl: globalPOI.googleMapsUrl,
      description: globalPOI.description,
      advisorNotes: globalPOI.advisorNotes,
      tripAdvisorNotes: tripPOIRef.tripAdvisorNotes,
      clientNotes: clientNotes,
    },
    dayNumber,
    startTime,
    endTime,
    allDay: allDay ?? false,
    assignedAt: new Date().toISOString(),
  };

  // Add to day's items
  const updatedDays = trip.days.map(d =>
    d.dayNumber === dayNumber
      ? { ...d, items: [...d.items, assignment] }
      : d
  );

  const updatedTrip = {
    ...trip,
    days: updatedDays,
    updatedAt: new Date().toISOString(),
  };

  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify(assignment), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
