import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth.js';
import { getGlobalPOI, putGlobalPOI, deleteGlobalPOI } from '@waymark/shared/lib';
import { GlobalPOISchema } from '@waymark/shared/types';

const UpdateGlobalPOISchema = GlobalPOISchema.omit({ id: true, createdAt: true, updatedAt: true }).partial();

// PUT /api/admin/pois/[poiId] - Update global POI
export const PUT: APIRoute = async ({ params, request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const poiId = params.poiId;
  if (!poiId) {
    return new Response(JSON.stringify({ error: 'Missing poiId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existing = await getGlobalPOI(env.TRIPS, poiId);
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

  const result = UpdateGlobalPOISchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedPOI = {
    ...existing,
    ...result.data,
    updatedAt: new Date().toISOString(),
  };

  await putGlobalPOI(env.TRIPS, updatedPOI);

  return new Response(JSON.stringify(updatedPOI), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// DELETE /api/admin/pois/[poiId] - Delete global POI
export const DELETE: APIRoute = async ({ params, request }) => {
  const authError = await requireAdminAccess(request, env.ADMIN_API_TOKEN, env.COOKIE_SIGNING_SECRET);
  if (authError) return authError;

  const poiId = params.poiId;
  if (!poiId) {
    return new Response(JSON.stringify({ error: 'Missing poiId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deleted = await deleteGlobalPOI(env.TRIPS, poiId);
  if (!deleted) {
    return new Response(JSON.stringify({ error: 'POI not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
