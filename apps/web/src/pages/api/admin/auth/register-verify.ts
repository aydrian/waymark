import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { setAdminSession } from '../../../../lib/admin-auth.js';

export const POST: APIRoute = async ({ request }) => {
  let body: { challengeId: string; response: unknown };
  try {
    body = (await request.json()) as { challengeId: string; response: unknown };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const challenge = await env.TRIPS.get(`admin:challenge:${body.challengeId}`, 'text');
  if (!challenge) {
    return new Response(JSON.stringify({ error: 'Challenge expired or not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  await env.TRIPS.delete(`admin:challenge:${body.challengeId}`);

  const origin = new URL(request.url).origin;
  const rpID = new URL(request.url).hostname;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Verification failed', detail: String(e) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { credential } = verification.registrationInfo;
  const storedCredential = {
    id: credential.id,
    publicKey: Array.from(credential.publicKey), // number[] — JSON-serialisable
    counter: credential.counter,
    transports: credential.transports ?? [],
  };

  await env.TRIPS.put('admin:credential', JSON.stringify(storedCredential));

  const headers = new Headers({ 'Content-Type': 'application/json' });
  await setAdminSession(headers, env.COOKIE_SIGNING_SECRET);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
