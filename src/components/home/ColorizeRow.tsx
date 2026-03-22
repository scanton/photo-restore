import { existsSync } from "fs";
import path from "path";
import { BeforeAfterSlider } from "@/components/before-after-slider";

const ALL_PAIRS = [
  {
    before: "/colorize/portrait-1940s-before.jpg",
    after: "/colorize/portrait-1940s-after.jpg",
    beforeAlt: "Faded black and white portrait, 1940s",
    afterAlt: "Fully colorized portrait, 1940s",
    era: "1940s Portrait",
  },
  {
    before: "/colorize/family-1950s-before.jpg",
    after: "/colorize/family-1950s-after.jpg",
    beforeAlt: "Black and white family photograph, 1950s",
    afterAlt: "Colorized family photograph, 1950s",
    era: "1950s Family",
  },
  {
    before: "/colorize/outdoor-1960s-before.jpg",
    after: "/colorize/outdoor-1960s-after.jpg",
    beforeAlt: "Black and white outdoor photograph, 1960s",
    afterAlt: "Colorized outdoor photograph, 1960s",
    era: "1960s Outdoor",
  },
  {
    before: "/colorize/couple-1970s-before.jpg",
    after: "/colorize/couple-1970s-after.jpg",
    beforeAlt: "Black and white photograph of a couple, 1970s",
    afterAlt: "Colorized photograph of a couple, 1970s",
    era: "1970s Couple",
  },
] as const;

// Computed once per cold start — /public files are static per deployment.
// Only renders pairs where both before and after images are present on disk.
const availablePairs = ALL_PAIRS.filter(
  (p) =>
    existsSync(path.join(process.cwd(), "public", p.before)) &&
    existsSync(path.join(process.cwd(), "public", p.after))
);

export function ColorizeRow() {
  if (availablePairs.length === 0) return null;

  return (
    <section
      className="border-t"
      style={{ borderColor: "#D9CDB8", backgroundColor: "#FAF7F2" }}
    >
      <div className="mx-auto max-w-[1140px] px-6 py-16">
        {/* Section header */}
        <div className="text-center mb-10">
          {/* #9B5424 on #FAF7F2 = 5.3:1 — WCAG AA */}
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "#9B5424", letterSpacing: "0.12em" }}
          >
            Before &amp; After
          </p>
          <h2
            className="font-light mb-3"
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              color: "#1C1410",
              fontSize: "clamp(1.5rem, 3vw, 1.75rem)",
              lineHeight: 1.2,
            }}
          >
            From faded to full color
          </h2>
          <p
            className="text-sm max-w-md mx-auto"
            style={{ color: "#6B5D52", lineHeight: 1.6 }}
          >
            Watch old black-and-white photographs come alive with modern color
            and lighting — as if taken today.
          </p>
        </div>

        {/* Grid — 2 cols on mobile, 4 on tablet/desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {availablePairs.map((pair) => (
            <div key={pair.era} className="flex flex-col">
              <BeforeAfterSlider
                beforeSrc={pair.before}
                afterSrc={pair.after}
                beforeAlt={pair.beforeAlt}
                afterAlt={pair.afterAlt}
                afterLabel="Colorized"
                className="aspect-[2/3] w-full"
              />
              {/* #6B5D52 on #FAF7F2 = 5.8:1 — WCAG AA */}
              <p
                className="mt-2 text-xs text-center"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  color: "#6B5D52",
                  letterSpacing: "0.08em",
                }}
              >
                {pair.era}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
