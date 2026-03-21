/**
 * POST /api/restore/[id]/start
 *
 * Confirms the user's restoration options (removeFrame, colorize) and
 * submits the job to QStash. This is the second step after upload —
 * the user selects options on the options screen, then clicks "Restore."
 *
 * Flow:
 *   SELECT to verify restoration exists
 *   → atomic UPDATE WHERE status = 'ready' (idempotency claim)
 *     ├─ 0 rows updated → already started or not found → 200 skipped / 404
 *     └─ claimed → QStash publish
 *                    ├─ success → 200 ok
 *                    └─ failure → reset status → 'ready' → 500 (client can retry)
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  POST /api/restore/[id]/start                                 │
 *   │    ├─ not found               → 404                           │
 *   │    ├─ already past 'ready'    → 200 { ok: true, skipped }    │
 *   │    ├─ QStash publish success  → 200 { ok: true }             │
 *   │    └─ QStash publish failure  → reset → 500                   │
 *   └──────────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from "next/server";
import { db, restorations } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { qstash, buildFailureCallback } from "@/lib/qstash";

export const maxDuration = 30;

interface StartBody {
  removeFrame?: boolean;
  colorize?: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restorationId } = await params;

    // Validate UUID format
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(restorationId)) {
      return NextResponse.json({ error: "Invalid restoration ID." }, { status: 400 });
    }

    let body: StartBody = {};
    try {
      body = (await req.json()) as StartBody;
    } catch {
      // empty body is fine — defaults to no options
    }

    const removeFrame = body.removeFrame === true;
    const colorize = body.colorize === true;

    // 1. Verify restoration exists (separate from atomic claim so 404 is distinguishable from skipped)
    const [existing] = await db
      .select({ id: restorations.id, presetId: restorations.presetId })
      .from(restorations)
      .where(eq(restorations.id, restorationId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Restoration not found." }, { status: 404 });
    }

    // 2. Atomic idempotency claim:
    //    UPDATE ... SET status='analyzing', removeFrame, colorize
    //    WHERE id = ? AND status = 'ready'
    //    If 0 rows: already past 'ready' (analyzing/complete/etc.) → skip safely
    const [claimed] = await db
      .update(restorations)
      .set({ status: "analyzing", removeFrame, colorize })
      .where(
        and(
          eq(restorations.id, restorationId),
          eq(restorations.status, "ready")
        )
      )
      .returning({ id: restorations.id });

    if (!claimed) {
      // Already in-flight or completed — idempotent success
      return NextResponse.json({ ok: true, skipped: true });
    }

    // 3. Publish job to QStash
    //    options (removeFrame, colorize) are read from DB in the job route
    //    so QStash retries always use the stored values
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const jobUrl = `${baseUrl}/api/jobs/restore`;
    const failureCallback = buildFailureCallback(baseUrl);

    try {
      await qstash.publishJSON({
        url: jobUrl,
        body: { restorationId, presetId: existing.presetId },
        retries: 3,
        ...(failureCallback ? { failureCallback } : {}),
      });
    } catch (publishErr) {
      // Reset status back to 'ready' so the user can retry by clicking "Restore" again
      console.error("[restore/start] QStash publish failed, resetting to ready:", publishErr);
      await db
        .update(restorations)
        .set({ status: "ready" })
        .where(eq(restorations.id, restorationId));
      return NextResponse.json(
        { error: "Failed to start restoration. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/restore/[id]/start]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
