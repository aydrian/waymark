import type { APIRoute } from 'astro';
import { requireAdminAuth } from '../../../../lib/auth';
import { putTrip } from '../../../../lib/kv';
import { ItinerarySchema } from '../../../../types/itinerary';

export const POST: APIRoute = async ({ request, locals }) => {
  const authError = requireAdminAuth(request, locals.runtime.env.ADMIN_API_TOKEN);
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

  const result = ItinerarySchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Validation failed', issues: result.error.issues }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await putTrip(locals.runtime.env.TRIPS, result.data);

  return new Response(JSON.stringify({ ok: true, id: result.data.id, updatedAt: result.data.updatedAt }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
