import { NextRequest, NextResponse } from "next/server";
import { db, restorations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { debitCredits, InsufficientCreditsError } from "@/lib/credits";
import { PRESETS } from "@/lib/presets";

// Resolution → credit multiplier
// 1K = 1× (base), 2K = 2×, 4K = 3×
const RESOLUTION_MULTIPLIER: Record<string, number> = {
  "1k": 1,
  "2k": 2,
  "4k": 3,
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth gate
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  // 2. Load restoration
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

  // 3. IDOR: must own the restoration
  if (restoration.userId !== userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // 4. Must be in pending_payment status
  if (restoration.status !== "pending_payment") {
    return NextResponse.json(
      {
        error: `Cannot purchase restoration in status '${restoration.status}'.`,
      },
      { status: 400 }
    );
  }

  // 5. Compute cost: preset base cost × resolution multiplier
  const preset = PRESETS.find((p) => p.slug === restoration.presetId);
  const baseCost = preset?.creditsCost ?? 1;
  const multiplier = RESOLUTION_MULTIPLIER[restoration.resolution] ?? 1;
  const creditCost = baseCost * multiplier;

  // 6. Atomically debit credits and update status
  try {
    await debitCredits({
      userId,
      amount: creditCost,
      description: `Restore ${restoration.id} (${restoration.resolution})`,
      idempotencyKey: `purchase-${restoration.id}`,
      restorationId: restoration.id,
    });

    await db
      .update(restorations)
      .set({ status: "processing", creditsCharged: creditCost })
      .where(eq(restorations.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Insufficient credits.", code: "insufficient_credits" },
        { status: 402 }
      );
    }
    console.error("[purchase] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
