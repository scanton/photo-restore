import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session and returns the URL.
 * The portal lets subscribers manage payment methods, view invoices,
 * upgrade/downgrade plans, and cancel.
 */
export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found. Purchase a pack first." },
      { status: 404 }
    );
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
