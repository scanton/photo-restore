"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { Button } from "@/components/ui/button";

type RestorationStatus =
  | "analyzing"
  | "watermarking"
  | "pending_payment"
  | "processing"
  | "complete"
  | "failed";

interface StatusResponse {
  id: string;
  status: RestorationStatus;
  inputBlobUrl?: string | null;
  watermarkedBlobUrl?: string | null;
  outputBlobUrl?: string | null;
  eraEstimate?: string | null;
  eraConfidence?: number | null;
  creditsCharged: number;
}

const STATUS_LABELS: Record<RestorationStatus, string> = {
  analyzing: "Analyzing your photo…",
  watermarking: "Preparing preview…",
  pending_payment: "Preview ready",
  processing: "Restoring your photo…",
  complete: "Restoration complete",
  failed: "Restoration failed",
};

const POLL_INTERVAL = 2000;

export default function RestorePage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<StatusResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/restore/${id}/status`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to load status.");
      }
      const json = await res.json() as StatusResponse;
      setData(json);
      setFetchError(null);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error.");
    }
  }, [id]);

  // Polling
  useEffect(() => {
    void fetchStatus();

    const terminalStatuses: RestorationStatus[] = ["complete", "failed"];

    const intervalId = setInterval(() => {
      if (data && terminalStatuses.includes(data.status)) {
        clearInterval(intervalId);
        return;
      }
      void fetchStatus();
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchStatus, data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const res = await fetch(`/api/restore/${id}/purchase`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        alert(body.error ?? "Purchase failed. Please try again.");
        return;
      }
      // Refresh status after purchase
      await fetchStatus();
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleDownload = async () => {
    if (!data?.outputBlobUrl) return;
    const link = document.createElement("a");
    link.href = data.outputBlobUrl;
    link.download = `restored-${id}.jpg`;
    link.click();
  };

  const status = data?.status;
  const isProcessing = status === "analyzing" || status === "watermarking" || status === "processing";
  const canPreview = status === "pending_payment" || status === "complete";
  const isFailed = status === "failed";
  const isComplete = status === "complete";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF7F2" }}>
      {/* Nav */}
      <header className="w-full border-b" style={{ borderColor: "#D9CDB8" }}>
        <div className="mx-auto max-w-[1140px] px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#1C1410" }}
          >
            Photo Restore
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1140px] px-6 py-12">
        {fetchError && (
          <div
            className="mb-8 px-4 py-3 rounded-[8px] text-sm"
            style={{ backgroundColor: "#FCEAEA", color: "#B83B3B" }}
          >
            {fetchError}
          </div>
        )}

        {/* Status header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            {isProcessing && (
              <svg
                className="animate-spin shrink-0"
                width="20"
                height="20"
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
            )}
            {isFailed && (
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="9" stroke="#B83B3B" strokeWidth="1.5" />
                <path
                  d="M7 7l6 6M13 7l-6 6"
                  stroke="#B83B3B"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {isComplete && (
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="9" stroke="#3D7A4F" strokeWidth="1.5" />
                <path
                  d="M6 10l3 3 5-5"
                  stroke="#3D7A4F"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <h1
              className="text-2xl font-light"
              style={{
                fontFamily: "var(--font-fraunces), Georgia, serif",
                color: "#1C1410",
              }}
            >
              {status ? STATUS_LABELS[status] : "Loading…"}
            </h1>
          </div>

          {/* Era estimate */}
          {data?.eraEstimate && (
            <p
              className="text-sm mt-1"
              style={{ fontFamily: "var(--font-mono), monospace", color: "#8A7A6E" }}
            >
              Era estimate: {data.eraEstimate}
              {data.eraConfidence != null &&
                ` (${Math.round(data.eraConfidence * 100)}% confidence)`}
            </p>
          )}
        </div>

        {/* Processing state */}
        {isProcessing && !data?.watermarkedBlobUrl && (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-[16px]"
            style={{ backgroundColor: "#F2EDE5" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: "#E8C5A8" }}
            >
              <svg
                className="animate-spin"
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                aria-label="Processing"
              >
                <circle cx="16" cy="16" r="12" stroke="#D4C9BB" strokeWidth="3" />
                <path
                  d="M28 16a12 12 0 0 0-12-12"
                  stroke="#B5622A"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p
              className="text-lg font-light"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#1C1410" }}
            >
              Handling your photo with care.
            </p>
            <p className="mt-2 text-sm" style={{ color: "#8A7A6E" }}>
              This usually takes 20–60 seconds.
            </p>
          </div>
        )}

        {/* Preview / result */}
        {canPreview && data && (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Image comparison */}
            <div>
              {data.inputBlobUrl && data.watermarkedBlobUrl ? (
                <BeforeAfterSlider
                  beforeSrc={data.inputBlobUrl}
                  afterSrc={data.watermarkedBlobUrl}
                  className={`w-full aspect-[4/3] ${status === "pending_payment" ? "filter blur-[2px]" : ""}`}
                />
              ) : (
                <div
                  className="w-full aspect-[4/3] rounded-[12px] animate-pulse"
                  style={{ backgroundColor: "#E8E0D4" }}
                />
              )}

              {status === "pending_payment" && (
                <p className="mt-2 text-xs text-center" style={{ color: "#8A7A6E" }}>
                  Preview — purchase to unlock full resolution
                </p>
              )}
            </div>

            {/* Actions panel */}
            <div
              className="rounded-[16px] p-8"
              style={{ backgroundColor: "#F2EDE5" }}
            >
              {status === "pending_payment" && (
                <>
                  <h2
                    className="text-xl font-light mb-2"
                    style={{
                      fontFamily: "var(--font-fraunces), Georgia, serif",
                      color: "#1C1410",
                    }}
                  >
                    Your restoration is ready.
                  </h2>
                  <p className="text-sm mb-6" style={{ color: "#6B5D52" }}>
                    Unlock the full-resolution version to download, print, and
                    keep forever.
                  </p>

                  <div
                    className="flex items-center justify-between py-3 px-4 rounded-[8px] mb-6"
                    style={{ backgroundColor: "#E8E0D4" }}
                  >
                    <span className="text-sm font-medium" style={{ color: "#1C1410" }}>
                      Standard Restore
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        color: "#B5622A",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {data.creditsCharged} credit{data.creditsCharged !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    loading={purchasing}
                    onClick={() => void handlePurchase()}
                  >
                    Download full resolution
                  </Button>
                  <p className="mt-3 text-xs text-center" style={{ color: "#A89380" }}>
                    Uses {data.creditsCharged} credit from your balance
                  </p>
                </>
              )}

              {isComplete && (
                <>
                  <h2
                    className="text-xl font-light mb-2"
                    style={{
                      fontFamily: "var(--font-fraunces), Georgia, serif",
                      color: "#1C1410",
                    }}
                  >
                    Download your photo.
                  </h2>
                  <p className="text-sm mb-6" style={{ color: "#6B5D52" }}>
                    Your restored photo is ready in full resolution.
                  </p>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => void handleDownload()}
                  >
                    Download full resolution
                  </Button>

                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      size="md"
                      className="w-full"
                      onClick={() => (window.location.href = "/")}
                    >
                      Restore another photo
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-[16px]"
            style={{ backgroundColor: "#FCEAEA" }}
          >
            <p
              className="text-lg font-light mb-4"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#B83B3B" }}
            >
              Something went wrong with this restoration.
            </p>
            <p className="text-sm mb-8" style={{ color: "#6B5D52" }}>
              Your credits have not been charged. Please try uploading again.
            </p>
            <Button
              variant="primary"
              onClick={() => (window.location.href = "/")}
            >
              Try again
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
