/**
 * lib/kie.ts
 *
 * kie.ai nano-banana-2 API client.
 *
 * Task creation is async: POST /api/v1/jobs/createTask returns a taskId;
 * kie.ai will POST the result to our callBackUrl when processing is complete.
 *
 * Confirmed response shape (tested 2026-03-20):
 *   { code: 200, msg: "success", data: { taskId: string, recordId: string } }
 *
 * Callback payload shape confirmed — see docs/kie/README.md for full reference.
 * Key: data.resultJson is a JSON-encoded string containing { resultUrls: [url] }.
 */

const KIE_BASE_URL = process.env.KIE_AI_BASE_URL ?? "https://api.kie.ai";

export interface CreateKieTaskParams {
  /** Restoration prompt describing what kie.ai should do */
  prompt: string;
  /** Public URL of the original image to restore */
  imageUrl: string;
  /** Output resolution — "1K" for preview, "2K"/"4K" for high-res */
  resolution: "1K" | "2K" | "4K";
  /** URL that kie.ai will POST the result to */
  callBackUrl: string;
}

export interface CreateKieTaskResult {
  taskId: string;
}

/**
 * Submits a restoration task to kie.ai.
 *
 * Throws on any non-2xx response so the calling job route returns 500
 * and QStash triggers a retry.
 *
 *   POST https://api.kie.ai/api/v1/jobs/createTask
 *   → { code: 200, data: { taskId, recordId } }
 */
export async function createKieTask(
  params: CreateKieTaskParams
): Promise<CreateKieTaskResult> {
  const { prompt, imageUrl, resolution, callBackUrl } = params;

  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KIE_AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana-2",
      callBackUrl,
      input: {
        prompt,
        image_input: [imageUrl],
        aspect_ratio: "auto",
        resolution,
        output_format: "png",
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`kie.ai ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    data: { taskId: string; recordId: string };
  };

  // kie.ai uses an inner `code` field even on HTTP 200 responses — validate it.
  // HTTP 200 with code: 402 means insufficient credits; code: 429 means rate-limited, etc.
  // Throw so the QStash job returns 500 and triggers a retry (for transient errors).
  if (json.code !== 200) {
    throw new Error(
      `kie.ai task creation failed: code=${json.code} msg=${json.msg}`
    );
  }

  return { taskId: json.data.taskId };
}

/**
 * Builds the callBackUrl for kie.ai to POST results to.
 * Embeds restorationId and phase for routing.
 *
 * Authentication is handled by kie.ai's HMAC-SHA256 signature, sent in
 * X-Webhook-Timestamp and X-Webhook-Signature request headers — not via
 * a query param secret. See /api/webhooks/kie for verification logic.
 *
 * phase=initial → called after the 1K preview restoration
 * phase=hires   → called after the 2K/4K hi-res restoration
 */
export function buildKieCallbackUrl(
  restorationId: string,
  phase: "initial" | "hires"
): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return (
    `${base}/api/webhooks/kie` +
    `?restorationId=${encodeURIComponent(restorationId)}` +
    `&phase=${phase}`
  );
}
