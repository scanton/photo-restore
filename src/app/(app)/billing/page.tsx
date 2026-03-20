"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, SUBSCRIPTIONS } from "@/lib/products";

type BillingInterval = "month" | "year";

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState<
    "success" | "cancelled" | null
  >(null);

  // Detect checkout return status from query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (status === "success" || status === "cancelled") {
      setCheckoutStatus(status);
      // Clean URL without reload
      window.history.replaceState({}, "", "/billing");
    }
  }, []);

  useEffect(() => {
    void fetch("/api/credits/balance")
      .then((r) => r.json())
      .then((data: { balance?: number }) => setBalance(data.balance ?? 0))
      .catch(() => setBalance(0));
  }, [checkoutStatus]); // re-fetch balance after successful checkout return

  const handleBuy = async (priceId: string) => {
    setLoadingPriceId(priceId);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        alert(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        alert(data.error ?? "Could not open billing portal.");
        return;
      }
      window.location.href = data.url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const filteredSubs = SUBSCRIPTIONS.filter((s) => s.interval === interval);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF7F2" }}>
      {/* Nav */}
      <header
        className="w-full border-b"
        style={{ borderColor: "#D9CDB8" }}
      >
        <div className="mx-auto max-w-[1140px] px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            className="text-xl font-bold"
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              color: "#1C1410",
            }}
          >
            PicRenew
          </a>
          <a
            href="/restore"
            className="text-sm font-medium"
            style={{ color: "#6B5D52" }}
          >
            ← Back
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1140px] px-6 py-12">
        {/* Checkout return banners */}
        {checkoutStatus === "success" && (
          <div
            className="mb-8 px-5 py-4 rounded-[8px] flex items-center gap-3"
            style={{ backgroundColor: "#E8F4EC", color: "#2D6B40" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="9" stroke="#3D7A4F" strokeWidth="1.5" />
              <path d="M6 10l3 3 5-5" stroke="#3D7A4F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium">
              Payment successful — your credits have been added.
            </span>
          </div>
        )}
        {checkoutStatus === "cancelled" && (
          <div
            className="mb-8 px-5 py-4 rounded-[8px]"
            style={{ backgroundColor: "#F2EDE5", color: "#6B5D52" }}
          >
            <span className="text-sm">Checkout cancelled — no charge was made.</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <h1
            className="text-3xl font-light mb-2"
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              color: "#1C1410",
            }}
          >
            Credits &amp; Billing
          </h1>
          <div className="flex items-center gap-4">
            <p className="text-sm" style={{ color: "#6B5D52" }}>
              Each credit restores one photo at standard resolution. Higher
              resolutions use more credits.
            </p>
            {balance !== null && (
              <span
                className="shrink-0 text-sm font-medium px-3 py-1 rounded-full"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  backgroundColor: "#E8C5A8",
                  color: "#8A4520",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {balance} credit{balance !== 1 ? "s" : ""} remaining
              </span>
            )}
          </div>
        </div>

        {/* ── One-time packs ───────────────────────────────────── */}
        <section className="mb-12">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-5"
            style={{ color: "#A89380", letterSpacing: "0.08em" }}
          >
            Credit Packs — one-time purchase
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.priceId}
                className="rounded-[16px] p-6 border flex flex-col"
                style={{
                  backgroundColor: "#F2EDE5",
                  borderColor: "#D9CDB8",
                }}
              >
                <p
                  className="text-base font-semibold mb-1"
                  style={{ color: "#1C1410" }}
                >
                  {pack.name}
                </p>
                <p
                  className="text-3xl font-light mb-1"
                  style={{
                    fontFamily: "var(--font-fraunces), Georgia, serif",
                    color: "#B5622A",
                  }}
                >
                  {pack.credits}
                  <span className="text-lg ml-1" style={{ color: "#8A7A6E" }}>
                    credits
                  </span>
                </p>
                <p
                  className="text-sm mb-5"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    color: "#6B5D52",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ${pack.price.toFixed(2)} one-time
                </p>
                <div className="mt-auto">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    loading={loadingPriceId === pack.priceId}
                    onClick={() => void handleBuy(pack.priceId)}
                  >
                    Buy {pack.credits} credits
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Subscriptions ────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#A89380", letterSpacing: "0.08em" }}
            >
              Subscriptions — credits renew monthly
            </p>
            {/* Monthly / Annual toggle */}
            <div
              className="flex rounded-[8px] border overflow-hidden"
              style={{ borderColor: "#D9CDB8" }}
            >
              {(["month", "year"] as const).map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className="px-4 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor:
                      interval === iv ? "#B5622A" : "transparent",
                    color: interval === iv ? "#FAF7F2" : "#6B5D52",
                  }}
                >
                  {iv === "month" ? "Monthly" : "Annual −10%"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {filteredSubs.map((sub) => {
              const isAnnual = sub.interval === "year";
              const monthlyEquiv = isAnnual
                ? (sub.price / 12).toFixed(2)
                : sub.price.toFixed(2);

              return (
                <div
                  key={sub.priceId}
                  className="rounded-[16px] p-6 border flex flex-col"
                  style={{
                    backgroundColor: "#F2EDE5",
                    borderColor: "#D9CDB8",
                  }}
                >
                  <p
                    className="text-base font-semibold mb-1"
                    style={{ color: "#1C1410" }}
                  >
                    {sub.name.replace(/ \(.*\)$/, "")}
                  </p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <p
                      className="text-3xl font-light"
                      style={{
                        fontFamily: "var(--font-fraunces), Georgia, serif",
                        color: "#B5622A",
                      }}
                    >
                      ${monthlyEquiv}
                    </p>
                    <span className="text-sm" style={{ color: "#8A7A6E" }}>
                      / mo
                    </span>
                  </div>
                  {isAnnual && (
                    <p
                      className="text-xs mb-1"
                      style={{ color: "#8A7A6E" }}
                    >
                      Billed ${sub.price.toFixed(2)}/year
                    </p>
                  )}
                  <p
                    className="text-sm mb-5"
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      color: "#6B5D52",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {sub.creditsPerMonth} credits/month
                  </p>
                  <div className="mt-auto">
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      loading={loadingPriceId === sub.priceId}
                      onClick={() => void handleBuy(sub.priceId)}
                    >
                      Subscribe
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Manage subscription ──────────────────────────────── */}
        <section>
          <div
            className="rounded-[16px] p-6 border flex items-center justify-between gap-6"
            style={{ backgroundColor: "#F2EDE5", borderColor: "#D9CDB8" }}
          >
            <div>
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "#1C1410" }}
              >
                Manage your subscription
              </p>
              <p className="text-sm" style={{ color: "#6B5D52" }}>
                Update payment method, view invoices, or cancel your plan.
              </p>
            </div>
            <Button
              variant="secondary"
              size="md"
              loading={portalLoading}
              onClick={() => void handlePortal()}
            >
              Open billing portal
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
