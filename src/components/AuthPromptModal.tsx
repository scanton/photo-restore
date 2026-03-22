"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

interface AuthPromptModalProps {
  /** Whether the modal is visible. Controlled by the server via searchParams. */
  showModal: boolean;
}

/**
 * AuthPromptModal — appears when an unauthenticated user tries to access a
 * protected route (e.g. /restore/[id], /account). The middleware redirects
 * them to /?authPrompt=true, which causes the server to pass showModal=true.
 *
 * On dismiss, replaces the URL to remove ?authPrompt=true — no reload.
 * Focus is trapped inside the modal while open (basic implementation).
 * Esc key closes the modal.
 */
export function AuthPromptModal({ showModal }: AuthPromptModalProps) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the close button when the modal opens
  useEffect(() => {
    if (showModal) {
      closeButtonRef.current?.focus();
    }
  }, [showModal]);

  // Esc key handler
  useEffect(() => {
    if (!showModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  const handleClose = () => {
    router.replace("/", { scroll: false });
  };

  const handleSignIn = () => {
    void signIn("google", { callbackUrl: "/" });
  };

  if (!showModal) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(28, 20, 16, 0.6)" }}
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="auth-modal-title"
    >
      {/* Modal container — stop click propagation so backdrop click only fires on backdrop */}
      <div
        className="relative w-full max-w-[400px] rounded-[16px] p-8 shadow-2xl"
        style={{ backgroundColor: "#FAF7F2" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Film grain texture overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[16px] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
            mixBlendMode: "multiply",
            opacity: 0.5,
          }}
        />

        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-[8px] transition-colors duration-150"
          style={{ color: "#8A7A6E" }}
          aria-label="Close"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#EDE5D8";
            (e.currentTarget as HTMLElement).style.color = "#4A3F35";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "#8A7A6E";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#E8C5A8" }}
        >
          <svg
            width="28"
            height="28"
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

        {/* Copy */}
        <h2
          id="auth-modal-title"
          className="text-xl font-light text-center mb-2"
          style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#1C1410" }}
        >
          Sign in to restore your photo
        </h2>
        <p className="text-sm text-center mb-8" style={{ color: "#6B5D52" }}>
          Create a free account to restore, download, and preserve your family photos.
          You&rsquo;ll get 2 free credits just for signing up.
        </p>

        {/* Google sign-in button */}
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-[8px] border text-sm font-semibold transition-all duration-200"
          style={{
            backgroundColor: "#FAF7F2",
            borderColor: "#D9CDB8",
            color: "#1C1410",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#F2EDE5";
            (e.currentTarget as HTMLElement).style.borderColor = "#B5622A";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "#FAF7F2";
            (e.currentTarget as HTMLElement).style.borderColor = "#D9CDB8";
          }}
        >
          {/* Google logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Free credits callout */}
        {/* #6B5D52 on modal bg = 5.8:1 — WCAG AA */}
        <p className="mt-4 text-xs text-center" style={{ color: "#6B5D52" }}>
          Free forever to try. 2 credits included on sign-up.
        </p>
      </div>
    </div>
  );
}
