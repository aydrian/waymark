import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { setAdminSession } from '../../../../lib/admin-auth';

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

  const credentialRaw = await env.TRIPS.get('admin:credential', 'text');
  if (!credentialRaw) {
    return new Response(JSON.stringify({ error: 'No passkey registered' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const storedCred = JSON.parse(credentialRaw) as {
    id: string;
    publicKey: number[];
    counter: number;
    transports: string[];
  };

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
    verification = await verifyAuthenticationResponse({
      response: body.response as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: storedCred.id,
        credentialPublicKey: new Uint8Array(storedCred.publicKey),
        counter: storedCred.counter,
        transports: storedCred.transports as AuthenticatorTransport[],
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Verification failed', detail: String(e) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!verification.verified) {
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update counter to prevent replay attacks
  storedCred.counter = verification.authenticationInfo.newCounter;
  await env.TRIPS.put('admin:credential', JSON.stringify(storedCred));

  const headers = new Headers({ 'Content-Type': 'application/json' });
  await setAdminSession(headers, env.COOKIE_SIGNING_SECRET);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
