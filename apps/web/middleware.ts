import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/scraper")) {
    return NextResponse.next();
  }

  const token = process.env.SCRAPER_ACCESS_TOKEN;

  // No token configured — allow in dev, block in prod
  if (!token) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Already authenticated via cookie
  const cookieToken = request.cookies.get("scraper_token")?.value;
  if (cookieToken === token) return NextResponse.next();

  // Token passed as query param — set cookie and redirect clean URL
  const queryToken = request.nextUrl.searchParams.get("token");
  if (queryToken === token) {
    const response = NextResponse.redirect(new URL(request.nextUrl.pathname, request.url));
    response.cookies.set("scraper_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400, // 24 hours
    });
    return response;
  }

  // No valid token — redirect to home
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/scraper/:path*"],
};
