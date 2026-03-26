import type { APIRoute } from 'astro';
import { requireAdminAuth } from '../../../../lib/auth';
import { getTrip } from '../../../../lib/kv';

export const GET: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAdminAuth(request, locals.runtime.env.ADMIN_API_TOKEN);
  if (authError) return authError;

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trip = await getTrip(locals.runtime.env.TRIPS, id);
  if (!trip) {
    return new Response(JSON.stringify({ error: 'Trip not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(trip), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
