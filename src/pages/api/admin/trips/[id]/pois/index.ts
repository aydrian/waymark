import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../../../lib/admin-auth';
import { getTrip, putTrip } from '../../../../../../lib/kv';
import { PlaceOfInterestSchema } from '../../../../../../types/itinerary';

const CreatePoiSchema = PlaceOfInterestSchema.omit({ id: true });

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

  const result = CreatePoiSchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const poi = { ...result.data, id: crypto.randomUUID() };
  const updatedTrip = {
    ...trip,
    pois: [...trip.pois, poi],
    updatedAt: new Date().toISOString(),
  };
  await putTrip(env.TRIPS, updatedTrip);

  return new Response(JSON.stringify(poi), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
