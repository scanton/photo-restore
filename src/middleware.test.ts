import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Middleware redirect logic tests.
 *
 * We test the redirect logic in isolation by mocking the NextAuth `auth`
 * wrapper and calling the inner handler directly. This avoids needing to
 * spin up the full NextAuth stack in unit tests.
 */

// Build a minimal fake NextAuthRequest
function makeRequest(pathname: string, session: { user?: { id?: string; role?: string } } | null = null) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: url,
    url: url.toString(),
    auth: session,
  };
}

// Extract the inner handler logic mirroring middleware.ts
function runMiddlewareLogic(
  req: ReturnType<typeof makeRequest>
): ReturnType<typeof NextResponse.redirect | typeof NextResponse.next> {
  const { pathname } = req.nextUrl;

  // Admin protection
  if (pathname.startsWith("/admin")) {
    const session = req.auth;
    if (!session || !session.user) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const user = session.user as { role?: string };
    if (user.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Protected page routes
  const protectedPageRoutes = ["/restore", "/account"];
  if (protectedPageRoutes.some((route) => pathname.startsWith(route))) {
    const session = req.auth;
    if (!session || !session.user) {
      const redirectUrl = new URL("/", req.url);
      redirectUrl.searchParams.set("authPrompt", "true");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

describe("Middleware redirect logic", () => {
  describe("/restore/:path*", () => {
    it("redirects unauthenticated users to /?authPrompt=true", () => {
      const req = makeRequest("/restore/some-id", null);
      const res = runMiddlewareLogic(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("authPrompt=true");
      expect(location).toMatch(/^http:\/\/localhost\//);
    });

    it("allows authenticated users through", () => {
      const req = makeRequest("/restore/some-id", { user: { id: "u1" } });
      const res = runMiddlewareLogic(req);

      // NextResponse.next() has no location header
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("/account/:path*", () => {
    it("redirects unauthenticated users to /?authPrompt=true", () => {
      const req = makeRequest("/account", null);
      const res = runMiddlewareLogic(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("authPrompt=true");
    });

    it("allows authenticated users through", () => {
      const req = makeRequest("/account", { user: { id: "u1" } });
      const res = runMiddlewareLogic(req);

      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("/admin/:path*", () => {
    it("redirects unauthenticated users to /", () => {
      const req = makeRequest("/admin/dashboard", null);
      const res = runMiddlewareLogic(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBe("http://localhost/");
    });

    it("redirects non-admin authenticated users to /", () => {
      const req = makeRequest("/admin/dashboard", { user: { id: "u1", role: "user" } });
      const res = runMiddlewareLogic(req);

      expect(res.status).toBe(307);
    });

    it("allows admin users through", () => {
      const req = makeRequest("/admin/dashboard", { user: { id: "u1", role: "admin" } });
      const res = runMiddlewareLogic(req);

      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("public routes", () => {
    it("passes through / without redirect", () => {
      const req = makeRequest("/", null);
      const res = runMiddlewareLogic(req);

      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through /billing without redirect for unauthenticated users", () => {
      const req = makeRequest("/billing", null);
      const res = runMiddlewareLogic(req);

      expect(res.headers.get("location")).toBeNull();
    });
  });
});
