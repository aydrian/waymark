import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { generateRegistrationOptions } from '@simplewebauthn/server';

const RP_NAME = 'Waymark Admin';

export const POST: APIRoute = async ({ request }) => {
  const rpID = new URL(request.url).hostname;

  // Include existing credential in excludeCredentials to prevent accidental re-registration
  const existingRaw = await env.TRIPS.get('admin:credential', 'text');
  const excludeCredentials = existingRaw
    ? [{ id: (JSON.parse(existingRaw) as { id: string }).id }]
    : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: 'admin',
    userID: new TextEncoder().encode('waymark-admin'),
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
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
