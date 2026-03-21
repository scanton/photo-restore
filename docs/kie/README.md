# kie.ai Integration Reference

PicRenew uses kie.ai as its primary image inference provider.
Full docs index: https://docs.kie.ai/llms.txt

---

## Model: `nano-banana-2`

Google's Nano Banana 2 — the model we use for photo restoration.

**API endpoint:** `POST https://api.kie.ai/api/v1/jobs/createTask`

### Request shape

```json
{
  "model": "nano-banana-2",
  "callBackUrl": "https://picrenew.com/api/webhooks/kie?restorationId=X&phase=Y",
  "input": {
    "prompt": "Restore this old photograph...",
    "image_input": ["https://blob.vercel.com/original.jpg"],
    "aspect_ratio": "auto",
    "resolution": "1K",
    "output_format": "png"
  }
}
```

**Resolution options:** `1K` | `2K` | `4K`
**Aspect ratio options:** `1:1`, `2:3`, `3:2`, `9:16`, `16:9`, `auto`, and others
**Output format:** `png` | `jpg`

### Task creation response

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "ee9c2715375b7837f8bb51d641ff5863",
    "recordId": "some-record-id"
  }
}
```

`200` means the task was **created**, not completed. Use the callback or poll for results.

---

## Async Result Delivery

kie.ai is fully async. Two ways to get results:

### Option A: Webhook callback (recommended for production)

kie.ai POSTs to your `callBackUrl` when the task completes.

**Callback body shape:**

```json
{
  "taskId": "ee9c2715375b7837f8bb51d641ff5863",
  "code": 200,
  "msg": "Success",
  "data": {
    "task_id": "ee9c2715375b7837f8bb51d641ff5863",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://cdn.kie.ai/output.png\"]}",
    "callbackType": "task_completed",
    "failCode": "",
    "failMsg": ""
  }
}
```

**Key field:** `data.resultJson` is a **JSON string** (not an object) that must be parsed:

```typescript
const result = JSON.parse(data.resultJson) as { resultUrls: string[] };
const outputUrl = result.resultUrls[0];
```

> ⚠️ `resultJson` is a string, not an object. `JSON.parse()` required.

See [`webhook-verification.md`](./webhook-verification.md) for HMAC auth.

### Option B: Poll for status

```
GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<taskId>
Authorization: Bearer <KIE_AI_API_KEY>
```

**Response:**

```json
{
  "code": 200,
  "data": {
    "taskId": "task_12345678",
    "model": "nano-banana-2",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://cdn.kie.ai/output.png\"]}",
    "failCode": "",
    "failMsg": "",
    "costTime": 15000,
    "completeTime": 1698765432000
  }
}
```

**Task states:** `waiting` → `queuing` → `generating` → `success` | `fail`

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200  | Success |
| 401  | Unauthorized — bad or missing API key |
| 402  | Insufficient credits |
| 404  | Not found |
| 422  | Validation error — bad request params |
| 429  | Rate limited (>20 req/10s) |
| 455  | Service unavailable (maintenance) |
| 500  | Server error |
| 501  | Generation failed |
| 505  | Feature disabled |

**4xx vs 5xx matters for retry logic:** 4xx = permanent failure (don't retry). 5xx = transient (retry). See TODOS.md — "kie.ai 4xx Error Discrimination".

---

## Rate Limits

- 20 new generation requests per 10 seconds
- 100+ concurrent running tasks
- Limits per account

---

## Data Retention

- **Generated image files:** 14 days, then deleted
- **Log records:** 2 months

→ PicRenew downloads and stores all output images to Vercel Blob immediately on callback to avoid expiry.

---

## Our Integration

| File | Purpose |
|------|---------|
| `src/lib/kie.ts` | `createKieTask()` + `buildKieCallbackUrl()` |
| `src/app/api/jobs/restore/route.ts` | QStash worker → submits 1K task |
| `src/app/api/jobs/restore-hires/route.ts` | QStash worker → submits 2K/4K task |
| `src/app/api/webhooks/kie/route.ts` | Receives callbacks, downloads + stores output |

Env vars required:
- `KIE_AI_API_KEY` — API key from https://kie.ai/api-key
- `KIE_AI_BASE_URL` — defaults to `https://api.kie.ai`
- `KIE_WEBHOOK_HMAC_KEY` — from kie.ai Settings → Webhook HMAC Key

---

## Source Docs

- [Getting Started](https://docs.kie.ai/1973359m0.md)
- [nano-banana-2 API spec](https://docs.kie.ai/market/google/nanobanana2.md)
- [Get Task Details (polling)](https://docs.kie.ai/market/common/get-task-detail.md)
- [Webhook Security Verification](https://docs.kie.ai/common-api/webhook-verification.md)
- [Full docs index](https://docs.kie.ai/llms.txt)
