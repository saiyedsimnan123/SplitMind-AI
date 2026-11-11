import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, isSupabaseAuthConfigured } from "@/lib/supabase/config";

const PUBLIC_PAGES = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);
const PUBLIC_API_PREFIX = "/api/auth/";

export function middleware(request: NextRequest) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith(PUBLIC_API_PREFIX)
  ) {
    return NextResponse.next();
  }

  const hasAuthCookie = Boolean(
    request.cookies.get(ACCESS_COOKIE)?.value || request.cookies.get(REFRESH_COOKIE)?.value,
  );

  if (pathname.startsWith("/api/")) {
    if (!hasAuthCookie) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (PUBLIC_PAGES.has(pathname)) {
    return NextResponse.next();
  }

  if (!hasAuthCookie) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
