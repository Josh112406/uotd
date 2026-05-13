"use client";

import { useState, FormEvent, Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function friendlyError(message: string): string {
  if (message.includes("Invalid login credentials"))
    return "Invalid email or password. Please try again.";
  if (message.includes("Email not confirmed"))
    return "Your email is not confirmed. Please check your inbox.";
  if (message.includes("Too many requests"))
    return "Too many attempts. Please wait a few minutes.";
  if (message.includes("Invalid path"))
    return "Configuration problem. Check Supabase Redirect URLs.";
  return message;
}

function LoginForm() {
  const searchParams = useSearchParams();
  // Sanitize the `next` param — only allow internal paths (start with /)
  // to prevent open redirect attacks
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const justRegistered = searchParams.get("registered") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check environment variables immediately
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      setError("Supabase environment variables not found. Check Vercel settings.");
    }
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);

    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setError(friendlyError(error.message));
        setIsLoading(false);
        return;
      }

      window.location.href = next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(friendlyError(message));
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <Link href="/" className="font-display text-3xl font-bold text-brand-rust">
          UOTD
        </Link>
        <h1 className="font-display text-2xl font-bold text-brand-bark mt-4">
          Login
        </h1>
        <p className="font-body text-sm text-brand-smoke mt-1">
          Don&apos;t stress about meals — let&apos;s go.
        </p>
      </div>

      {justRegistered && (
        <div className="mb-5 px-4 py-3 bg-brand-leaf/10 border border-brand-leaf/30 rounded-lg">
          <p className="text-sm font-body text-brand-leaf font-medium">
            ✅ Registered! Please login.
          </p>
        </div>
      )}

      <div className="bg-brand-garlic border border-brand-rice rounded-2xl p-6 shadow-sm">
        {/* Google — disabled, coming soon */}
        <button
          type="button"
          disabled
          title="Google sign-in — coming soon"
          className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-brand-rice bg-brand-rice/50 text-brand-smoke/60 font-body text-sm font-medium cursor-not-allowed mb-5"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Login with Google
          <span className="ml-auto text-xs bg-brand-smoke/20 text-brand-smoke px-2 py-0.5 rounded-full">
            Soon
          </span>
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-brand-rice" />
          <span className="text-xs font-body text-brand-smoke/60">or</span>
          <div className="flex-1 h-px bg-brand-rice" />
        </div>

        <form onSubmit={handleLogin} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-body font-semibold text-brand-bark mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@example.com"
              autoComplete="email"
              className="w-full px-4 py-2.5 rounded-lg border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:border-brand-rust focus:outline-none transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-body font-semibold text-brand-bark">
                Password
              </label>
              <span className="text-xs font-body text-brand-smoke/50 select-none">
                Forgot password? (coming soon)
              </span>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:border-brand-rust focus:outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-smoke hover:text-brand-bark transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm font-body text-brand-rust font-medium">
              ⚠ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-brand-rust hover:bg-brand-silog disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 text-white font-body font-semibold text-sm rounded-lg transition-all duration-150 mt-1"
          >
            {isLoading ? "Loading..." : "Enter →"}
          </button>
        </form>
      </div>

      <p className="text-center text-sm font-body text-brand-smoke mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-brand-rust font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <Suspense fallback={
        <div className="text-brand-smoke font-body text-sm animate-pulse">
          Loading...
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
