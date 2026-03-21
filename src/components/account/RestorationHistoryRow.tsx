import Link from "next/link";

type RestorationStatus =
  | "ready"
  | "analyzing"
  | "watermarking"
  | "pending_payment"
  | "processing"
  | "complete"
  | "failed"
  | "refunded";

interface RestorationHistoryRowProps {
  id: string;
  status: RestorationStatus;
  resolution: "1k" | "2k" | "4k";
  outputBlobUrl: string | null;
  inputBlobUrl: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  eraEstimate: string | null;
}

/**
 * A single row in the restoration history table on /account.
 *
 * Row states:
 *   complete + not expired → download link + era label
 *   complete + expired     → "Expired" badge, no download
 *   processing/analyzing/watermarking → "In progress" → links to /restore/[id]
 *   failed/refunded        → "Failed" badge
 *   pending_payment        → links back to /restore/[id] to complete purchase
 *   ready                  → links back to /restore/[id]
 *
 * expiresAt IS NULL → treated as non-expired (subscriber benefit handled
 * at the application level, not here).
 */
export function RestorationHistoryRow({
  id,
  status,
  resolution,
  outputBlobUrl,
  inputBlobUrl,
  expiresAt,
  createdAt,
  eraEstimate,
}: RestorationHistoryRowProps) {
  const now = new Date();
  const isExpired = expiresAt !== null && expiresAt < now;

  const formattedDate = createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // Thumbnail — show input image as fallback if output isn't available
  const thumbSrc = inputBlobUrl;

  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-[12px] border"
      style={{ backgroundColor: "#F2EDE5", borderColor: "#D9CDB8" }}
    >
      {/* Thumbnail */}
      <div
        className="shrink-0 rounded-[8px] overflow-hidden"
        style={{ width: 52, height: 52, backgroundColor: "#E8E0D4" }}
      >
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C9BAA8"
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
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {eraEstimate ? (
            <span
              className="text-sm font-medium truncate"
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                color: "#1C1410",
              }}
            >
              {eraEstimate}
            </span>
          ) : (
            <span className="text-sm font-medium truncate" style={{ color: "#1C1410" }}>
              Restoration
            </span>
          )}
          {/* Resolution badge */}
          <span
            className="shrink-0 text-xs px-1.5 py-0.5 rounded-[4px]"
            style={{
              fontFamily: "var(--font-mono), monospace",
              backgroundColor: "#E8C5A8",
              color: "#8A4520",
            }}
          >
            {resolution.toUpperCase()}
          </span>
        </div>
        <p className="text-xs" style={{ color: "#A89380" }}>
          {formattedDate}
        </p>
      </div>

      {/* Status / Action */}
      <div className="shrink-0 flex items-center gap-3">
        {status === "complete" && !isExpired && outputBlobUrl ? (
          <a
            href={outputBlobUrl}
            download
            className="text-sm font-semibold px-4 py-1.5 rounded-[8px] transition-colors duration-150"
            style={{ backgroundColor: "#B5622A", color: "#FAF7F2" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = "#D4874E")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = "#B5622A")
            }
          >
            Download
          </a>
        ) : status === "complete" && isExpired ? (
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-1 rounded-[4px]"
              style={{ backgroundColor: "#FDF3E7", color: "#C17A2A" }}
            >
              Expired
            </span>
            <Link
              href={`/restore/${id}`}
              className="text-xs font-medium underline underline-offset-2"
              style={{ color: "#6B5D52" }}
            >
              Re-restore
            </Link>
          </div>
        ) : status === "failed" || status === "refunded" ? (
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-1 rounded-[4px]"
              style={{ backgroundColor: "#FCEAEA", color: "#B83B3B" }}
            >
              Failed
            </span>
            <Link
              href="/"
              className="text-xs font-medium underline underline-offset-2"
              style={{ color: "#6B5D52" }}
            >
              Try again
            </Link>
          </div>
        ) : status === "processing" ||
          status === "analyzing" ||
          status === "watermarking" ? (
          <Link
            href={`/restore/${id}`}
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "#B5622A" }}
          >
            <svg
              className="animate-spin shrink-0"
              width="14"
              height="14"
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
            In progress
          </Link>
        ) : (
          /* ready, pending_payment — direct back to the restore page */
          <Link
            href={`/restore/${id}`}
            className="text-sm font-medium underline underline-offset-2"
            style={{ color: "#6B5D52" }}
          >
            Continue
          </Link>
        )}
      </div>
    </div>
  );
}
