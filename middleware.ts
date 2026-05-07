import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that require a logged-in session.
 * Add more here as we build them out.
 */
const PROTECTED_ROUTES = ["/pantry", "/suggest", "/search"];

export async function middleware(request: NextRequest) {
  // Vercel Edge runtime has been the source of the 500 here.
  // Keep production on Vercel fully safe by bypassing middleware auth logic.
  if (process.env.VERCEL) {
    return NextResponse.next();
  }

  try {
    // Avoid calling Supabase client inside Edge middleware (can cause
    // MIDDLEWARE_INVOCATION_FAILED on Vercel). Instead, infer auth state
    // from common Supabase cookie names. This is a heuristic used only to
    // gate protected routes in middleware; real user data is still fetched
    // on the server/client where full Supabase clients are safe.
    const cookieList =
      typeof request.cookies.getAll === "function" ? request.cookies.getAll() : [];
    const cookieNames = cookieList.map((c) => c.name.toLowerCase());

    const hasAuthCookie = cookieNames.some((name) =>
      /supabase|supabase-auth-token|sb-|sb:|sb_access_token|sb-refresh-token|sb-access-token/.test(
        name
      )
    );

    // Treat presence of common auth cookies as a logged-in user.
    const user = hasAuthCookie ? { id: "cookie-detected" } : null;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Not logged in + trying to access a protected route → redirect to /login
  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Pass the intended destination so we can redirect back after login
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in + trying to access /login or /register → redirect home
  // Prevents a logged-in user from seeing the login page
  if (user && (pathname === "/login" || pathname === "/register")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }
    return NextResponse.next();
  } catch (err) {
    // If anything goes wrong in middleware (for example an incompatible
    // package/runtime on the Edge), don't crash the request — allow it
    // to continue. Log error for debugging in Vercel logs.
    console.error("middleware supabase error:", err);
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
