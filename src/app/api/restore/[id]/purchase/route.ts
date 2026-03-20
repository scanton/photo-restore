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

  // 3. Load restoration
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

  // 7. Atomically debit credits and update status + resolution
  try {
    await debitCredits({
      userId,
      amount: creditCost,
      description: `Restore ${restoration.id} (${resolution})`,
      idempotencyKey: `purchase-${restoration.id}`,
      restorationId: restoration.id,
    });

    await db
      .update(restorations)
      .set({ status: "processing", creditsCharged: creditCost, resolution: resolution as "1k" | "2k" | "4k" })
      .where(eq(restorations.id, id));

    return NextResponse.json({ success: true, creditCost, resolution });
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
