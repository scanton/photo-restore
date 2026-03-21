import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  // Protect /admin/* routes
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

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
