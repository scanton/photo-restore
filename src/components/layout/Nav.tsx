"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useState } from "react";

interface NavSession {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface NavProps {
  session: NavSession | null;
  creditBalance?: number | null;
}

/**
 * Shared marketing nav — used on landing page, billing page, and anywhere
 * else that needs the top nav outside the app shell.
 *
 * Auth state is passed as a prop (read server-side by the parent) so this
 * component stays lean and avoids an extra client-side auth fetch.
 */
export function Nav({ session, creditBalance }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isLow = creditBalance !== null && creditBalance !== undefined && creditBalance <= 1;
  const isZero = creditBalance !== null && creditBalance !== undefined && creditBalance === 0;

  // Credit pill colour tokens
  const pillBg = isZero
    ? "#FCEAEA"
    : isLow
    ? "#FDF3E7"
    : "#E8C5A8";
  const pillText = isZero
    ? "#B83B3B"
    : isLow
    ? "#C17A2A"
    : "#8A4520";
  const pillBorder = isZero
    ? "#B83B3B"
    : isLow
    ? "#C17A2A"
    : "transparent";

  return (
    <header
      className="w-full border-b sticky top-0 z-40"
      style={{ borderColor: "#EDE5D8", backgroundColor: "#FAF7F2" }}
    >
      <div className="mx-auto max-w-[1140px] px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-bold shrink-0"
          style={{ fontFamily: "var(--font-fraunces), Georgia, serif", color: "#1C1410" }}
        >
          PicRenew
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          <NavLink href="/billing">Pricing</NavLink>
          <NavLink href="#how-it-works">How it works</NavLink>

          {session?.user ? (
            <>
              <NavLink href="/account">My Account</NavLink>

              {/* Credit balance pill */}
              {creditBalance !== null && creditBalance !== undefined && (
                <Link
                  href="/billing"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    backgroundColor: pillBg,
                    color: pillText,
                    border: `1px solid ${pillBorder}`,
                  }}
                  aria-label={`${creditBalance} credit${creditBalance === 1 ? "" : "s"} remaining`}
                >
                  <span>{creditBalance}</span>
                  <span style={{ opacity: 0.7 }}>cr</span>
                </Link>
              )}

              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm font-medium transition-colors duration-150"
                style={{ color: "#8A7A6E" }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#4A3F35")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#8A7A6E")}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="px-4 py-2 rounded-[8px] text-sm font-semibold transition-colors duration-200"
              style={{ backgroundColor: "#B5622A", color: "#FAF7F2" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = "#D4874E")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "#B5622A")}
            >
              Sign in
            </button>
          )}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-11 h-11 gap-1.5 rounded-[8px] transition-colors duration-150"
          style={{ color: "#4A3F35" }}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span
            className="block w-5 h-0.5 transition-all duration-200"
            style={{
              backgroundColor: "#4A3F35",
              transform: menuOpen ? "translateY(8px) rotate(45deg)" : "none",
            }}
          />
          <span
            className="block w-5 h-0.5 transition-all duration-200"
            style={{
              backgroundColor: "#4A3F35",
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            className="block w-5 h-0.5 transition-all duration-200"
            style={{
              backgroundColor: "#4A3F35",
              transform: menuOpen ? "translateY(-8px) rotate(-45deg)" : "none",
            }}
          />
        </button>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div
          className="md:hidden border-t px-6 py-4 flex flex-col gap-4"
          style={{ borderColor: "#EDE5D8", backgroundColor: "#FAF7F2" }}
        >
          <MobileNavLink href="/billing" onClick={() => setMenuOpen(false)}>Pricing</MobileNavLink>
          <MobileNavLink href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</MobileNavLink>

          {session?.user ? (
            <>
              <MobileNavLink href="/account" onClick={() => setMenuOpen(false)}>My Account</MobileNavLink>
              {creditBalance !== null && creditBalance !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "#6B5D52" }}>Credits:</span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      fontFamily: "var(--font-mono), monospace",
                      backgroundColor: pillBg,
                      color: pillText,
                    }}
                  >
                    {creditBalance}
                  </span>
                </div>
              )}
              <button
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                className="text-sm font-medium text-left"
                style={{ color: "#8A7A6E" }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => { setMenuOpen(false); signIn("google", { callbackUrl: "/" }); }}
              className="w-full px-4 py-3 rounded-[8px] text-sm font-semibold text-center"
              style={{ backgroundColor: "#B5622A", color: "#FAF7F2" }}
            >
              Sign in
            </button>
          )}
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium transition-colors duration-150"
      style={{ color: "#6B5D52" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1C1410")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#6B5D52")}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      href={href}
      className="text-base font-medium"
      style={{ color: "#4A3F35" }}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
