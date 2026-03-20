import { NextRequest, NextResponse } from "next/server";
import { db, restorations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { debitCredits, InsufficientCreditsError, awardCredits } from "@/lib/credits";
import { PRESETS } from "@/lib/presets";
import { qstash, buildFailureCallback } from "@/lib/qstash";
import { sendRestorationReadyEmail } from "@/lib/email/send";

// Resolution → credit multiplier
// 1K = 1× (base), 2K = 2×, 4K = 3×
const RESOLUTION_MULTIPLIER: Record<string, number> = {
  "1k": 1,
  "2k": 2,
  "4k": 3,
};

const VALID_RESOLUTIONS = new Set(["1k", "2k", "4k"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth gate
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  // 2. Parse optional resolution override from request body
  let chosenResolution: string | null = null;
  try {
    const body = (await req.json()) as { resolution?: unknown };
    if (
      body.resolution &&
      typeof body.resolution === "string" &&
      VALID_RESOLUTIONS.has(body.resolution)
    ) {
      chosenResolution = body.resolution;
    }
  } catch {
    // body is optional — ignore parse errors
  }

  // 3. Validate UUID format before hitting the DB (Postgres throws on invalid UUID type)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid restoration ID." }, { status: 400 });
  }

  // 4. Load restoration
  const [restoration] = await db
    .select()
    .from(restorations)
    .where(eq(restorations.id, id))
    .limit(1);

  if (!restoration) {
    return NextResponse.json(
      { error: "Restoration not found." },
      { status: 404 }
    );
  }

  // 4. IDOR: must own the restoration
  if (restoration.userId !== userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // 5. Must be in pending_payment status
  if (restoration.status !== "pending_payment") {
    return NextResponse.json(
      {
        error: `Cannot purchase restoration in status '${restoration.status}'.`,
      },
      { status: 400 }
    );
  }

  // 6. Compute cost: preset base cost × resolution multiplier
  //    Use client-supplied resolution if valid, fall back to DB value
  const resolution = chosenResolution ?? restoration.resolution;
  const preset = PRESETS.find((p) => p.slug === restoration.presetId);
  const baseCost = preset?.creditsCost ?? 1;
  const multiplier = RESOLUTION_MULTIPLIER[resolution] ?? 1;
  const creditCost = baseCost * multiplier;

  // 7. Atomically debit credits
  try {
    await debitCredits({
      userId,
      amount: creditCost,
      description: `Restore ${restoration.id} (${resolution})`,
      idempotencyKey: `purchase-${restoration.id}`,
      restorationId: restoration.id,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Insufficient credits.", code: "insufficient_credits" },
        { status: 402 }
      );
    }
    console.error("[purchase] debit error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }

  // 8. Branch on resolution:
  //    1K → mark complete immediately (preview IS the full 1K output, minus watermark)
  //    2K/4K → mark processing, queue hi-res job via QStash
  if (resolution === "1k") {
    // 1K purchase: watermarked preview becomes the download — mark complete now
    await db
      .update(restorations)
      .set({
        status: "complete",
        creditsCharged: creditCost,
        resolution: "1k",
        // For 1K, the output IS the watermarked preview re-used without watermark.
        // /api/jobs/restore stores the clean 1K result in outputBlobUrl via kie.ai callback.
        // If kie.ai hasn't delivered yet, the restore page will poll until complete.
      })
      .where(eq(restorations.id, id));

    // Send completion email (no-op for anonymous users)
    await sendRestorationReadyEmail({ id, userId });

    return NextResponse.json({ success: true, creditCost, resolution });
  }

  // 2K or 4K: set to processing and queue hi-res job
  await db
    .update(restorations)
    .set({
      status: "processing",
      creditsCharged: creditCost,
      resolution: resolution as "2k" | "4k",
    })
    .where(eq(restorations.id, id));

  // Publish restore-hires job — if this fails, roll back status + refund credits
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const failureCallback = buildFailureCallback(baseUrl);

  try {
    await qstash.publishJSON({
      url: `${baseUrl}/api/jobs/restore-hires`,
      body: { restorationId: id, resolution },
      retries: 3,
      ...(failureCallback ? { failureCallback } : {}),
    });
  } catch (publishErr) {
    console.error("[purchase] QStash publish failed, rolling back:", publishErr);

    // Roll back: restore to pending_payment so user can retry
    await db
      .update(restorations)
      .set({ status: "pending_payment", creditsCharged: 0 })
      .where(eq(restorations.id, id));

    // Refund credits
    await awardCredits({
      userId,
      amount: creditCost,
      type: "refund",
      description: `Refund: QStash publish failed for ${id}`,
      idempotencyKey: `qstash-fail-refund-${id}`,
    });

    return NextResponse.json(
      { error: "Failed to queue restoration job. Your credits have been refunded. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, creditCost, resolution });
}
