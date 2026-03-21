/**
 * /billing — public server component.
 *
 * Previously had an auth gate that redirected unauthenticated users to
 * /api/auth/signin — this caused a Chrome Safe Browsing false-positive
 * because the redirect target is a Google OAuth endpoint.
 *
 * Now: always renders pricing. Unauthenticated users see a "Sign in" CTA
 * that calls signIn('google', { callbackUrl: '/billing' }) directly.
 * Authenticated users see the full billing UI with their current balance.
 */
import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const balance = userId ? await getBalance(userId) : null;

  return <BillingClient session={session ?? null} creditBalance={balance} />;
}
