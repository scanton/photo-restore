/**
 * POST /api/webhooks/kie
 *
 * kie.ai callback webhook — receives results from kie.ai after a restoration
 * task completes. Routes behavior based on the `phase` query parameter.
 *
 * URL format (constructed by buildKieCallbackUrl in lib/kie.ts):
 *   /api/webhooks/kie?restorationId=<uuid>&phase=initial|hires&secret=<token>
 *
 * Authentication: KIE_WEBHOOK_SECRET in query param (not QStash — this is
 * kie.ai calling us, not Upstash).
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
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │  kie.ai → POST /api/webhooks/kie?restorationId=X&phase=Y&secret=Z  │
 *   │    ├─ missing/invalid secret → 401                                  │
 *   │    ├─ restoration not found → 404                                   │
 *   │    ├─ phase=initial → watermark → era → pending_payment            │
 *   │    ├─ phase=hires   → upload → complete → email                    │
 *   │    └─ unknown phase → 400                                           │
 *   └─────────────────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
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
 * NOTE: kie.ai callback payload shape was verified via live test call (2026-03-20).
 * We attempt several common field names defensively in case the API changes.
 *
 * Expected shape (to be confirmed via Vercel logs on first real callback):
 *   { taskId: string, status: "success"|"failed", output: { image_url: string } }
 *
 * console.log below will print the full payload to Vercel logs on first run —
 * use this to verify the field names are correct and remove the log afterward.
 */
function extractOutputUrl(payload: Record<string, unknown>): string | null {
  // Log full payload on first real call so we can verify the shape
  console.log("[kie webhook] callback payload:", JSON.stringify(payload));

  // Try the most likely field paths
  const output = payload.output as Record<string, unknown> | undefined;
  if (output?.image_url) return output.image_url as string;
  if (output?.url) return output.url as string;
  if (output?.imageUrl) return output.imageUrl as string;

  // Flat fields
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
  const secret = searchParams.get("secret");

  // 1. Authenticate via shared secret (constant-time comparison to prevent timing attacks)
  const expectedSecret = process.env.KIE_WEBHOOK_SECRET ?? "";
  let authorized = false;
  if (secret && secret.length === expectedSecret.length && expectedSecret.length > 0) {
    try {
      authorized = timingSafeEqual(
        Buffer.from(secret),
        Buffer.from(expectedSecret)
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

  // 2. Parse kie.ai callback payload
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 3. Extract output image URL from payload
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

  // 4. Load restoration
  const [restoration] = await db
    .select({
      id: restorations.id,
      userId: restorations.userId,
      inputBlobUrl: restorations.inputBlobUrl,
      status: restorations.status,
    })
    .from(restorations)
    .where(eq(restorations.id, restorationId))
    .limit(1);

  if (!restoration) {
    return NextResponse.json({ error: "Restoration not found" }, { status: 404 });
  }

  // 4a. Idempotency fast-path for phase=hires: if already complete, skip BEFORE downloading
  //     the image. Without this check here, a duplicate kie.ai callback would download the
  //     full image buffer unnecessarily before discovering it can skip.
  if (phase === "hires" && restoration.status === "complete") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 5. Download kie.ai output image
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
