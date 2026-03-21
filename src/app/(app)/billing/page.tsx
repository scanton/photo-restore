/**
 * /billing — server component gate.
 *
 * Unauthenticated users are redirected to /api/auth/signin before the client
 * component is ever sent to the browser. This is simpler and more secure than
 * relying on client-side auth checks (which can flash content before redirect).
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/billing");
  }
  return <BillingClient />;
}
