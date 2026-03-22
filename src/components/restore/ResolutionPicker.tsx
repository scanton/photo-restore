"use client";

/**
 * ResolutionPicker — shared resolution selector for the restore page.
 *
 * Used in both `isReady` (pre-start) and `pending_payment` (post-preview) states.
 * Options are dimmed and non-interactive when the user has insufficient credits.
 *
 * Props:
 *   resolution      — currently selected resolution value
 *   setResolution   — setter called when user picks a different option
 *   balance         — credit balance (null = not yet loaded; options are all enabled)
 */

export type Resolution = "1k" | "2k" | "4k";

export const RESOLUTION_OPTIONS: {
  value: Resolution;
  label: string;
  credits: number;
  description: string;
}[] = [
  { value: "1k", label: "Standard", credits: 1, description: "1K · great for sharing" },
  { value: "2k", label: "High Res", credits: 2, description: "2K · ideal for printing" },
  { value: "4k", label: "Museum",   credits: 3, description: "4K · archival quality" },
];

interface ResolutionPickerProps {
  resolution: Resolution;
  setResolution: (r: Resolution) => void;
  /** Null while balance is loading — all options appear enabled. */
  balance: number | null;
}

export function ResolutionPicker({
  resolution,
  setResolution,
  balance,
}: ResolutionPickerProps) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Output resolution">
      {RESOLUTION_OPTIONS.map((opt) => {
        const isSelected = resolution === opt.value;
        const isDisabled = balance !== null && balance < opt.credits;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (!isDisabled) setResolution(opt.value);
            }}
            disabled={isDisabled}
            aria-pressed={isSelected}
            className="flex items-center justify-between px-4 py-3 rounded-[8px] border text-left transition-colors"
            style={{
              backgroundColor: isSelected ? "#E8C5A8" : "#E8E0D4",
              borderColor: isSelected ? "#B5622A" : "transparent",
              opacity: isDisabled ? 0.45 : 1,
              cursor: isDisabled ? "not-allowed" : "pointer",
            }}
          >
            <div>
              <span
                className="text-sm font-semibold block"
                style={{ color: "#1C1410" }}
              >
                {opt.label}
              </span>
              <span className="text-xs" style={{ color: "#6B5D52" }}>
                {opt.description}
                {isDisabled ? " — not enough credits" : ""}
              </span>
            </div>
            <span
              className="text-sm font-medium shrink-0 ml-3"
              style={{
                fontFamily: "var(--font-mono), monospace",
                color: "#9B5424",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {opt.credits} cr
            </span>
          </button>
        );
      })}
    </div>
  );
}
