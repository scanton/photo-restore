/**
 * Home page — server component.
 *
 * Auth-conditional rendering:
 *   - Authenticated  → show UploadSection (upload tool)
 *   - Unauthenticated → show hero CTA + film strip demo
 *
 * The ?authPrompt=true query param is set by middleware when an unauthenticated
 * user tries to access a protected route. When present, AuthPromptModal is shown.
 */
import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { Nav } from "@/components/layout/Nav";
import { UploadSection } from "@/components/UploadSection";
import { AuthPromptModal } from "@/components/AuthPromptModal";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { Button } from "@/components/ui/button";

// Demo film strip pairs — images are in /public/demo/
const DEMO_PAIRS = [
  {
    before: "/demo/pair-1-before.jpg",
    after: "/demo/pair-1-after.jpg",
    beforeAlt: "Damaged grandmother portrait, circa 1950s",
    afterAlt: "Restored grandmother portrait",
    era: "c. 1952",
  },
  {
    before: "/demo/pair-2-before.jpg",
    after: "/demo/pair-2-after.jpg",
    beforeAlt: "Faded wedding photograph, circa 1940s",
    afterAlt: "Restored wedding photograph",
    era: "c. 1943",
  },
  {
    before: "/demo/pair-3-before.jpg",
    after: "/demo/pair-3-after.jpg",
    beforeAlt: "Damaged father and son photograph, circa 1960s",
    afterAlt: "Restored father and son photograph",
    era: "c. 1961",
  },
  {
    before: "/demo/pair-4-before.jpg",
    after: "/demo/pair-4-after.jpg",
    beforeAlt: "Deteriorated portrait of young woman, circa 1920s",
    afterAlt: "Restored portrait of young woman",
    era: "c. 1921",
  },
] as const;

