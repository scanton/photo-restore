/**
 * POST /api/jobs/restore-hires
 *
 * QStash webhook — submits a 2K/4K hi-res restoration task to kie.ai.
 * Triggered by the purchase route when the user selects 2k or 4k resolution.
 *
 * Flow:
 *   QStash delivers { restorationId, resolution }
 *   → verify QStash signature
 *   → look up restoration (input image URL + preset)
 *   → submit to kie.ai createTask at 2K/4K (callback phase=hires)
 *   → store new kieAiJobId
 *   → return 200
 *
 * On kie.ai failure: resets kieAiJobId to NULL, re-throws → 500 → QStash retries.
 * After maxRetries: failureCallback → /api/jobs/restore-failed → status = "failed".
 */

import { NextRequest, NextResponse } from "next/server";
import { db, restorations } from "@/lib/db";
import { eq, and, not, isNull, or } from "drizzle-orm";
import { verifyQStash } from "@/lib/qstash";
import { createKieTask, buildKieCallbackUrl } from "@/lib/kie";
import { PRESETS } from "@/lib/presets";

export const maxDuration = 30;

interface HiresPayload {
  restorationId: string;
  resolution: "2k" | "4k";
}

export async function POST(req: NextRequest) {
  // 1. Verify QStash HMAC signature
  const result = await verifyQStash(req);
  if (result instanceof NextResponse) return result;

  const { restorationId, resolution } = result.body as HiresPayload;

  if (!restorationId || !resolution) {
    return NextResponse.json(
      { error: "Missing required fields: restorationId, resolution" },
      { status: 400 }
    );
  }

  // 2. Atomic idempotency claim — prevents duplicate kie.ai submissions if QStash
  //    delivers the same message more than once (at-least-once delivery guarantee).
  //
  //    SET kieAiJobId = 'hires-pending'
  //    WHERE status = 'processing'
  //      AND (kieAiJobId IS NULL OR kieAiJobId != 'hires-pending')
  //
  //    The status = 'processing' arm prevents a second delivery from re-submitting
  //    after the job already completed (status = 'complete'). Combined with the
  //    IS NULL arm: if kie.ai threw on a prior delivery, the catch block resets
  //    kieAiJobId to NULL (status stays 'processing'), and the next retry can claim.
  //    In SQL, NULL != 'hires-pending' evaluates to NULL (falsy) — so we need the
  //    explicit IS NULL arm to allow that retry to claim.
  const [claimed] = await db
    .update(restorations)
    .set({ kieAiJobId: "hires-pending" })
    .where(
      and(
        eq(restorations.id, restorationId),
        eq(restorations.status, "processing"),
        or(
          isNull(restorations.kieAiJobId),
          not(eq(restorations.kieAiJobId, "hires-pending"))
        )
      )
    )
    .returning({ id: restorations.id });

  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 3. Load restoration
  const [restoration] = await db
    .select({
      inputBlobUrl: restorations.inputBlobUrl,
      presetId: restorations.presetId,
    })
    .from(restorations)
    .where(eq(restorations.id, restorationId))
    .limit(1);

  if (!restoration?.inputBlobUrl) {
    return NextResponse.json({ error: "Restoration not found" }, { status: 404 });
  }

  // 4. Resolve prompt
  const preset = PRESETS.find((p) => p.slug === restoration.presetId);
  const prompt = preset?.prompt ?? "Restore this photograph to its original quality.";

  // 5. Submit hi-res task to kie.ai
  const kieResolution = resolution === "4k" ? "4K" : "2K";
  const callBackUrl = buildKieCallbackUrl(restorationId, "hires");

  let taskId: string;
  try {
    ({ taskId } = await createKieTask({
      prompt,
      imageUrl: restoration.inputBlobUrl,
      resolution: kieResolution,
      callBackUrl,
    }));
  } catch (err) {
    // Reset kieAiJobId to NULL so QStash can retry this job cleanly.
    // Without the reset, kieAiJobId stays "hires-pending" and the idempotency
    // guard in step 2 would return { ok: true, skipped: true } on the next retry,
    // causing QStash to think the job succeeded and stop retrying.
    await db
      .update(restorations)
      .set({ kieAiJobId: null })
      .where(eq(restorations.id, restorationId));
    console.error("[jobs/restore-hires] kie.ai error:", err);
    throw err; // 500 → QStash retries
  }

  // 6. Store hires task ID (replaces 'hires-pending' placeholder)
  await db
    .update(restorations)
    .set({ kieAiJobId: taskId })
    .where(eq(restorations.id, restorationId));

  return NextResponse.json({ ok: true, taskId });
}
