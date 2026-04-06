# OpenClaw /hooks/agent Dispatch Design

**Date:** 2026-03-28

## Context

The current webhook handler fetches the full email body from Resend before dispatching to OpenClaw, and supports routing between two agents (`main` and `waymark`) via separate hook URLs. This is more complex than needed.

The system only needs to handle emails to `waymark@agent.itsaydrian.com` and forward them to a single OpenClaw agent. The OpenClaw agent has the Resend skill and can retrieve the email body itself — we only need to give it the `emailId` and key metadata as a prompt.

## Goals

- Simplify dispatch to a single OpenClaw endpoint (`POST /hooks/agent`)
- Remove email body fetching from the webhook handler
- Remove multi-agent routing logic
- Keep sender allowlist, idempotency, and signature verification unchanged

## Architecture

Straight pipeline in `src/pages/webhooks/resend.ts`:

```
Resend webhook → verify signature → check KV idempotency → check sender allowlist
  → check recipient is waymark@* → dispatch to OPENCLAW_HOOK_URL → mark KV processed
```

Any email not addressed to `waymark@*` returns `202` (silently dropped).

## Files Changed

| File | Change |
|------|--------|
| `src/pages/webhooks/resend.ts` | Remove `fetchReceivedEmailContent` call; remove agent routing; pass `emailId` to dispatch |
| `src/lib/server/agent-dispatch.ts` | New payload shape; build `/hooks/agent` request with `message` + `name`; single URL |
| `src/lib/server/email-routing.ts` | **Delete** |
| `src/lib/server/resend-email-fetch.ts` | **Delete** |
| `wrangler.jsonc` | Replace `OPENCLAW_MAIN_HOOK_URL` + `OPENCLAW_WAYMARK_HOOK_URL` with `OPENCLAW_HOOK_URL` |
| `worker-configuration.d.ts` | Update env type to match |

## Payload

`SanitizedEmailPayload` (updated):

```typescript
interface SanitizedEmailPayload {
  svixId: string | null;
  sender: string;
  recipient: string;
  subject: string;
  emailId: string;
}
```

Body sent to OpenClaw `/hooks/agent`:

```json
{
  "message": "Retrieve and process email {emailId} via Resend. From: {sender}. Subject: {subject}.",
  "name": "{subject}"
}
```

Auth: `Authorization: Bearer {OPENCLAW_TOKEN}` (unchanged).

## Environment Variables

| Variable | Change |
|----------|--------|
| `OPENCLAW_TOKEN` | Unchanged |
| `OPENCLAW_HOOK_URL` | New — replaces the two agent-specific URLs |
| `OPENCLAW_MAIN_HOOK_URL` | **Remove** |
| `OPENCLAW_WAYMARK_HOOK_URL` | **Remove** |

## Error Handling

- Non-2xx from OpenClaw: log status, return `200` to Resend (avoid retries) — unchanged behavior
- Unknown recipient: `202` (silently dropped) — unchanged behavior
- Sender not allowed: `202` (silently dropped) — unchanged behavior

## Verification

1. Run `bun run dev` and POST a test payload to `/webhooks/resend` with a valid Svix signature
2. Confirm `waymark@*` recipient triggers a POST to `OPENCLAW_HOOK_URL` with the correct `message` and `name` fields
3. Confirm non-`waymark@*` recipient returns `202` without dispatching
4. Confirm `bun test` passes (no existing webhook tests, but type-check via `bun run build` should pass)
