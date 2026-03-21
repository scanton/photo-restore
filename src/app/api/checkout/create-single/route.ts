/**
 * POST /api/checkout/create-single
 *
 * Creates a Stripe Checkout session for the $0.99 Single Download product.
 * No authentication required — this is a guest checkout flow.
 *
 * The restoration must be at status="pending_payment" and have a non-null
 * outputBlobUrl before a checkout session is created.
 *
 * On checkout.session.completed (Stripe webhook):
 *   - guestPurchased = true
 *   - status = "complete"
 *   The restore page then shows a direct download button for outputBlobUrl (clean 1K).
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  POST /api/checkout/create-single                                │
 *   │    ├─ missing/invalid restorationId   → 400                      │
 *   │    ├─ restoration not found           → 404                      │
 *   │    ├─ guestPurchased already true     → 409 (already purchased)  │
 *   │    ├─ status !== pending_payment      → 409 (preview not ready)  │
 *   │    ├─ outputBlobUrl is null           → 409 (file not ready)     │
 *   │    └─ valid                           → { checkoutUrl }          │
 *   └─────────────────────────────────────────────────────────────────┘
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db, restorations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { SINGLE_DOWNLOAD } from "@/lib/products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    // 1. Parse and validate restorationId
    let restorationId: string;
    try {
      const body = (await req.json()) as { restorationId?: unknown };
      if (!body.restorationId || typeof body.restorationId !== "string") {
        return NextResponse.json({ error: "restorationId is required." }, { status: 400 });
      }
      restorationId = body.restorationId;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!UUID_RE.test(restorationId)) {
      return NextResponse.json({ error: "Invalid restoration ID." }, { status: 400 });
    }

    // 2. Load restoration
    const [restoration] = await db
      .select({
        id: restorations.id,
        status: restorations.status,
        outputBlobUrl: restorations.outputBlobUrl,
        guestPurchased: restorations.guestPurchased,
      })
      .from(restorations)
      .where(eq(restorations.id, restorationId))
      .limit(1);

    if (!restoration) {
      return NextResponse.json({ error: "Restoration not found." }, { status: 404 });
    }

    // 3. Pre-condition checks (all → 409 Conflict, not 500)
    if (restoration.guestPurchased) {
      return NextResponse.json(
        { error: "Already purchased. Use the download button on the restore page." },
        { status: 409 }
      );
    }

    if (restoration.status !== "pending_payment") {
      return NextResponse.json(
        {
          error:
            "Your photo is still being processed — please wait for the preview before purchasing.",
        },
        { status: 409 }
      );
    }

    if (!restoration.outputBlobUrl) {
      // Should not happen in normal flow — outputBlobUrl is set before status → pending_payment
      console.error(
        `[create-single] outputBlobUrl is null for ${restorationId} at pending_payment`
      );
      return NextResponse.json(
        { error: "Preview not ready for download. Please wait a moment and try again." },
        { status: 409 }
      );
    }

    // 4. Create Stripe guest Checkout Session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: SINGLE_DOWNLOAD.priceId, quantity: 1 }],
      customer_creation: "always",
      metadata: {
        restorationId,
        type: "single_download",
      },
      success_url: `${baseUrl}/restore/${restorationId}?download=success`,
      cancel_url: `${baseUrl}/restore/${restorationId}`,
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (err) {
    console.error("[POST /api/checkout/create-single]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
