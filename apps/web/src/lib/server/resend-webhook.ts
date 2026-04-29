import { Webhook } from 'svix';
import type { EmailReceivedEvent, WebhookEventPayload } from 'resend';

/**
 * Verifies an inbound Resend webhook signature using the Svix library.
 *
 * Resend delivers webhooks via Svix. The signing secret is in `whsec_<base64>` format.
 * Svix handles replay protection (5-minute tolerance) internally.
 *
 * Returns the parsed, verified payload on success, or null on failure.
 *
 * IMPORTANT: rawBody must be the unmodified request body text read BEFORE any JSON.parse().
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): WebhookEventPayload | null {
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return null;
  }

  try {
    const wh = new Webhook(secret);
    return wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEventPayload;
  } catch {
    return null;
  }
}

/**
 * Extracts envelope fields from a verified email.received event.
 *
 * Uses the typed SDK shape directly — no defensive fallbacks needed.
 *
 * Note: body content (text/html) is NOT included in the webhook payload.
 * The receiving agent retrieves it via its own Resend skill using emailId.
 */
export function extractEmailFields(event: EmailReceivedEvent): {
  emailId: string;
  sender: string;
  recipient: string | null;
  subject: string;
} {
  const { email_id, from, to, subject } = event.data;
  return {
    emailId: email_id,
    sender: from,
    recipient: to[0] ?? null,
    subject,
  };
}
