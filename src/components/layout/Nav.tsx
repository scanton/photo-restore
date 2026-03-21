"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

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
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isLow = creditBalance !== null && creditBalance !== undefined && creditBalance <= 1;
  const isZero = creditBalance !== null && creditBalance !== undefined && creditBalance === 0;

  // Credit pill colour tokens
  const pillBg = isZero
    ? "#FCEAEA"
    : isLow
    ? "#FDF3E7"
    : "#E8C5A8";
  // Text colors chosen for ≥4.5:1 contrast against each pill background (WCAG AA).
  // normal: #6B3B14 on #E8C5A8 = 5.0:1; low: #8B5A1E on #FDF3E7 = 5.3:1; zero: #B83B3B on #FCEAEA = 4.6:1
  const pillText = isZero
    ? "#B83B3B"
    : isLow
    ? "#8B5A1E"
    : "#6B3B14";
  const pillBorder = isZero
    ? "#B83B3B"
    : isLow
    ? "#C17A2A"
    : "transparent";

  // Close avatar dropdown on click-outside (mousedown fires before blur)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!avatarRef.current?.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on click-outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!mobileMenuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  /** Initials from user's display name or email */
  const getInitials = () => {
    const name = session?.user?.name;
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    const email = session?.user?.email;
    if (email) return email[0].toUpperCase();
    return "?";
  };

  const showAvatar = !!session?.user?.image && !imgError;

  /** Avatar circle — photo or initials fallback */
  const AvatarCircle = ({ size = 32 }: { size?: number }) => (
    <div
      className="relative shrink-0 rounded-full overflow-hidden flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: "#9B5424", // #FAF7F2 on #9B5424 = 5.3:1 — WCAG AA
        color: "#FAF7F2",
        fontSize: size * 0.375,
        fontWeight: 600,
        fontFamily: "var(--font-jakarta), system-ui, sans-serif",
        cursor: "pointer",
      }}
    >
      {showAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session!.user!.image!}
          alt={session?.user?.name ?? "Your avatar"}
          width={size}
          height={size}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span aria-hidden="true">{getInitials()}</span>
      )}
    </div>
  );

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
          <NavLink href="/#how-it-works">How it works</NavLink>

          {session?.user ? (
            <>
              <NavLink href="/studio">Studio</NavLink>

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

              {/* Avatar dropdown */}
              <div ref={avatarRef} className="relative">
                <button
                  aria-label="Account menu"
                  aria-expanded={avatarOpen}
                  aria-haspopup="true"
                  onClick={() => setAvatarOpen((o) => !o)}
                  className="flex items-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ outlineColor: "#B5622A" }}
                >
                  <AvatarCircle size={34} />
                </button>

                {avatarOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-44 rounded-[10px] border shadow-md py-1 z-50"
                    style={{
                      backgroundColor: "#FAF7F2",
                      borderColor: "#D9CDB8",
                      boxShadow: "0 4px 20px rgba(28,20,16,0.12)",
                    }}
                  >
                    <Link
                      href="/account"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm font-medium transition-colors"
                      style={{ color: "#1C1410" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F2EDE5")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                      onClick={() => setAvatarOpen(false)}
                    >
                      My Account
                    </Link>
                    <Link
                      href="/studio"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm font-medium transition-colors"
                      style={{ color: "#1C1410" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F2EDE5")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                      onClick={() => setAvatarOpen(false)}
                    >
                      Studio
                    </Link>
                    <div className="my-1 border-t" style={{ borderColor: "#EDE5D8" }} />
                    <button
                      role="menuitem"
                      onClick={() => { setAvatarOpen(false); signOut({ callbackUrl: "/" }); }}
                      className="block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors"
                      style={{ color: "#6B5D52" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F2EDE5")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* #9B5424 on #FAF7F2 = 5.3:1 — WCAG AA; hover lightens to brand cognac */
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="px-4 py-2 rounded-[8px] text-sm font-semibold transition-colors duration-200"
              style={{ backgroundColor: "#9B5424", color: "#FAF7F2" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = "#B5622A")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = "#9B5424")}
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
          ref={mobileMenuRef}
          className="md:hidden border-t px-6 py-4 flex flex-col gap-4"
          style={{ borderColor: "#EDE5D8", backgroundColor: "#FAF7F2" }}
          role="dialog"
          aria-label="Navigation menu"
        >
          {/* Mobile drawer header — avatar or sign-in */}
          {session?.user && (
            <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: "#EDE5D8" }}>
              <AvatarCircle size={36} />
              <div className="flex flex-col min-w-0">
                {session.user.name && (
                  <span className="text-sm font-semibold truncate" style={{ color: "#1C1410" }}>
                    {session.user.name}
                  </span>
                )}
                {session.user.email && (
                  <span className="text-xs truncate" style={{ color: "#6B5D52" }}>
                    {session.user.email}
                  </span>
                )}
              </div>
            </div>
          )}

          <MobileNavLink href="/billing" onClick={() => setMenuOpen(false)}>Pricing</MobileNavLink>
          <MobileNavLink href="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</MobileNavLink>

          {session?.user ? (
            <>
              <MobileNavLink href="/studio" onClick={() => setMenuOpen(false)}>Studio</MobileNavLink>
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
                style={{ color: "#6B5D52" }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => { setMenuOpen(false); signIn("google", { callbackUrl: "/" }); }}
              className="w-full px-4 py-3 rounded-[8px] text-sm font-semibold text-center"
              style={{ backgroundColor: "#9B5424", color: "#FAF7F2" }}
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
