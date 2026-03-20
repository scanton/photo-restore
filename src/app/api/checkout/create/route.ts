import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getProductByPriceId, isCreditPack, VALID_PRICE_IDS } from "@/lib/products";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  // 1. Auth gate
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const userEmail = (session?.user as { email?: string } | undefined)?.email;
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // 2. Parse and validate priceId
  let priceId: string;
  try {
    const body = (await req.json()) as { priceId?: unknown };
    if (!body.priceId || typeof body.priceId !== "string") {
      return NextResponse.json(
        { error: "priceId is required." },
        { status: 400 }
      );
    }
    priceId = body.priceId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // 3. Validate priceId against the server-side product registry
  //    NEVER trust client-supplied credit amounts — always derive from products.ts
  if (!VALID_PRICE_IDS.has(priceId)) {
    return NextResponse.json({ error: "Unknown priceId." }, { status: 400 });
  }

  const product = getProductByPriceId(priceId)!;
  const credits = isCreditPack(product)
    ? product.credits
    : product.creditsPerMonth;

  // 4. Resolve or create Stripe customer
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    // Create a new Stripe customer and persist the ID
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    });
    stripeCustomerId = customer.id;

    await db
      .update(users)
      .set({ stripeCustomerId })
      .where(eq(users.id, userId));
  }

  // 5. Create Stripe Checkout Session
  //    metadata.credits is sourced from products.ts (server-validated), not user input
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: isCreditPack(product) ? "payment" : "subscription",
    metadata: {
      userId,
      credits: String(credits),
    },
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing?checkout=cancelled`,
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}
