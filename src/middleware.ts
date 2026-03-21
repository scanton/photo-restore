import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  // Protect /admin/* routes — require admin role
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

  // Protect page routes that require auth.
  //
  // /restore/[id] — user must be signed in to view their restoration
  // /account      — profile page requires auth
  //
  // Note: API routes under these paths handle their own auth and return
  // JSON 401 responses (not redirects), so they are NOT included in this
  // matcher. The matcher below is scoped to page routes only.
  const protectedPageRoutes = ["/restore", "/account"];

  if (protectedPageRoutes.some((route) => pathname.startsWith(route))) {
    const session = req.auth;
    if (!session || !session.user) {
      // Redirect to the home page with a modal prompt
      const redirectUrl = new URL("/", req.url);
      redirectUrl.searchParams.set("authPrompt", "true");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    // Page routes that require auth — excludes API routes intentionally
    "/restore/:path*",
    "/account/:path*",
  ],
};
