import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Routes that require a logged-in session.
 * Add more here as we build them out.
 */
const PROTECTED_ROUTES = ["/pantry", "/suggest", "/search"];

export async function middleware(request: NextRequest) {
  // Default response; may be replaced if we need to set cookies
  let supabaseResponse = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Must set cookies on both request and response to keep session fresh
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next();
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // IMPORTANT: Do not add logic between createServerClient and getUser().
    // A simple mistake here can cause hard-to-debug session issues.
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    return supabaseResponse;
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
