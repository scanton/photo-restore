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
 * NOTE: The kie.ai callback payload shape is still unknown — see /api/webhooks/kie
 * for instrumentation that logs the first real callback for discovery.
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

  return { taskId: json.data.taskId };
}

/**
 * Builds the callBackUrl for kie.ai to POST results to.
 * Embeds restorationId, phase, and a webhook secret for auth.
 *
 * phase=initial → called after the 1K preview restoration
 * phase=hires   → called after the 2K/4K hi-res restoration
 */
export function buildKieCallbackUrl(
  restorationId: string,
  phase: "initial" | "hires"
): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const secret = process.env.KIE_WEBHOOK_SECRET ?? "";
  return (
    `${base}/api/webhooks/kie` +
    `?restorationId=${encodeURIComponent(restorationId)}` +
    `&phase=${phase}` +
    `&secret=${encodeURIComponent(secret)}`
  );
}