interface HomePageProps {
  searchParams: Promise<{ authPrompt?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  const params = await searchParams;
  const showModal = params.authPrompt === "true" && !session?.user;

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const balance = userId ? await getBalance(userId) : null;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF7F2" }}>
      <Nav session={session ?? null} creditBalance={balance} />

      <main className="flex-1">
        {session?.user ? (
          /* ── Authenticated: upload tool ─────────────────────────── */
          <section className="mx-auto max-w-[1140px] px-6 pt-16 pb-20">
            <div className="max-w-xl">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "#B5622A", letterSpacing: "0.12em" }}
              >
                AI Photo Restoration
              </p>
              <h1
                className="text-4xl font-light mb-3"
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  color: "#1C1410",
                  fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                }}
              >
                Restore a photo
              </h1>
              <p className="text-base mb-8" style={{ color: "#6B5D52" }}>
                Upload a faded, scratched, or damaged photograph and our AI will
                return the detail, color, and life that time has taken away.
              </p>
              <UploadSection />
            </div>
          </section>
        ) : (
          /* ── Unauthenticated: hero + film strip ─────────────────── */
          <>
            {/* Hero */}
            <section className="mx-auto max-w-[1140px] px-6 pt-24 pb-16 grid lg:grid-cols-2 gap-16 items-center">
              {/* LEFT: copy */}
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-6"
                  style={{ color: "#B5622A", letterSpacing: "0.12em" }}
                >
                  AI Photo Restoration
                </p>
                <h1
                  className="font-light leading-[1.1] mb-6"
                  style={{
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    color: "#1C1410",
                    fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  }}
                >
                  Give your family photos the care they deserve.
                </h1>
                <p
                  className="text-lg leading-relaxed mb-10 max-w-md"
                  style={{ color: "#4A3F35" }}
                >
                  Upload a faded, scratched, or damaged photo and our AI will
                  restore it — returning the detail, color, and life that time
                  has taken away.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      // signIn triggers the Google OAuth flow; callbackUrl
                      // brings them back to / where UploadSection is shown
                    }}
                    href="/?authPrompt=true"
                    asLink
                  >
                    Restore a photo — it&rsquo;s free
                  </Button>
                  <a
                    href="/billing"
                    className="text-sm font-medium self-center underline-offset-2"
                    style={{ color: "#8A7A6E", textDecoration: "underline" }}
                  >
                    View pricing
                  </a>
                </div>
                <p className="mt-4 text-xs" style={{ color: "#A89380" }}>
                  2 free credits on sign-up. No credit card required.
                </p>
              </div>

              {/* RIGHT: before/after preview (lg only) */}
              <div className="hidden lg:block">
                <BeforeAfterSlider
                  beforeSrc={DEMO_PAIRS[0].before}
                  afterSrc={DEMO_PAIRS[0].after}
                  beforeAlt={DEMO_PAIRS[0].beforeAlt}
                  afterAlt={DEMO_PAIRS[0].afterAlt}
                  className="aspect-[2/3] w-full max-w-sm mx-auto"
                />
                <p
                  className="mt-3 text-center text-xs"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    color: "#A89380",
                    letterSpacing: "0.08em",
                  }}
                >
                  {DEMO_PAIRS[0].era}
                </p>
              </div>
            </section>

            {/* Film strip — horizontal scroll demo */}
            <section
              className="border-t border-b py-12 overflow-hidden"
              style={{ borderColor: "#EDE5D8", backgroundColor: "#F2EDE5" }}
              aria-label="Before and after photo restoration examples"
            >
              {/* Film grain overlay */}
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`,
                  mixBlendMode: "multiply",
                }}
              />

              <div className="mx-auto max-w-[1140px] px-6 mb-8 relative">
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-1"
                  style={{ color: "#B5622A", letterSpacing: "0.12em" }}
                >
                  Before &amp; After
                </p>
                <h2
                  className="text-2xl font-light"
                  style={{
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    color: "#1C1410",
                  }}
                >
                  Decades of damage, undone.
                </h2>
              </div>

              {/* Scrollable film strip */}
              <div
                className="flex gap-6 px-6 overflow-x-auto pb-2 snap-x snap-mandatory"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#C9BAA8 transparent",
                  paddingLeft: "max(1.5rem, calc((100vw - 1140px) / 2 + 1.5rem))",
                }}
              >
                {DEMO_PAIRS.map((pair, i) => (
                  <div
                    key={pair.era}
                    className="flex-none snap-start flex flex-col"
                    style={{ width: "clamp(240px, 28vw, 320px)" }}
                  >
                    <BeforeAfterSlider
                      beforeSrc={pair.before}
                      afterSrc={pair.after}
                      beforeAlt={pair.beforeAlt}
                      afterAlt={pair.afterAlt}
                      className="aspect-[2/3] w-full"
                    />
                    <p
                      className="mt-2 text-xs text-center"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        color: "#A89380",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {pair.era}
                    </p>
                  </div>
                ))}
                {/* Fade-out hint on the right — indicates scroll continuation */}
                <div
                  aria-hidden="true"
                  className="flex-none w-16 shrink-0"
                  style={{ minWidth: 16 }}
                />
              </div>
            </section>

            {/* How it works */}
            <section
              id="how-it-works"
              className="border-t"
              style={{ borderColor: "#D9CDB8", backgroundColor: "#FAF7F2" }}
            >
              <div className="mx-auto max-w-[1140px] px-6 py-20">
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-4 text-center"
                  style={{ color: "#B5622A", letterSpacing: "0.12em" }}
                >
                  The Process
                </p>
                <h2
                  className="text-3xl font-light text-center mb-16"
                  style={{
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    color: "#1C1410",
                  }}
                >
                  Three steps. One restored memory.
                </h2>

                <div className="grid md:grid-cols-3 gap-12">
                  {[
                    {
                      step: "01",
                      title: "Upload your photo",
                      body: "Drag and drop any old, faded, or damaged photograph. We accept JPEG, PNG, TIFF, HEIC, and WebP — up to 20 MB.",
                      icon: (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      ),
                    },
                    {
                      step: "02",
                      title: "AI restores it",
                      body: "Our AI analyzes the damage — scratches, fading, tears, and noise — then meticulously reconstructs the original detail.",
                      icon: (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                        </svg>
                      ),
                    },
                    {
                      step: "03",
                      title: "Download full resolution",
                      body: "Preview the result — then unlock the full-resolution download for 1 credit. Yours to keep and print forever.",
                      icon: (
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      ),
                    },
                  ].map(({ step, title, body, icon }) => (
                    <div key={step} className="flex flex-col">
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center mb-6 shrink-0"
                        style={{ backgroundColor: "#E8C5A8", color: "#B5622A" }}
                      >
                        {icon}
                      </div>
                      <p
                        className="text-xs font-semibold uppercase tracking-widest mb-2"
                        style={{ color: "#A89380", letterSpacing: "0.1em" }}
                      >
                        Step {step}
                      </p>
                      <h3
                        className="text-xl font-medium mb-3"
                        style={{
                          fontFamily: "var(--font-fraunces), Georgia, serif",
                          color: "#1C1410",
                        }}
                      >
                        {title}
                      </h3>
                      <p className="text-sm leading-relaxed" style={{ color: "#6B5D52" }}>
                        {body}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-16 text-center">
                  <Button
                    variant="primary"
                    size="lg"
                    href="/?authPrompt=true"
                    asLink
                  >
                    Restore a photo — it&rsquo;s free
                  </Button>
                  <p className="mt-3 text-xs" style={{ color: "#A89380" }}>
                    2 free credits on sign-up. No credit card required.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        className="border-t py-8"
        style={{ borderColor: "#D9CDB8", backgroundColor: "#FAF7F2" }}
      >
        <div className="mx-auto max-w-[1140px] px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span
            className="text-sm"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#8A7A6E" }}
          >
            PicRenew
          </span>
          <p className="text-xs" style={{ color: "#A89380" }}>
            © {new Date().getFullYear()} PicRenew. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Auth prompt modal — shown when redirected from a protected route */}
      <AuthPromptModal showModal={showModal} />
    </div>
  );
}
