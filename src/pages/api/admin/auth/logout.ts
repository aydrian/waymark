import type { APIRoute } from 'astro';
import { clearAdminSession } from '../../../../lib/admin-auth';

export const POST: APIRoute = async () => {
  const headers = new Headers({ Location: '/admin' });
  clearAdminSession(headers);
  return new Response(null, { status: 302, headers });
};
