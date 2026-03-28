import type { AgentName } from './email-routing';

export interface SanitizedEmailPayload {
  svixId: string | null;
  sender: string;
  recipient: string;
  subject: string;
  text: string | null;
  html: string | null;
  agent: AgentName;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
}

interface DispatchEnv {
  OPENCLAW_TOKEN: string;
  OPENCLAW_MAIN_HOOK_URL: string;
  OPENCLAW_WAYMARK_HOOK_URL: string;
}

/**
 * Dispatches an email payload to the correct OpenClaw agent endpoint.
 *
 * Sends envelope metadata plus text/html body for content processing.
 * Attachment content is never forwarded.
 *
 * Auth: x-openclaw-token header with OPENCLAW_TOKEN.
 */
export async function dispatchToAgent(
  agent: AgentName,
  payload: SanitizedEmailPayload,
  dispatchEnv: DispatchEnv,
): Promise<DispatchResult> {
  const url =
    agent === 'main' ? dispatchEnv.OPENCLAW_MAIN_HOOK_URL : dispatchEnv.OPENCLAW_WAYMARK_HOOK_URL;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-openclaw-token': dispatchEnv.OPENCLAW_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  return { ok: response.ok, status: response.status };
}
