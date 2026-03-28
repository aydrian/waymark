export interface EmailDispatchPayload {
  svixId: string | null;
  sender: string;
  recipient: string;
  subject: string;
  emailId: string;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
}

interface DispatchEnv {
  OPENCLAW_TOKEN: string;
  OPENCLAW_HOOK_URL: string;
}

export async function dispatchToAgent(
  payload: EmailDispatchPayload,
  dispatchEnv: DispatchEnv,
): Promise<DispatchResult> {
  const message = `Retrieve and process email ${payload.emailId} via Resend. From: ${payload.sender}. Subject: ${payload.subject}.`;

  const response = await fetch(dispatchEnv.OPENCLAW_HOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dispatchEnv.OPENCLAW_TOKEN}`,
    },
    body: JSON.stringify({ message, name: payload.subject }),
  });

  return { ok: response.ok, status: response.status };
}
