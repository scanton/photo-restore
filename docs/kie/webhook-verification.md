# kie.ai Webhook Security Verification

Source: https://docs.kie.ai/common-api/webhook-verification.md

kie.ai uses **HMAC-SHA256** to sign every outbound webhook callback.

---

## Algorithm

```
signature = base64(HMAC-SHA256(taskId + "." + timestampSeconds, webhookHmacKey))
```

Where:
- `taskId` — from `req.body.data.task_id` (or `req.body.taskId`)
- `timestampSeconds` — from `X-Webhook-Timestamp` header
- `webhookHmacKey` — from kie.ai Settings → Webhook HMAC Key (stored in `KIE_WEBHOOK_HMAC_KEY` env var)

## Headers sent by kie.ai

| Header | Type | Description |
|--------|------|-------------|
| `X-Webhook-Timestamp` | integer (string) | Unix timestamp in seconds when callback was sent |
| `X-Webhook-Signature` | string | base64-encoded HMAC-SHA256 signature |

## Our implementation

`src/app/api/webhooks/kie/route.ts`:

```typescript
import { createHmac, timingSafeEqual } from "crypto";

const timestamp = req.headers.get("x-webhook-timestamp");
const receivedSignature = req.headers.get("x-webhook-signature");

const taskId = (data?.task_id ?? payload.taskId) as string;
const hmacKey = process.env.KIE_WEBHOOK_HMAC_KEY ?? "";

const computedSignature = createHmac("sha256", hmacKey)
  .update(`${taskId}.${timestamp}`)
  .digest("base64");

const authorized = timingSafeEqual(
  Buffer.from(computedSignature),
  Buffer.from(receivedSignature)
);
```

## Setup

1. Get your Webhook HMAC Key from https://kie.ai/settings
2. Add to Vercel env vars as `KIE_WEBHOOK_HMAC_KEY`
3. The callback URL does **not** need a `?secret=` param — the HMAC headers handle auth

> ⚠️ If you click "Reset Key" in kie.ai Settings, update `KIE_WEBHOOK_HMAC_KEY` in Vercel and redeploy immediately — all callbacks will fail until the key is rotated.
