import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyResendWebhook, extractEmailFields } from '../../lib/server/resend-webhook';
import { parseSenderAllowList, isSenderAllowed } from '../../lib/server/sender-allowlist';
import { resolveAgentFromRecipient } from '../../lib/server/email-routing';
import { dispatchToAgent } from '../../lib/server/agent-dispatch';
import { fetchReceivedEmailContent } from '../../lib/server/resend-email-fetch';

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

const WEBHOOK_DEDUP_KEY = (svixId: string) => `webhook:resend:${svixId}`;
const WEBHOOK_DEDUP_TTL_SECONDS = 86_400; // 24 hours

export const POST: APIRoute = async ({ request }) => {
  // 1. Read raw body BEFORE any parsing
  const rawBody = await request.text();

  // 2. Verify webhook signature (Svix / Resend)
  const verified = verifyResendWebhook(rawBody, request.headers, env.RESEND_WEBHOOK_SECRET);
  if (!verified) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  // 3. Only process email.received events
  if (verified.type !== 'email.received') {
    return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'unhandled_event_type' }), {
      status: 202,
      headers: JSON_HEADERS,
    });
  }

  // 4. Extract svix-id for idempotency
  const svixId = request.headers.get('svix-id');

  // 5. Idempotency check — skip duplicate delivery
  if (svixId) {
    const existing = await env.WEBHOOKS.get(WEBHOOK_DEDUP_KEY(svixId));
    if (existing !== null) {
      console.log(`[resend-webhook] svix-id=${svixId} status=deduplicated`);
      return new Response(JSON.stringify({ ok: true, dedupe: true }), {
        status: 200,
        headers: JSON_HEADERS,
      });
    }
  }

  // 6. Extract typed envelope fields
  const { emailId, sender: rawSender, recipient: rawRecipient, subject } = extractEmailFields(verified);

  // 7. Normalize sender to lowercase
  const sender = rawSender.toLowerCase();

  // 8. Enforce sender allow list
  const allowListRules = parseSenderAllowList(env.RESEND_SENDER_ALLOWLIST ?? '');
  if (!isSenderAllowed(sender, allowListRules)) {
    console.log(`[resend-webhook] svix-id=${svixId ?? 'unknown'} sender=${sender} allowed=false`);
    return new Response(
      JSON.stringify({ ok: true, ignored: true, reason: 'sender_not_allowed' }),
      { status: 202, headers: JSON_HEADERS },
    );
  }

  // 9. Normalize recipient to lowercase
  const recipient = rawRecipient ? rawRecipient.toLowerCase() : null;

  // 10. Resolve target agent from recipient address
  const agent = recipient ? resolveAgentFromRecipient(recipient) : null;

  if (!agent) {
    console.log(
      `[resend-webhook] svix-id=${svixId ?? 'unknown'} sender=${sender} recipient=${recipient ?? 'unknown'} allowed=true route=none`,
    );
    return new Response(
      JSON.stringify({ ok: true, ignored: true, reason: 'unknown_recipient' }),
      { status: 202, headers: JSON_HEADERS },
    );
  }

  // 11. Fetch full email body from Resend API
  const emailContent = await fetchReceivedEmailContent(emailId, env.RESEND_API_KEY);
  if (!emailContent) {
    console.warn(
      `[resend-webhook] svix-id=${svixId ?? 'unknown'} email_id=${emailId} body_fetch=failed — dispatching without body`,
    );
  }

  // 12. Dispatch sanitized payload to the correct OpenClaw agent
  // recipient is guaranteed non-null here: resolveAgentFromRecipient only returns
  // a non-null agent when recipient is non-null, and we returned early if !agent.
  const sanitizedPayload = {
    svixId,
    sender,
    recipient: recipient!,
    subject,
    text: emailContent?.text ?? null,
    html: emailContent?.html ?? null,
    agent,
  };

  const dispatchResult = await dispatchToAgent(agent, sanitizedPayload, {
    OPENCLAW_TOKEN: env.OPENCLAW_TOKEN,
    OPENCLAW_MAIN_HOOK_URL: env.OPENCLAW_MAIN_HOOK_URL,
    OPENCLAW_WAYMARK_HOOK_URL: env.OPENCLAW_WAYMARK_HOOK_URL,
  });

  console.log(
    `[resend-webhook] svix-id=${svixId ?? 'unknown'} email_id=${emailId} sender=${sender} recipient=${recipient} route=${agent} dispatch=${dispatchResult.status}`,
  );

  // 13. Mark as processed in KV
  if (svixId) {
    await env.WEBHOOKS.put(WEBHOOK_DEDUP_KEY(svixId), '1', {
      expirationTtl: WEBHOOK_DEDUP_TTL_SECONDS,
    });
  }

  return new Response(JSON.stringify({ ok: true, agent, dispatch: dispatchResult.status }), {
    status: 200,
    headers: JSON_HEADERS,
  });
};

// Reject all non-POST methods
export const ALL: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...JSON_HEADERS, Allow: 'POST' },
  });
};
