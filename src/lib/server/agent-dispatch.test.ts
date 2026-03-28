import { describe, it, expect, afterEach } from 'bun:test';
import { dispatchToAgent } from './agent-dispatch';
import type { EmailDispatchPayload } from './agent-dispatch';

const mockEnv = {
  OPENCLAW_TOKEN: 'test-token',
  OPENCLAW_HOOK_URL: 'https://hooks.openclaw.ai/hooks/agent',
};

const mockPayload: EmailDispatchPayload = {
  svixId: 'svix_123',
  sender: 'user@example.com',
  recipient: 'waymark@agent.itsaydrian.com',
  subject: 'Test Trip',
  emailId: 'email_abc123',
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('dispatchToAgent', () => {
  it('posts to OPENCLAW_HOOK_URL with correct message and name', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit = {};

    globalThis.fetch = ((url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as typeof fetch;

    const result = await dispatchToAgent(mockPayload, mockEnv);

    expect(capturedUrl).toBe('https://hooks.openclaw.ai/hooks/agent');

    const body = JSON.parse(capturedInit.body as string);
    expect(body.message).toBe(
      'Retrieve and process email email_abc123 via Resend. From: user@example.com. Subject: Test Trip.',
    );
    expect(body.name).toBe('Test Trip');

    const authHeader = (capturedInit.headers as Record<string, string>)['Authorization'];
    expect(authHeader).toBe('Bearer test-token');

    expect(result).toEqual({ ok: true, status: 200 });
  });

  it('returns ok: false when OpenClaw responds with an error status', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(new Response('', { status: 429 }))) as typeof fetch;

    const result = await dispatchToAgent(mockPayload, mockEnv);

    expect(result).toEqual({ ok: false, status: 429 });
  });
});
