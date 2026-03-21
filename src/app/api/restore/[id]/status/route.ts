import { NextRequest, NextResponse } from "next/server";
import { db, restorations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Reject non-UUID IDs immediately — Postgres will throw a type error otherwise
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid restoration ID." }, { status: 400 });
    }

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

    // IDOR protection: only return if userId matches session OR userId is null (anonymous)
    if (restoration.userId !== null) {
      const session = await auth();
      const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
      if (!sessionUserId || sessionUserId !== restoration.userId) {
        return NextResponse.json(
          { error: "Not authorized." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      id: restoration.id,
      status: restoration.status,
      inputBlobUrl: restoration.inputBlobUrl,
      watermarkedBlobUrl: restoration.watermarkedBlobUrl,
      outputBlobUrl: restoration.outputBlobUrl,
      eraEstimate: restoration.eraEstimate,
      eraConfidence: restoration.eraConfidence,
      creditsCharged: restoration.creditsCharged,
      guestPurchased: restoration.guestPurchased,
      resolution: restoration.resolution,
      presetId: restoration.presetId,
    });
  } catch (err) {
    console.error("[GET /api/restore/[id]/status]", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
