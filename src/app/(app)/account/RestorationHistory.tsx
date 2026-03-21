/**
 * RestorationHistory — async server component.
 *
 * Fetches and renders all restorations for the given userId.
 * Extracted to a separate file so it can be:
 *   a) Wrapped in <Suspense> by the page with a skeleton fallback
 *   b) Mocked independently in unit tests
 */
import { db, restorations, desc, eq } from "@/lib/db";
import { RestorationHistoryRow } from "@/components/account/RestorationHistoryRow";
import Link from "next/link";

export async function RestorationHistory({ userId }: { userId: string }) {
  const rows = await db
    .select()
    .from(restorations)
    .where(eq(restorations.userId, userId))
    .orderBy(desc(restorations.createdAt));

  if (rows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <RestorationHistoryRow
          key={r.id}
          id={r.id}
          status={r.status}
          resolution={r.resolution}
          outputBlobUrl={r.outputBlobUrl}
          inputBlobUrl={r.inputBlobUrl}
          expiresAt={r.expiresAt}
          createdAt={r.createdAt}
          eraEstimate={r.eraEstimate}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[16px] py-20 px-8 text-center"
      style={{ backgroundColor: "#F2EDE5" }}
    >
      {/* Warm illustration — photo frame outline */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
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
      <h2
        className="text-xl font-light mb-2"
        style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          color: "#1C1410",
        }}
      >
        No restorations yet
      </h2>
      <p className="text-sm mb-8 max-w-xs" style={{ color: "#6B5D52" }}>
        Upload your first faded or damaged photo and see it restored in minutes.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-[8px] text-sm font-semibold transition-colors duration-150"
        style={{ backgroundColor: "#B5622A", color: "#FAF7F2" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.backgroundColor = "#D4874E")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.backgroundColor = "#B5622A")
        }
      >
        Restore a photo
      </Link>
    </div>
  );
}
