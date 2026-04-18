import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth';
import { getGlobalPOI, putGlobalPOI, listGlobalPOIs } from '../../../../lib/kv';
import { GlobalPOISchema } from '../../../../types/itinerary';

const CreateGlobalPOISchema = GlobalPOISchema.omit({ id: true, createdAt: true, updatedAt: true });

// GET /api/admin/pois - List all global POIs
export const GET: APIRoute = async ({ request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const pois = await listGlobalPOIs(env.TRIPS);

  // Sort by name for consistent ordering
  pois.sort((a, b) => a.name.localeCompare(b.name));

  return new Response(JSON.stringify(pois), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST /api/admin/pois - Create new global POI
export const POST: APIRoute = async ({ request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = CreateGlobalPOISchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const poi = {
    ...result.data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  await putGlobalPOI(env.TRIPS, poi);

  return new Response(JSON.stringify(poi), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
