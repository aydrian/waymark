import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth';
import { listTrips } from '../../../../lib/kv';

export const GET: APIRoute = async ({ request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const trips = await listTrips(env.TRIPS);
  return new Response(JSON.stringify({ trips, count: trips.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
