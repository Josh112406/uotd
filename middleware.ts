import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that require a logged-in session.
 * Add more here as we build them out.
 */
const PROTECTED_ROUTES = ["/pantry", "/suggest", "/search"];

export async function middleware(request: NextRequest) {
  try {
    // NOTE: Avoid calling Supabase createServerClient in Edge middleware.
    // It uses Node-only APIs and will cause MIDDLEWARE_INVOCATION_FAILED on Vercel.
    // Instead, check for auth cookies as a heuristic.
    
    const cookieList = request.cookies.getAll();
    const cookieNames = cookieList.map((c) => c.name.toLowerCase());

    // Supabase sets cookies like "sb-...", "sb_access_token", etc.
    const hasAuthCookie = cookieNames.some((name) =>
      /supabase|sb-|sb_access_token/.test(name)
    );

    const { pathname } = request.nextUrl;
    const isProtected = PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    // Not logged in + trying to access a protected route → redirect to /login
    if (!hasAuthCookie && isProtected) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Logged in + trying to access /login or /register → redirect home
    if (hasAuthCookie && (pathname === "/login" || pathname === "/register")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }

    return NextResponse.next();
  } catch (err) {
    // If anything fails in middleware, don't crash the request
    console.error("middleware error:", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - /auth/callback (Supabase needs this to be open)
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback).*)",
  ],
};
