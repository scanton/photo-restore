/**
 * POST /api/jobs/restore
 *
 * QStash webhook — submits a 1K restoration task to kie.ai for preview generation.
 *
 * Flow:
 *   QStash delivers { restorationId, presetId }
 *   → verify QStash signature
 *   → atomic idempotency claim (UPDATE WHERE kieAiJobId IS NULL)
 *   → submit to kie.ai createTask (async — kie.ai will callback to /api/webhooks/kie)
 *   → store kieAiJobId
 *   → return 200
 *
 * On kie.ai failure: resets kieAiJobId to NULL, re-throws → 500 → QStash retries.
 * After maxRetries failures: QStash POSTs failureCallback → /api/jobs/restore-failed.
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  QStash → POST /api/jobs/restore                                │
 *   │    ├─ invalid sig → 401                                          │
 *   │    ├─ kieAiJobId already set → 200 (idempotent skip)            │
 *   │    ├─ restoration not found → 404                                │
 *   │    ├─ kie.ai success → store taskId → 200                       │
 *   │    └─ kie.ai throws → reset kieAiJobId → 500 → QStash retries  │
 *   └─────────────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from "next/server";
import { db, restorations } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { verifyQStash } from "@/lib/qstash";
import { createKieTask, buildKieCallbackUrl } from "@/lib/kie";
import { PRESETS } from "@/lib/presets";

// Task submission is fast (<5s) — no need for extended maxDuration
export const maxDuration = 30;

interface JobPayload {
  restorationId: string;
  presetId: string;
}

/**
 * Builds the restoration prompt from a base preset prompt plus toggle flags.
 * Exported for unit testing.
 *
 * Truth table:
 *   removeFrame=false, colorize=false → base prompt only
 *   removeFrame=true,  colorize=false → base + remove-frame instruction
 *   removeFrame=false, colorize=true  → base + colorize instruction
 *   removeFrame=true,  colorize=true  → base + both instructions
 */
export function buildPrompt(
  basePrompt: string,
  removeFrame: boolean,
  colorize: boolean
): string {
  const parts: string[] = [basePrompt];
  if (removeFrame) {
    parts.push("Remove any physical frame, border, or vignette from the photograph before restoring.");
  }
  if (colorize) {
    parts.push("Add natural, period-accurate colorization to the photograph.");
  }
  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  // 1. Verify QStash HMAC signature
  const result = await verifyQStash(req);
  if (result instanceof NextResponse) return result;

  const { restorationId, presetId } = result.body as JobPayload;

  if (!restorationId || !presetId) {
    return NextResponse.json(
      { error: "Missing required fields: restorationId, presetId" },
      { status: 400 }
    );
  }

  // 2. Atomic idempotency claim
  //    UPDATE ... SET kieAiJobId = 'pending' WHERE id = ? AND kieAiJobId IS NULL
  //    If 0 rows updated: another delivery already claimed this job → skip safely.
  const [claimed] = await db
    .update(restorations)
    .set({ kieAiJobId: "pending" })
    .where(
      and(
        eq(restorations.id, restorationId),
        isNull(restorations.kieAiJobId)
      )
    )
    .returning({ id: restorations.id });

  if (!claimed) {
    // Already in-flight or completed — idempotent success
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 3. Load the restoration record — reads removeFrame/colorize from DB so QStash
  //    retries always use the stored user selections, not stale payload values.
  const [restoration] = await db
    .select({
      inputBlobUrl: restorations.inputBlobUrl,
      removeFrame: restorations.removeFrame,
      colorize: restorations.colorize,
      presetId: restorations.presetId,
    })
    .from(restorations)
    .where(eq(restorations.id, restorationId))
    .limit(1);

  if (!restoration?.inputBlobUrl) {
    // Restoration was deleted between claim and lookup (very unlikely)
    await db
      .update(restorations)
      .set({ kieAiJobId: null })
      .where(eq(restorations.id, restorationId));
    return NextResponse.json({ error: "Restoration not found" }, { status: 404 });
  }

  // 4. Build prompt from preset + user-selected options (removeFrame, colorize)
  const preset = PRESETS.find((p) => p.slug === (restoration.presetId ?? presetId));
  const basePrompt = preset?.prompt ?? "Restore this photograph to its original quality.";
  const prompt = buildPrompt(basePrompt, restoration.removeFrame, restoration.colorize);

  // 5. Submit task to kie.ai (async — result comes via /api/webhooks/kie?phase=initial)
  const callBackUrl = buildKieCallbackUrl(restorationId, "initial");

  let taskId: string;
  try {
    ({ taskId } = await createKieTask({
      prompt,
      imageUrl: restoration.inputBlobUrl,
      resolution: "1K", // Always 1K for the preview watermarked image
      callBackUrl,
    }));
  } catch (err) {
    // Reset kieAiJobId so QStash can retry this job cleanly
    await db
      .update(restorations)
      .set({ kieAiJobId: null })
      .where(eq(restorations.id, restorationId));
    console.error("[jobs/restore] kie.ai error:", err);
    throw err; // 500 → QStash retries
  }

  // 6. Store real task ID (replaces "pending" placeholder)
  await db
    .update(restorations)
    .set({ kieAiJobId: taskId })
    .where(eq(restorations.id, restorationId));

  return NextResponse.json({ ok: true, taskId });
}
