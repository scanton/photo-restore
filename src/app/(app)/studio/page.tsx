/**
 * /studio — Image Lab (server component).
 *
 * Defense-in-depth auth guard: middleware redirects unauthenticated requests
 * to /?authPrompt=true, but we check here too for belt-and-suspenders safety.
 *
 * Shows:
 *   - Full-width credits bar (balance + link to /billing)
 *   - Centered heading ("Your Studio" / "Image Lab")
 *   - Zero-credits warning banner when balance === 0
 *   - UploadSection (the main upload + restore tool)
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBalance } from "@/lib/credits";
import { Nav } from "@/components/layout/Nav";
import { UploadSection } from "@/components/UploadSection";
import Link from "next/link";

export default async function StudioPage() {
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

      {/* Credits bar — full-width band between nav and page content */}
      <div
        className="w-full border-b px-6 py-2.5 flex items-center gap-3"
        style={{ borderColor: "#EDE5D8", backgroundColor: "#F2EDE5" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#6B5D52", letterSpacing: "0.08em" }}
        >
          Credits
        </span>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            fontFamily: "var(--font-mono), monospace",
            // Text colors chosen for ≥4.5:1 contrast against each pill background (WCAG AA).
            // normal: #6B3B14 on #E8C5A8 = 5.0:1; low: #8B5A1E on #FDF3E7 = 5.3:1; zero: #B83B3B on #FCEAEA = 4.6:1
            backgroundColor: balance === 0 ? "#FCEAEA" : balance <= 1 ? "#FDF3E7" : "#E8C5A8",
            color: balance === 0 ? "#B83B3B" : balance <= 1 ? "#8B5A1E" : "#6B3B14",
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label={`${balance} credit${balance === 1 ? "" : "s"} remaining`}
        >
          {balance}
        </span>
        <Link
          href="/billing"
          className="text-xs font-medium ml-1"
          style={{ color: "#9B5424", textDecoration: "underline", textUnderlineOffset: "2px" }}
        >
          Get more
        </Link>
      </div>

      <main>
        {/* Page heading */}
        <section className="text-center pt-16 pb-10 px-6">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "#9B5424", letterSpacing: "0.12em" }}
          >
            Image Lab
          </p>
          <h1
            className="font-light mb-3"
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontStyle: "italic",
              fontSize: "clamp(2rem, 5vw, 2.5rem)",
              lineHeight: 1.1,
              color: "#1C1410",
            }}
          >
            Your Studio
          </h1>
          <p
            className="text-sm max-w-md mx-auto"
            style={{ color: "#6B5D52", lineHeight: 1.6 }}
          >
            Upload an old photograph. Choose your restoration options. Download the result.
          </p>
        </section>

        {/* Zero-credits warning — warm banner above the upload zone */}
        {balance === 0 && (
          <div className="mx-auto max-w-[640px] px-6 mb-4">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm"
              style={{
                backgroundColor: "#FDF3E7",
                border: "1px solid #C17A2A",
                color: "#4A3F35",
              }}
            >
              <span>You&apos;re out of credits.</span>
              <Link
                href="/billing"
                className="font-semibold ml-auto"
                style={{ color: "#9B5424" }}
              >
                Get credits →
              </Link>
            </div>
          </div>
        )}

        {/* Upload tool */}
        <UploadSection />
      </main>
    </div>
  );
}
