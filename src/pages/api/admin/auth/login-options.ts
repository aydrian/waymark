import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

export const POST: APIRoute = async ({ request }) => {
  const credentialRaw = await env.TRIPS.get('admin:credential', 'text');
  if (!credentialRaw) {
    return new Response(JSON.stringify({ error: 'No passkey registered' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cred = JSON.parse(credentialRaw) as { id: string; transports: string[] };
  const rpID = new URL(request.url).hostname;

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: cred.id, transports: cred.transports as AuthenticatorTransport[] }],
    userVerification: 'required',
  });

  const challengeId = crypto.randomUUID();
  await env.TRIPS.put(`admin:challenge:${challengeId}`, options.challenge, {
    expirationTtl: 120,
  });

  return new Response(JSON.stringify({ options, challengeId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
