"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonBaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Renders as a Next.js <Link> */
interface ButtonAsLinkProps extends ButtonBaseProps {
  asLink: true;
  href: string;
  onClick?: never;
  disabled?: never;
}

/** Renders as a <button> */
interface ButtonAsButtonProps extends ButtonBaseProps, ButtonHTMLAttributes<HTMLButtonElement> {
  asLink?: false;
  href?: never;
}

type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps;

const variantClasses: Record<Variant, string> = {
  primary:
    // #9B5424 on #FAF7F2 = 5.3:1 — WCAG AA. Hover lightens to brand cognac #B5622A.
    "bg-[#9B5424] text-[#FAF7F2] hover:bg-[#B5622A] active:bg-[#8A4520] border-transparent",
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

const Spinner = ({ size }: { size: Size }) => (
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
);

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    children,
    className,
    asLink,
    ...rest
  } = props;

  const baseClasses = twMerge(
    clsx(
      "inline-flex items-center justify-center font-semibold border",
      "transition-colors duration-[200ms]",
      "focus-visible:outline-2 focus-visible:outline-[#B5622A] focus-visible:outline-offset-2",
      variantClasses[variant],
      sizeClasses[size],
      className
    )
  );

  if (asLink) {
    const { href } = props as ButtonAsLinkProps;
    return (
      <Link href={href} className={baseClasses}>
        {children}
      </Link>
    );
  }

  const { disabled, onClick, ...buttonRest } = rest as ButtonAsButtonProps;
  const isDisabled = disabled || loading;

  return (
    <button
      {...buttonRest}
      disabled={isDisabled}
      onClick={onClick}
      className={twMerge(
        baseClasses,
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
      )}
    >
      {loading && <Spinner size={size} />}
      {children}
    </button>
  );
}
