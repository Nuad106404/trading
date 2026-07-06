import { NextResponse, type NextRequest } from "next/server";

/**
 * Route protection based on lightweight cookies set at login.
 * These cookies only steer navigation — every API call is still
 * authorized server-side via JWT + role guards.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = request.cookies.get("um_auth")?.value === "1";
  const role = request.cookies.get("um_role")?.value;

  const isAdminRoute = pathname.startsWith("/admin");
  const isProfileRoute = pathname.startsWith("/profile") || pathname.startsWith("/trading");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if ((isAdminRoute || isProfileRoute) && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && authed && role === "user") {
    const url = request.nextUrl.clone();
    url.pathname = "/profile";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthPage && authed) {
    const url = request.nextUrl.clone();
    url.pathname = role === "user" ? "/profile" : "/admin/users";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*", "/trading/:path*", "/login", "/register"],
};
