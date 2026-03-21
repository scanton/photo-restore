/**
 * /account — Profile page (server component).
 *
 * Defense-in-depth auth guard: the middleware redirects unauthenticated
 * requests to /?authPrompt=true, but we also check here in case someone
 * bypasses middleware (edge case: expired session, dev override, etc.).
 *
 * Shows:
 *   - User avatar, name, email
 *   - Credit balance
 *   - Restoration history with status-aware row rendering
 *   - Empty state if the user has no restorations yet
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBalance } from "@/lib/credits";
import { Nav } from "@/components/layout/Nav";
import { RestorationHistory } from "./RestorationHistory";
import { Suspense } from "react";
import Link from "next/link";

export default async function AccountPage() {
  // Defense-in-depth: middleware should catch this, but guard here too
  const session = await auth();
  if (!session?.user) {
    redirect("/?authPrompt=true");
  }

  const userId = (session.user as { id?: string }).id!;
  const balance = await getBalance(userId);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF7F2" }}>
      <Nav session={session} creditBalance={balance} />

      <main className="mx-auto max-w-[1140px] px-6 py-12">
        <div className="grid lg:grid-cols-[240px_1fr] gap-12">

          {/* Sidebar */}
          <aside>
            {/* Avatar */}
            <div className="flex flex-col items-center lg:items-start gap-3 mb-8">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-light"
                  style={{
                    backgroundColor: "#E8C5A8",
                    color: "#8A4520",
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                  }}
                >
                  {session.user.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="text-center lg:text-left">
                <p className="text-base font-medium" style={{ color: "#1C1410" }}>
                  {session.user.name}
                </p>
                <p className="text-sm" style={{ color: "#8A7A6E" }}>
                  {session.user.email}
                </p>
              </div>
            </div>

            {/* Credit balance */}
            <div
              className="rounded-[12px] p-4 mb-6"
              style={{ backgroundColor: "#F2EDE5", border: "1px solid #EDE5D8" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#A89380", letterSpacing: "0.08em" }}
              >
                Credits
              </p>
              <p
                className="text-3xl font-light mb-1"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  color: balance === 0 ? "#B83B3B" : "#1C1410",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {balance}
              </p>
              <p className="text-xs mb-3" style={{ color: "#8A7A6E" }}>
                {balance === 1 ? "credit remaining" : "credits remaining"}
              </p>
              <Link
                href="/billing"
                className="block w-full text-center py-2 rounded-[8px] text-sm font-semibold transition-colors duration-150"
                style={{ backgroundColor: "#B5622A", color: "#FAF7F2" }}
              >
                Get more credits
              </Link>
            </div>

            {/* Nav links */}
            <nav className="flex flex-col gap-1">
              <SidebarLink href="/account" active>My Restorations</SidebarLink>
              <SidebarLink href="/billing">Credits &amp; Billing</SidebarLink>
            </nav>
          </aside>

          {/* Main content */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1
                className="text-2xl font-light"
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  color: "#1C1410",
                }}
              >
                My Restorations
              </h1>
              <Link
                href="/"
                className="text-sm font-semibold px-4 py-2 rounded-[8px] transition-colors duration-150"
                style={{ backgroundColor: "#B5622A", color: "#FAF7F2" }}
              >
                + Restore a photo
              </Link>
            </div>

            <Suspense fallback={<HistorySkeleton />}>
              <RestorationHistory userId={userId} />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading restorations…">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="flex items-center gap-4 px-5 py-4 rounded-[12px] border animate-pulse"
          style={{ backgroundColor: "#F2EDE5", borderColor: "#D9CDB8" }}
        >
          <div
            className="shrink-0 w-[52px] h-[52px] rounded-[8px]"
            style={{ backgroundColor: "#E8E0D4" }}
          />
          <div className="flex-1 flex flex-col gap-2">
            <div
              className="h-3.5 rounded"
              style={{ backgroundColor: "#E8E0D4", width: "40%" }}
            />
            <div
              className="h-3 rounded"
              style={{ backgroundColor: "#EDE5D8", width: "25%" }}
            />
          </div>
          <div
            className="shrink-0 h-8 w-20 rounded-[8px]"
            style={{ backgroundColor: "#E8E0D4" }}
          />
        </div>
      ))}
    </div>
  );
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-[8px] text-sm font-medium transition-colors duration-150"
      style={{
        backgroundColor: active ? "#E8C5A8" : "transparent",
        color: active ? "#8A4520" : "#6B5D52",
      }}
    >
      {children}
    </Link>
  );
}
