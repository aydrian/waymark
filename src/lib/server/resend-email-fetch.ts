import type { GetReceivingEmailResponseSuccess } from 'resend';

/**
 * Fetches full received email content from the Resend API.
 *
 * The email.received webhook payload only contains envelope metadata —
 * body content (text, html) must be retrieved separately.
 *
 * Endpoint: GET https://api.resend.com/emails/receiving/{emailId}
 *
 * Returns null if the request fails or the response is not 2xx.
 * Callers should dispatch with text/html as null rather than aborting.
 */
export async function fetchReceivedEmailContent(
  emailId: string,
  apiKey: string,
): Promise<GetReceivingEmailResponseSuccess | null> {
  try {
    const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`[resend-email-fetch] Failed to fetch email_id=${emailId} status=${response.status}`);
      return null;
    }

    return (await response.json()) as GetReceivingEmailResponseSuccess;
  } catch (err) {
    console.warn(`[resend-email-fetch] Fetch error for email_id=${emailId}`, err);
    return null;
  }
}
