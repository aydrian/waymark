import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import * as SimpleWebAuthnServer from '@simplewebauthn/server';
import { setAdminSession } from '../../../../lib/admin-auth.js';

export const POST: APIRoute = async ({ request }) => {
  let body: { challengeId: string; response: SimpleWebAuthnServer.AuthenticationResponseJSON };
  try {
    body = (await request.json()) as { challengeId: string; response: SimpleWebAuthnServer.AuthenticationResponseJSON };
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

  const parsed = JSON.parse(credentialRaw) as {
    id: string;
    publicKey: number[];
    counter: number;
    transports: string[];
  };

  // Ensure proper types - counter must be a number, not undefined
  const storedCred = {
    id: parsed.id,
    publicKey: parsed.publicKey,
    counter: typeof parsed.counter === 'number' ? parsed.counter : 0,
    transports: parsed.transports ?? [],
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

  // Ensure publicKey is a proper array before creating Uint8Array
  const publicKeyArray = Array.isArray(storedCred.publicKey)
    ? storedCred.publicKey
    : Object.values(storedCred.publicKey);

  // Build credential object matching SimpleWebAuthn v13's WebAuthnCredential type:
  // { id: Base64URLString, publicKey: Uint8Array, counter: number, transports?: ... }
  const credential: SimpleWebAuthnServer.WebAuthnCredential = {
    id: storedCred.id,
    publicKey: new Uint8Array(publicKeyArray),
    counter: storedCred.counter,
    transports: storedCred.transports as SimpleWebAuthnServer.AuthenticatorTransportFuture[],
  };

  let verification: SimpleWebAuthnServer.VerifiedAuthenticationResponse;
  try {
    verification = await SimpleWebAuthnServer.verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Verification failed', detail: e instanceof Error ? e.message : String(e) }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!verification.verified || !verification.authenticationInfo) {
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Update counter to prevent replay attacks
  storedCred.counter = verification.authenticationInfo.newCounter;
  await env.TRIPS.put('admin:credential', JSON.stringify(storedCred));

  const headers = new Headers({ 'Content-Type': 'application/json' });
  await setAdminSession(headers, env.COOKIE_SIGNING_SECRET);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
