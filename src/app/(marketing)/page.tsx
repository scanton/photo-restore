"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { UploadZone } from "@/components/upload-zone";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("preset", "standard");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Upload failed. Please try again.");
        }

        const { restorationId } = await res.json() as { restorationId: string };
        router.push(`/restore/${restorationId}`);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Something went wrong.");
        setUploading(false);
      }
    },
    [router]
  );

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FAF7F2" }}>
      {/* Nav */}
      <header className="w-full border-b" style={{ borderColor: "#D9CDB8" }}>
        <div className="mx-auto max-w-[1140px] px-6 h-16 flex items-center justify-between">
          <span
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#1C1410" }}
          >
            PicRenew
          </span>
          <nav className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-sm font-medium transition-colors duration-150"
              style={{ color: "#6B5D52" }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#1C1410")}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "#6B5D52")}
            >
              How it works
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-[1140px] px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            {/* Eyebrow */}
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-6"
              style={{ color: "#B5622A", letterSpacing: "0.12em" }}
            >
              AI Photo Restoration
            </p>

            <h1
              className="text-5xl leading-[1.1] font-light mb-6"
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
              Upload a faded, scratched, or damaged photo and our AI will restore
              it — returning the detail, color, and life that time has taken away.
            </p>

            {/* Upload zone */}
            <UploadZone onUpload={handleUpload} disabled={uploading} />

            {uploadError && (
              <p className="mt-3 text-sm" style={{ color: "#B83B3B" }}>
                {uploadError}
              </p>
            )}

            {uploading && (
              <div className="mt-4 flex items-center gap-3">
                <svg
                  className="animate-spin"
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="6" stroke="#D9CDB8" strokeWidth="2" />
                  <path
                    d="M14 8a6 6 0 0 0-6-6"
                    stroke="#B5622A"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="text-sm" style={{ color: "#6B5D52" }}>
                  Uploading your photo…
                </p>
              </div>
            )}
          </div>

          {/* Right: decorative before/after example hint */}
          <div
            className="hidden lg:flex flex-col items-center justify-center rounded-[16px] p-10 relative overflow-hidden"
            style={{ backgroundColor: "#F2EDE5", minHeight: 420 }}
          >
            {/* Film grain texture overlay */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
                mixBlendMode: "multiply",
                opacity: 0.5,
              }}
            />
            <div className="relative text-center">
              <div
                className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{ backgroundColor: "#E8C5A8" }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#B5622A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <p
                className="text-xl font-light"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#1C1410" }}
              >
                Your photo, transformed.
              </p>
              <p className="mt-2 text-sm" style={{ color: "#8A7A6E" }}>
                Upload above to see the difference.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-t"
          style={{ borderColor: "#D9CDB8", backgroundColor: "#F2EDE5" }}
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
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Restore a photo now
              </Button>
              <p className="mt-3 text-xs" style={{ color: "#A89380" }}>
                No account required to upload. Free preview.
              </p>
            </div>
          </div>
        </section>
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
    </div>
  );
}
