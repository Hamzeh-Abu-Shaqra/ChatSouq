import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protect the /scraper admin dashboard.
 *
 * Set SCRAPER_ACCESS_TOKEN in your env to enable protection.
 * Access by visiting /scraper?token=<your-token> (sets a session cookie)
 * or by having the scraper_token cookie already set.
 *
 * In development (NODE_ENV !== "production") with no token configured,
 * the route is accessible without a token.
 */
export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/scraper")) {
    return NextResponse.next();
  }

  const token = process.env.SCRAPER_ACCESS_TOKEN;

  // Development with no token configured — allow through
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      // Block in production if token is not configured at all
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Check cookie first
  const cookieToken = request.cookies.get("scraper_token")?.value;
  if (cookieToken === token) {
    return NextResponse.next();
  }

  // Check query param — and set the cookie on success
  const queryToken = request.nextUrl.searchParams.get("token");
  if (queryToken === token) {
    const response = NextResponse.redirect(
      new URL(request.nextUrl.pathname, request.url)
    );
    response.cookies.set("scraper_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
    });
    return response;
  }

  // No valid token — redirect to home
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/scraper/:path*"],
};
