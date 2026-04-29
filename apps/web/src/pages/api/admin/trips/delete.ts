import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { requireAdminAccess } from '../../../../lib/admin-auth.js';
import { deleteTrip } from '@waymark/shared/lib';
import { z } from 'zod';

const DeleteBodySchema = z.object({ id: z.string() });

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

  const result = DeleteBodySchema.safeParse(body);
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Missing id field' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deleted = await deleteTrip(env.TRIPS, result.data.id);

  return new Response(JSON.stringify({ ok: true, deleted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
