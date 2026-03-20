/**
 * POST /api/jobs/restore-failed
 *
 * QStash failure callback — called after /api/jobs/restore or /api/jobs/restore-hires
 * has exhausted all retries (maxRetries: 3).
 *
 * Sets restoration status to "failed" so the restore page can display an
 * appropriate error message instead of spinning forever.
 *
 * Security: QStash signature is verified. Without this, anyone who discovers
 * the URL could force-fail any restoration.
 *
 * Idempotent: if the restoration is already "failed", returns 200 without
 * a second DB write.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  QStash → POST /api/jobs/restore-failed           │
 *   │    ├─ invalid sig → 401                            │
 *   │    ├─ not found → 404                              │
 *   │    ├─ already "failed" → 200 (idempotent)         │
 *   │    └─ set status = "failed" → 200                 │
 *   └──────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from "next/server";
import { db, restorations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { verifyQStash } from "@/lib/qstash";

interface FailurePayload {
  restorationId: string;
}

export async function POST(req: NextRequest) {
  // 1. Verify QStash HMAC signature (required — prevents unauthorized status manipulation)
  const result = await verifyQStash(req);
  if (result instanceof NextResponse) return result;

  const { restorationId } = result.body as FailurePayload;

  if (!restorationId) {
    return NextResponse.json({ error: "Missing restorationId" }, { status: 400 });
  }

  // 2. Load restoration
  const [restoration] = await db
    .select({ id: restorations.id, status: restorations.status })
    .from(restorations)
    .where(eq(restorations.id, restorationId))
    .limit(1);

  if (!restoration) {
    return NextResponse.json({ error: "Restoration not found" }, { status: 404 });
  }

  // 3. Idempotent — already in a terminal state.
  //    Guard all terminals (not just "failed") so a stale failure callback
  //    cannot clobber a restoration that already completed or was refunded.
  const TERMINAL_STATES = ["failed", "complete", "refunded"] as const;
  if ((TERMINAL_STATES as readonly string[]).includes(restoration.status)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 4. Mark as failed
  await db
    .update(restorations)
    .set({ status: "failed" })
    .where(eq(restorations.id, restorationId));

  console.log(`[restore-failed] restoration ${restorationId} marked as failed`);

  return NextResponse.json({ ok: true });
}
