"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#B5622A] text-[#FAF7F2] hover:bg-[#D4874E] active:bg-[#8A4520] border-transparent",
  secondary:
    "bg-[#F2EDE5] text-[#1C1410] hover:bg-[#E8E0D4] active:bg-[#DDD3C3] border-[#D4C9BB]",
  ghost:
    "bg-transparent text-[#1C1410] hover:bg-[#F2EDE5] active:bg-[#E8E0D4] border-transparent",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-[8px]",
  md: "h-10 px-4 text-sm gap-2 rounded-[8px]",
  lg: "h-12 px-6 text-base gap-2.5 rounded-[8px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={twMerge(
        clsx(
          "inline-flex items-center justify-center font-semibold border",
          "transition-colors duration-[200ms]",
          "focus-visible:outline-2 focus-visible:outline-[#B5622A] focus-visible:outline-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )
      )}
    >
      {loading && (
        <svg
          className="animate-spin shrink-0"
          width={size === "sm" ? 14 : 16}
          height={size === "sm" ? 14 : 16}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="2"
          />
          <path
            d="M14 8a6 6 0 0 0-6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
