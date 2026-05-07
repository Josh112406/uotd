"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function friendlyError(message: string): string {
  if (message.includes("User already registered"))
    return "May account ka na gamit ang email na ito. Mag-login na lang.";
  if (message.includes("Password should be at least"))
    return "Ang password ay dapat hindi bababa sa 6 na character.";
  if (message.includes("Unable to validate email"))
    return "Hindi valid ang email address na ito.";
  if (message.includes("Too many requests"))
    return "Sobrang daming pagsubok. Maghintay muna ng ilang minuto.";
  return message;
}

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
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
  );

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) { setError("Pakiusap, ilagay ang iyong pangalan."); return; }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Pakiusap, ilagay ang tamang email address."); return;
    }
    if (password.length < 6) { setError("Ang password ay dapat hindi bababa sa 6 na character."); return; }
    if (password !== confirmPassword) { setError("Hindi magkatugma ang mga password. Subukan ulit."); return; }

    setIsLoading(true);

    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
          // Only used when email confirmation is ON — safe to keep
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(friendlyError(error.message));
        setIsLoading(false);
        return;
      }

      // If email confirmation is OFF (local dev), Supabase returns a session immediately.
      // In that case, go straight home. Otherwise send to login with a message.
      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        router.push("/login?registered=true");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error during registration";
      console.error("Registration error:", message);
      setError(friendlyError(message));
      setIsLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-display text-3xl font-bold text-brand-rust">
            UOTD
          </Link>
          <h1 className="font-display text-2xl font-bold text-brand-bark mt-4">
            Gumawa ng Account
          </h1>
          <p className="font-body text-sm text-brand-smoke mt-1">
            Libre. Madali. Para sa pagkain.
          </p>
        </div>

        <div className="bg-brand-garlic border border-brand-rice rounded-2xl p-6 shadow-sm">
          {/* Google — disabled */}
          <button
            type="button"
            disabled
            title="Google sign-up — coming soon"
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-brand-rice bg-brand-rice/50 text-brand-smoke/60 font-body text-sm font-medium cursor-not-allowed mb-5"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Mag-sign up sa Google
            <span className="ml-auto text-xs bg-brand-smoke/20 text-brand-smoke px-2 py-0.5 rounded-full">Soon</span>
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-brand-rice" />
            <span className="text-xs font-body text-brand-smoke/60">o kaya</span>
            <div className="flex-1 h-px bg-brand-rice" />
          </div>

          <form onSubmit={handleRegister} noValidate className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-body font-semibold text-brand-bark mb-1">
                Buong Pangalan
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan dela Cruz"
                autoComplete="name"
                className="w-full px-4 py-2.5 rounded-lg border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:border-brand-rust focus:outline-none transition"
              />
            </div>

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
              <label htmlFor="password" className="block text-sm font-body font-semibold text-brand-bark mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 pr-11 rounded-lg border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:border-brand-rust focus:outline-none transition"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-smoke hover:text-brand-bark transition"
                  aria-label={showPassword ? "Itago" : "Ipakita"}>
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              <p className="text-xs text-brand-smoke/60 font-body mt-1">Hindi bababa sa 6 na character</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-body font-semibold text-brand-bark mb-1">
                Ulitin ang Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={`w-full px-4 py-2.5 pr-11 rounded-lg border bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:outline-none transition
                    ${confirmPassword && confirmPassword !== password ? "border-brand-rust" :
                      confirmPassword && confirmPassword === password ? "border-brand-leaf" :
                      "border-brand-smoke/30 focus:border-brand-rust"}`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-smoke hover:text-brand-bark transition"
                  aria-label={showConfirm ? "Itago" : "Ipakita"}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
              {confirmPassword && (
                <p className={`text-xs font-body mt-1 ${confirmPassword === password ? "text-brand-leaf" : "text-brand-rust"}`}>
                  {confirmPassword === password ? "✓ Magkatugma ang password" : "✗ Hindi magkatugma"}
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm font-body text-brand-rust font-medium">⚠ {error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-brand-rust hover:bg-brand-silog disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 text-white font-body font-semibold text-sm rounded-lg transition-all duration-150 mt-1"
            >
              {isLoading ? "Ginagawa ang account…" : "Gumawa ng Account →"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm font-body text-brand-smoke mt-6">
          May account ka na?{" "}
          <Link href="/login" className="text-brand-rust font-semibold hover:underline">Mag-login</Link>
        </p>
      </div>
    </div>
  );
}
