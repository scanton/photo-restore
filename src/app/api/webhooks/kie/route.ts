/**
 * POST /api/webhooks/kie
 *
 * kie.ai callback webhook — receives results from kie.ai after a restoration
 * task completes. Routes behavior based on the `phase` query parameter.
 *
 * URL format (constructed by buildKieCallbackUrl in lib/kie.ts):
 *   /api/webhooks/kie?restorationId=<uuid>&phase=initial|hires
 *
 * Authentication: kie.ai HMAC-SHA256 signature verification.
 *   Headers sent by kie.ai on every callback:
 *     X-Webhook-Timestamp  — Unix timestamp (seconds) when callback was sent
 *     X-Webhook-Signature  — base64(HMAC-SHA256(taskId + "." + timestamp, webhookHmacKey))
 *   KIE_WEBHOOK_HMAC_KEY   — the Webhook HMAC Key from kie.ai Settings page
 *
 * See: https://docs.kie.ai/common-api/webhook-verification.md
 *
 * phase=initial (1K preview):
 *   download output → burnWatermark → upload to Vercel Blob
 *   → estimateEra (best-effort, silent failure)
 *   → status = "pending_payment"
 *
 * phase=hires (2K/4K final):
 *   download output → upload to Vercel Blob (no watermark)
 *   → status = "complete"
 *   → sendRestorationReadyEmail (skips if userId is null)
 *
 * NOTE: The kie.ai callback payload shape was discovered via live testing.
 * If the output URL field changes, update the extractOutputUrl() helper below.
 *
 *   ┌──────────────────────────────────────────────────────────────────────────┐
 *   │  kie.ai → POST /api/webhooks/kie?restorationId=X&phase=Y               │
 *   │    ├─ missing/invalid HMAC signature → 401                               │
 *   │    ├─ restoration not found → 404                                        │
 *   │    ├─ phase=initial → watermark → era → pending_payment                 │
 *   │    ├─ phase=hires   → upload → complete → email                         │
 *   │    └─ unknown phase → 400                                                │
 *   └──────────────────────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { put } from "@vercel/blob";
import { db, restorations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { burnWatermark } from "@/lib/watermark";
import { estimateEra } from "@/lib/openrouter";
import { sendRestorationReadyEmail } from "@/lib/email/send";

// Allow longer execution for image download + Jimp watermarking + Vercel Blob upload
export const maxDuration = 60;

// ─── Payload extraction ───────────────────────────────────────────────────────

/**
 * Extracts the output image URL from the kie.ai callback payload.
 *
 * Per kie.ai docs (docs.kie.ai/market/common/get-task-detail.md), the canonical
 * callback shape is:
 *
 *   {
 *     taskId: string,
 *     code: number,
 *     data: {
 *       task_id: string,
 *       state: "success" | "fail",
 *       resultJson: '{"resultUrls":["https://cdn.kie.ai/output.png"]}',  // JSON STRING
 *       callbackType: "task_completed",
 *       failCode: string,
 *       failMsg: string,
 *     }
 *   }
 *
 * `resultJson` is a JSON-encoded string (not an object) — must be parsed.
 * We also probe legacy/fallback field paths in case the shape differs for
 * nano-banana-2 specifically or changes in a future kie.ai API update.
 *
 * See docs/kie/README.md for full integration reference.
 */
