import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db, users, subscriptions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { awardCredits } from "@/lib/credits";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpsert(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      default:
        // Unhandled event type — return 200 to acknowledge
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[Stripe webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error." }, { status: 500 });
  }
}

async function getUserIdByStripeCustomerId(
  stripeCustomerId: string
): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return user?.id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  if (!stripeCustomerId) return;

  const userId = await getUserIdByStripeCustomerId(stripeCustomerId);
  if (!userId) return;

  // Determine how many credits to award based on metadata or line items
  const creditsStr = session.metadata?.credits;
  const credits = creditsStr ? parseInt(creditsStr, 10) : 5;

  if (isNaN(credits) || credits <= 0) return;

  const idempotencyKey = `checkout-${session.id}`;

  await awardCredits({
    userId,
    amount: credits,
    type: "purchase",
    description: `Purchased ${credits} credits (session ${session.id})`,
    idempotencyKey,
  });
}

async function handleSubscriptionUpsert(stripeSubscription: Stripe.Subscription) {
  const stripeCustomerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id ?? null;

  if (!stripeCustomerId) return;

  const userId = await getUserIdByStripeCustomerId(stripeCustomerId);
  if (!userId) return;

  const statusMap: Record<string, "active" | "past_due" | "canceled" | "trialing"> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
  };

  const mappedStatus = statusMap[stripeSubscription.status] ?? "active";

  const existingRows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id))
    .limit(1);

  const creditsPerMonth = parseInt(
    stripeSubscription.metadata?.credits_per_month ?? "10",
    10
  );

  // billing_cycle_anchor represents the anchor date; use it as period reference
  const periodStart = stripeSubscription.billing_cycle_anchor
    ? new Date(stripeSubscription.billing_cycle_anchor * 1000)
    : null;
  // trial_end or cancel_at can serve as period end approximation
  const periodEnd = stripeSubscription.trial_end
    ? new Date(stripeSubscription.trial_end * 1000)
    : stripeSubscription.cancel_at
      ? new Date(stripeSubscription.cancel_at * 1000)
      : null;

  if (existingRows.length > 0) {
    await db
      .update(subscriptions)
      .set({
        status: mappedStatus,
        creditsPerMonth,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));
  } else {
    await db.insert(subscriptions).values({
      userId,
      stripeSubscriptionId: stripeSubscription.id,
      status: mappedStatus,
      creditsPerMonth,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
  }
}

/**
 * Awards monthly subscription credits on every successful renewal.
 *
 * Idempotency key: `sub-{subscriptionId}-{periodStart}` prevents double-grant
 * on Stripe retries for the same billing period.
 *
 * Guards:
 * - invoice.subscription must be present (non-subscription invoices → skip)
 * - Unknown customer → skip silently (returns 200 to Stripe)
 * - creditsPerMonth sourced from our subscriptions table (not Stripe metadata)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  // Only handle subscription invoices (parent.subscription_details is populated)
  const subscriptionRef =
    invoice.parent?.subscription_details?.subscription ?? null;
  if (!subscriptionRef) return;

  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef.id;

  const stripeCustomerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;

  if (!stripeCustomerId) return;

  const userId = await getUserIdByStripeCustomerId(stripeCustomerId);
  if (!userId) return; // Unknown customer — silently skip

  // Look up credits from our subscriptions table (not Stripe metadata)
  const [subscription] = await db
    .select({ creditsPerMonth: subscriptions.creditsPerMonth })
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return; // No subscription record — skip silently

  const periodStart = invoice.period_start;
  const idempotencyKey = `sub-${subscriptionId}-${periodStart}`;

  await awardCredits({
    userId,
    amount: subscription.creditsPerMonth,
    type: "subscription_grant",
    description: `Subscription renewal: ${subscription.creditsPerMonth} credits`,
    idempotencyKey,
  });
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  await db
    .update(subscriptions)
    .set({ status: "canceled" })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));
}
