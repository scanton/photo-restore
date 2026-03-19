"use client";

import { useEffect, useState } from "react";

interface CreditBalanceProps {
  className?: string;
}

export function CreditBalance({ className }: CreditBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch("/api/credits/balance");
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json() as { balance: number };
        setBalance(data.balance);
      } catch {
        setError(true);
      }
    }

    void fetchBalance();
  }, []);

  if (error) return null;

  return (
    <div
      className={className}
      style={{ fontFamily: "var(--font-mono), ui-monospace, monospace", fontVariantNumeric: "tabular-nums" }}
    >
      {balance === null ? (
        <span className="inline-block w-8 h-4 rounded-[4px] bg-[#E8E0D4] animate-pulse" />
      ) : (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[9999px] text-sm font-medium"
          style={{ backgroundColor: "#E8C5A8", color: "#8A4520" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="6" fill="#B5622A" />
            <text
              x="7"
              y="10.5"
              textAnchor="middle"
              fontSize="8"
              fontWeight="700"
              fill="#FAF7F2"
              fontFamily="ui-monospace"
            >
              C
            </text>
          </svg>
          {balance.toLocaleString()}
        </span>
      )}
    </div>
  );
}