function extractOutputUrl(payload: Record<string, unknown>): string | null {
  // Log full payload on every call until confirmed correct in production.
  // Remove this log once the field path is verified via Vercel logs.
  console.log("[kie webhook] callback payload:", JSON.stringify(payload));

  // Primary path: data.resultJson → JSON string → resultUrls[0]
  const data = payload.data as Record<string, unknown> | undefined;
  if (typeof data?.resultJson === "string") {
    try {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: string[] };
      if (parsed.resultUrls?.[0]) return parsed.resultUrls[0];
    } catch {
      // malformed resultJson — fall through to legacy paths
    }
  }

  // Legacy / fallback paths (kept in case nano-banana-2 deviates from the common shape)
  const output = payload.output as Record<string, unknown> | undefined;
  if (output?.image_url) return output.image_url as string;
  if (output?.url) return output.url as string;
  if (output?.imageUrl) return output.imageUrl as string;
  if (payload.image_url) return payload.image_url as string;
  if (payload.output_url) return payload.output_url as string;
  if (payload.result_url) return payload.result_url as string;

  return null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const restorationId = searchParams.get("restorationId");
  const phase = searchParams.get("phase");

  // 1. Read HMAC signature headers sent by kie.ai on every callback
  const timestamp = req.headers.get("x-webhook-timestamp");
  const receivedSignature = req.headers.get("x-webhook-signature");

  if (!timestamp || !receivedSignature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body early — taskId from the payload is required to compute the HMAC signature.
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data = payload.data as Record<string, unknown> | undefined;
  // kie.ai sends taskId as data.taskId (camelCase) — also handle data.task_id and top-level payload.taskId as fallbacks
  const taskId = (data?.taskId ?? data?.task_id ?? payload.taskId) as string | undefined;
  if (!taskId) {
    return NextResponse.json({ error: "Missing task_id in payload" }, { status: 400 });
  }

  // 3. Reject stale timestamps to prevent replay attacks (industry standard: ±5 min window).
  //    A replayed payload can only affect the specific restorationId in the URL, but
  //    rejecting it early is cheap and correct.
  const tsSeconds = parseInt(timestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Compute expected signature and compare constant-time (prevents timing attacks).
  //    Algorithm (per kie.ai docs): base64(HMAC-SHA256(taskId + "." + timestamp, hmacKey))
  //    See: https://docs.kie.ai/common-api/webhook-verification.md
  const hmacKey = process.env.KIE_WEBHOOK_HMAC_KEY ?? "";
  const computedSignature = createHmac("sha256", hmacKey)
    .update(`${taskId}.${timestamp}`)
    .digest("base64");

  let authorized = false;
  if (hmacKey && computedSignature.length === receivedSignature.length) {
    try {
      authorized = timingSafeEqual(
        Buffer.from(computedSignature),
        Buffer.from(receivedSignature)
      );
    } catch {
      authorized = false;
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!restorationId || !phase) {
    return NextResponse.json(
      { error: "Missing restorationId or phase query params" },
      { status: 400 }
    );
  }

  if (phase !== "initial" && phase !== "hires") {
    return NextResponse.json(
      { error: `Unknown phase '${phase}'. Expected 'initial' or 'hires'.` },
      { status: 400 }
    );
  }

  // 5. Load restoration
  const [restoration] = await db
    .select({
      id: restorations.id,
      userId: restorations.userId,
      inputBlobUrl: restorations.inputBlobUrl,
      status: restorations.status,
      kieAiJobId: restorations.kieAiJobId,
    })
    .from(restorations)
    .where(eq(restorations.id, restorationId))
    .limit(1);

  if (!restoration) {
    return NextResponse.json({ error: "Restoration not found" }, { status: 404 });
  }

  // 5a-pre. Verify taskId matches the stored kieAiJobId (defense-in-depth).
  //   Guards against stale callbacks from an older task (e.g. a retry job replaced the
  //   kieAiJobId with a new task, but the old callback arrived late).
  //
  //   Bypass cases (allow through without checking):
  //   - kieAiJobId is null — job may not have stored the ID yet
  //   - kieAiJobId is a placeholder sentinel ("pending" / "hires-pending") — the job
  //     claimed the slot but hasn't written the real taskId yet (narrow race window).
  //     The HMAC + URL-embedded restorationId already bind this callback to the right restoration.
  const PENDING_SENTINELS = new Set(["pending", "hires-pending"]);
  if (restoration.kieAiJobId &&
      !PENDING_SENTINELS.has(restoration.kieAiJobId) &&
      taskId !== restoration.kieAiJobId) {
    console.warn(
      `[kie webhook] taskId mismatch: expected=${restoration.kieAiJobId} got=${taskId} restorationId=${restorationId} — skipping stale callback`
    );
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 5a. Handle kie.ai failure notifications BEFORE extracting the output URL.
  //     data.state = "fail" means generation failed on kie.ai's side (insufficient credits,
  //     model error, etc.). Failure payloads have no output URL — checking extractOutputUrl
  //     first would return 422 and leave the restoration permanently stuck at "analyzing".
  //     Return 200 so kie.ai does not retry.
  const kieState = (payload.data as Record<string, unknown> | undefined)?.state;
  if (kieState === "fail") {
    // Idempotency: if already complete (e.g. delayed duplicate fail callback arriving after
    // a successful hires phase), don't overwrite "complete" with "failed".
    if (restoration.status === "complete") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const failCode = (payload.data as Record<string, unknown> | undefined)?.failCode ?? "";
    const failMsg = (payload.data as Record<string, unknown> | undefined)?.failMsg ?? "";
    console.error(
      `[kie webhook] Task failed: restorationId=${restorationId} failCode=${failCode} failMsg=${failMsg}`
    );
    await db
      .update(restorations)
      .set({ status: "failed" })
      .where(eq(restorations.id, restorationId));
    return NextResponse.json({ ok: true, failed: true });
  }

  // 5b. Extract output image URL from payload (only for successful callbacks)
  const outputUrl = extractOutputUrl(payload);
  if (!outputUrl) {
    console.error(
      "[kie webhook] Could not find output URL in payload:",
      JSON.stringify(payload)
    );
    return NextResponse.json(
      { error: "Output URL not found in kie.ai callback payload" },
      { status: 422 }
    );
  }

  // 5c. Idempotency fast-path for phase=hires: if already complete, skip BEFORE downloading
  //     the image. Without this check here, a duplicate kie.ai callback would download the
  //     full image buffer unnecessarily before discovering it can skip.
  if (phase === "hires" && restoration.status === "complete") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 6. Download kie.ai output image
  let outputBuffer: Buffer;
  try {
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download output image: ${imageRes.status}`);
    }
    outputBuffer = Buffer.from(await imageRes.arrayBuffer());
  } catch (err) {
    console.error("[kie webhook] Image download failed:", err);
    return NextResponse.json(
      { error: "Failed to download output image from kie.ai" },
      { status: 500 }
    );
  }

  // ─── phase=initial: watermark + era estimation ───────────────────────────

  if (phase === "initial") {
    // Burn watermark into the 1K preview image
    let watermarkedBuffer: Buffer;
    try {
      watermarkedBuffer = await burnWatermark(outputBuffer);
    } catch (err) {
      console.error("[kie webhook] burnWatermark failed:", err);
      return NextResponse.json(
        { error: "Failed to apply watermark" },
        { status: 500 }
      );
    }

    // Upload both the clean output (for 1K paid download) and the watermarked preview
    // in parallel to minimize latency. The clean output is stored as outputBlobUrl so
    // that 1K purchases can download immediately after purchase completes.
    const [cleanBlob, watermarkedBlob] = await Promise.all([
      put(
        `outputs/${restorationId}-1k.png`,
        outputBuffer,  // clean, no watermark — used as outputBlobUrl for 1K purchases
        { access: "public", contentType: "image/png" }
      ),
      put(
        `watermarked/${restorationId}-preview.jpg`,
        watermarkedBuffer,
        { access: "public", contentType: "image/jpeg" }
      ),
    ]);

    // Era estimation — best-effort, never blocks the pipeline
    const eraResult = restoration.inputBlobUrl
      ? await estimateEra(restoration.inputBlobUrl)
      : null;

    // Update restoration: clean + watermarked URLs + era + status → pending_payment
    await db
      .update(restorations)
      .set({
        outputBlobUrl: cleanBlob.url,
        watermarkedBlobUrl: watermarkedBlob.url,
        eraEstimate: eraResult?.era ?? null,
        eraConfidence: eraResult?.confidence ?? null,
        status: "pending_payment",
      })
      .where(eq(restorations.id, restorationId));

    return NextResponse.json({ ok: true, phase: "initial" });
  }

  // ─── phase=hires: store output + mark complete + send email ─────────────

  if (phase === "hires") {
    // Upload hi-res output to Vercel Blob (no watermark — user has paid)
    const hiresBlob = await put(
      `outputs/${restorationId}-hires.png`,
      outputBuffer,
      { access: "public", contentType: "image/png" }
    );

    // Mark restoration complete
    await db
      .update(restorations)
      .set({
        outputBlobUrl: hiresBlob.url,
        status: "complete",
      })
      .where(eq(restorations.id, restorationId));

    // Send completion email (no-op for anonymous users)
    await sendRestorationReadyEmail({
      id: restoration.id,
      userId: restoration.userId ?? null,
    });

    return NextResponse.json({ ok: true, phase: "hires" });
  }

  // Should never reach here — phase validation above covers all cases
  return NextResponse.json({ error: "Unhandled phase" }, { status: 500 });
}
