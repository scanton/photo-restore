"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { BeforeAfterSlider } from "@/components/before-after-slider";
import { Button } from "@/components/ui/button";
import {
  ResolutionPicker,
  RESOLUTION_OPTIONS,
  type Resolution,
} from "@/components/restore/ResolutionPicker";

type RestorationStatus =
  | "ready"
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
  guestPurchased: boolean;
  resolution: Resolution;
  presetId: string;
}

const STATUS_LABELS: Record<RestorationStatus, string> = {
  ready: "Ready to restore",
  analyzing: "Analyzing your photo…",
  watermarking: "Preparing preview…",
  pending_payment: "Preview ready",
  processing: "Restoring your photo…",
  complete: "Restoration complete",
  failed: "Restoration failed",
};

// 20-message array — cycles every 4s during analyzing/watermarking
const ROLLING_MESSAGES: string[] = [
  "Dusting off the years…",
  "Analyzing light and shadow…",
  "Recovering lost detail…",
  "Reconstructing fine grain…",
  "Enhancing facial features…",
  "Restoring tonal range…",
  "Sharpening edges…",
  "Balancing contrast…",
  "Clearing blemishes…",
  "Recovering highlights…",
  "Deepening the shadows…",
  "Enhancing textures…",
  "Matching era-accurate tones…",
  "Carefully rebuilding…",
  "Detecting photo era…",
  "Calibrating color balance…",
  "Removing artifacts…",
  "Applying final refinements…",
  "Almost there…",
  "Adding finishing touches…",
];

const POLL_INTERVAL = 2000;

export default function RestorePage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<StatusResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [guestPurchasing, setGuestPurchasing] = useState(false);
  const [resolution, setResolution] = useState<Resolution>("1k");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);

  // Sprint 4: restoration options
  const [removeFrame, setRemoveFrame] = useState(false);
  const [colorize, setColorize] = useState(false);
  const [starting, setStarting] = useState(false);

  // Polling control — set true after /start succeeds, or on mount if already mid-flow
  const [hasStarted, setHasStarted] = useState(false);

  // Rolling message index (cycles during analyzing/watermarking)
  const [rollingMsgIdx, setRollingMsgIdx] = useState(0);

  // Ref always holds the latest status so the interval callback doesn't capture stale state
  const statusRef = useRef<RestorationStatus | null>(null);
  useEffect(() => {
    statusRef.current = data?.status ?? null;
  }, [data?.status]);

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

  // Fetch credit balance for "Use Credits" affordance
  useEffect(() => {
    void fetch("/api/credits/balance")
      .then((r) => {
        if (!r.ok) throw new Error("balance fetch failed");
        return r.json();
      })
      .then((d: { balance?: number }) => {
        setBalance(d.balance ?? 0);
        setBalanceError(false);
      })
      .catch(() => {
        setBalanceError(true);
      });
  }, []);

  // Initial fetch on mount — if already mid-flow, enable polling immediately
  useEffect(() => {
    void fetchStatus().then(() => {
      const s = statusRef.current;
      if (s && s !== "ready" && s !== "complete" && s !== "failed") {
        setHasStarted(true);
      }
    });
  }, [fetchStatus]);

  // Detect ?download=success query param (Stripe redirect after guest checkout)
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("download") === "success") {
      window.history.replaceState({}, "", `/restore/${id}`);
      void fetchStatus();
    }
  }, [fetchStatus, id]);

  // Polling — only active after hasStarted is true
  useEffect(() => {
    if (!hasStarted) return;

    const intervalId = setInterval(() => {
      const current = statusRef.current;
      if (current === "complete" || current === "failed") {
        clearInterval(intervalId);
        return;
      }
      void fetchStatus();
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [fetchStatus, hasStarted]);

  // Rolling messages — cycle every 4s when status is analyzing or watermarking
  useEffect(() => {
    const s = data?.status;
    if (s !== "analyzing" && s !== "watermarking") return;

    const id = setInterval(() => {
      setRollingMsgIdx((i) => (i + 1) % ROLLING_MESSAGES.length);
    }, 4000);

    return () => clearInterval(id);
  }, [data?.status]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/restore/${id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeFrame, colorize }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        alert(body.error ?? "Failed to start restoration. Please try again.");
        return;
      }
      // Trigger polling
      setHasStarted(true);
      // Optimistically update status to show spinner immediately
      setData((prev) => prev ? { ...prev, status: "analyzing" } : prev);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const res = await fetch(`/api/restore/${id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; code?: string };
        if (body.code === "insufficient_credits") {
          window.location.href = "/billing";
          return;
        }
        alert(body.error ?? "Purchase failed. Please try again.");
        return;
      }
      // Refresh status and balance after purchase
      await fetchStatus();
      void fetch("/api/credits/balance")
        .then((r) => r.json())
        .then((d: { balance?: number }) => setBalance(d.balance ?? 0));
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleGuestCheckout = async () => {
    setGuestPurchasing(true);
    try {
      const res = await fetch("/api/checkout/create-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restorationId: id }),
      });
      const body = await res.json() as { checkoutUrl?: string; error?: string };
      if (!res.ok || !body.checkoutUrl) {
        alert(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = body.checkoutUrl;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setGuestPurchasing(false);
    }
  };

  const handleDownload = async () => {
    if (!data?.outputBlobUrl) return;
    const link = document.createElement("a");
    link.href = data.outputBlobUrl;
    link.download = `restored-${id}.jpg`;
    link.click();
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const status = data?.status;
  const isReady = status === "ready";
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
            PicRenew
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
              {status ? STATUS_LABELS[status] : fetchError ? "Restoration not found." : "Loading…"}
            </h1>
          </div>

          {/* Era estimate */}
          {data?.eraEstimate && (
            <p
              className="text-sm mt-1"
              style={{ fontFamily: "var(--font-mono), monospace", color: "#6B5D52" }}
            >
              Era estimate: {data.eraEstimate}
              {data.eraConfidence != null &&
                ` (${Math.round(data.eraConfidence * 100)}% confidence)`}
            </p>
          )}

          {/* Rolling message during processing */}
          {isProcessing && (
            <p
              className="text-sm mt-1 transition-opacity duration-500"
              style={{ color: "#6B5D52" }}
            >
              {ROLLING_MESSAGES[rollingMsgIdx]}
            </p>
          )}
        </div>

        {/* ── Ready: two-column — source image + options ────────── */}
        {isReady && (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left: source photo so user knows what they're working with */}
            <div>
              {data?.inputBlobUrl ? (
                <div
                  className="relative w-full rounded-[12px] overflow-hidden"
                  style={{ aspectRatio: "2/3", maxWidth: 480 }}
                >
                  <Image
                    src={data.inputBlobUrl}
                    alt="Your uploaded photo"
                    fill
                    sizes="(max-width: 1024px) 100vw, 570px"
                    className="object-contain"
                  />
                </div>
              ) : (
                /* Shimmer skeleton while inputBlobUrl loads */
                <div
                  className="w-full rounded-[12px] animate-pulse"
                  style={{ aspectRatio: "2/3", maxWidth: 480, backgroundColor: "#E8E0D4" }}
                />
              )}
            </div>

            {/* Right: options card */}
            <div
              className="rounded-[16px] p-8 border"
              style={{ backgroundColor: "#F2EDE5", borderColor: "#D9CDB8" }}
            >
              {/* Balance fetch error warning */}
              {balanceError && (
                <div
                  className="mb-4 px-3 py-2 rounded-[8px] text-xs"
                  style={{ backgroundColor: "#FEF3E2", color: "#9B5424" }}
                  role="alert"
                >
                  Could not load credit balance. Check your connection or reload.
                </div>
              )}

              <h2
                className="text-xl font-light mb-2"
                style={{
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                  color: "#1C1410",
                }}
              >
                Choose restoration options.
              </h2>
              <p className="text-sm mb-6" style={{ color: "#6B5D52" }}>
                Customize your restoration before we begin. These options are
                applied at processing time and cannot be changed afterwards.
              </p>

              {/* Restoration toggles */}
              <div className="flex flex-col gap-4 mb-6">
                {/* Remove Frame */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeFrame}
                    onChange={(e) => setRemoveFrame(e.target.checked)}
                    className="mt-0.5 shrink-0"
                    style={{ accentColor: "#B5622A" }}
                  />
                  <div>
                    <span
                      className="text-sm font-semibold block"
                      style={{ color: "#1C1410" }}
                    >
                      Remove frame or border
                    </span>
                    <span className="text-xs" style={{ color: "#6B5D52" }}>
                      Crops out physical frames, decorative borders, or white edges
                    </span>
                  </div>
                </label>

                {/* Colorize */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colorize}
                    onChange={(e) => setColorize(e.target.checked)}
                    className="mt-0.5 shrink-0"
                    style={{ accentColor: "#B5622A" }}
                  />
                  <div>
                    <span
                      className="text-sm font-semibold block"
                      style={{ color: "#1C1410" }}
                    >
                      Colorize
                    </span>
                    <span className="text-xs" style={{ color: "#6B5D52" }}>
                      Adds natural, period-accurate color to black &amp; white photos
                    </span>
                  </div>
                </label>
              </div>

              {/* Resolution picker */}
              <div className="mb-8">
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: "#6B5D52", letterSpacing: "0.08em" }}
                >
                  Output resolution
                </p>
                <ResolutionPicker
                  resolution={resolution}
                  setResolution={setResolution}
                  balance={balance}
                />
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                loading={starting}
                onClick={() => void handleStart()}
              >
                Restore this photo
              </Button>
            </div>
          </div>
        )}

        {/* ── Processing: spinner + rolling message ─────────────── */}
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
            <p className="mt-2 text-sm" style={{ color: "#6B5D52" }}>
              This usually takes 20–60 seconds.
            </p>
          </div>
        )}

        {/* ── Preview / result ──────────────────────────────────── */}
        {canPreview && data && (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Image comparison */}
            <div>
              {data.inputBlobUrl && data.watermarkedBlobUrl ? (
                <BeforeAfterSlider
                  beforeSrc={data.inputBlobUrl}
                  afterSrc={data.watermarkedBlobUrl}
                  className={`w-full ${status === "pending_payment" ? "filter blur-[2px]" : ""}`}
                />
              ) : (
                <div
                  className="w-full aspect-[4/3] rounded-[12px] animate-pulse"
                  style={{ backgroundColor: "#E8E0D4" }}
                />
              )}

              {status === "pending_payment" && (
                <p className="mt-2 text-xs text-center" style={{ color: "#6B5D52" }}>
                  Preview — purchase to unlock full resolution
                </p>
              )}
            </div>

            {/* Actions panel */}
            <div
              className="rounded-[16px] p-8"
              style={{ backgroundColor: "#F2EDE5" }}
            >
              {/* ── pending_payment: guest OR credits CTA ── */}
              {status === "pending_payment" && (() => {
                const selectedOption = RESOLUTION_OPTIONS.find((o) => o.value === resolution)!;
                const hasCredits = balance !== null && balance >= selectedOption.credits;

                return (
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
                      Unlock the full-resolution download, or use credits for
                      higher output quality.
                    </p>

                    {/* $0.99 guest download — no account required */}
                    <div
                      className="mb-5 rounded-[12px] p-4 border"
                      style={{ backgroundColor: "#FAF7F2", borderColor: "#D9CDB8" }}
                    >
                      <p
                        className="text-sm font-semibold mb-1"
                        style={{ color: "#1C1410" }}
                      >
                        Quick download — no account needed
                      </p>
                      <p className="text-xs mb-3" style={{ color: "#6B5D52" }}>
                        Standard resolution (1K) · Download once · $0.99
                      </p>
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full"
                        loading={guestPurchasing}
                        onClick={() => void handleGuestCheckout()}
                      >
                        Pay $0.99 — download now
                      </Button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-px" style={{ backgroundColor: "#D9CDB8" }} />
                      <span className="text-xs" style={{ color: "#6B5D52" }}>or use credits</span>
                      <div className="flex-1 h-px" style={{ backgroundColor: "#D9CDB8" }} />
                    </div>

                    {/* Resolution picker */}
                    <div className="mb-5">
                      <p
                        className="text-xs font-semibold uppercase tracking-widest mb-3"
                        style={{ color: "#6B5D52", letterSpacing: "0.08em" }}
                      >
                        Output resolution
                      </p>
                      <ResolutionPicker
                        resolution={resolution}
                        setResolution={setResolution}
                        balance={balance}
                      />
                    </div>

                    {/* Balance indicator */}
                    {balance !== null && (
                      <p
                        className="text-xs mb-4"
                        style={{ color: hasCredits ? "#6B5D52" : "#B83B3B" }}
                      >
                        {hasCredits
                          ? `You have ${balance} credit${balance !== 1 ? "s" : ""} — ${balance - selectedOption.credits} remaining after this.`
                          : `You need ${selectedOption.credits} credits but have ${balance}. Buy more below.`}
                      </p>
                    )}

                    {/* Use Credits CTA */}
                    <Button
                      variant="secondary"
                      size="md"
                      className="w-full"
                      loading={purchasing}
                      disabled={!hasCredits}
                      onClick={() => void handlePurchase()}
                    >
                      Use {selectedOption.credits} credit{selectedOption.credits !== 1 ? "s" : ""}
                    </Button>

                    {/* Buy credits link */}
                    {!hasCredits && (
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => (window.location.href = "/billing")}
                        >
                          Buy credits →
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── complete: download CTA ── */}
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
                    Your restored photo is ready.
                    {data.guestPurchased
                      ? " Thank you for your purchase."
                      : " Full resolution, ready to print and keep."}
                  </p>

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => void handleDownload()}
                  >
                    Download restored photo
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

        {/* ── Failed state ──────────────────────────────────────── */}
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
