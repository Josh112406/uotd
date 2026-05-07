"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

const NAV_LINKS = [
  { label: "Pantry",  href: "/pantry"  },
  { label: "Suggest", href: "/suggest" },
  { label: "Search",  href: "/search"  },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Derive display name: prefer full_name from metadata, fallback to email prefix
  const displayName = user
    ? (user.user_metadata?.full_name as string | undefined)
        ?? user.email?.split("@")[0]
        ?? "User"
    : null;

  const firstName = displayName?.split(" ")[0] ?? "User";

  async function handleLogout() {
    await logout();
    // Hard redirect so middleware re-reads the cleared session cookie
    window.location.href = "/";
  }

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <header className="sticky top-0 z-40 bg-brand-cream/95 backdrop-blur-sm border-b border-brand-rice shadow-sm">
      <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link
          href="/"
          className="font-display text-2xl font-bold text-brand-bark hover:text-brand-rust transition-colors"
          aria-label="UOTD — Home"
        >
          UOTD
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-1" role="list">
          {NAV_LINKS.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className={`
                  px-4 py-1.5 rounded-full font-body text-sm font-medium transition-all duration-150
                  ${isActive(href)
                    ? "bg-brand-rust text-white"
                    : "text-brand-smoke hover:text-brand-bark hover:bg-brand-rice"
                  }
                `}
                aria-current={isActive(href) ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-3">
          {!isLoading && (
            user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-body text-brand-smoke">
                  Hi, <strong className="text-brand-bark">{firstName}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-1.5 rounded-full border border-brand-rust text-brand-rust text-sm font-body font-medium hover:bg-brand-rust hover:text-white transition-all duration-150"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-full text-brand-rust border border-brand-rust text-sm font-body font-medium hover:bg-brand-rust hover:text-white transition-all duration-150"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-1.5 rounded-full bg-brand-rust text-white text-sm font-body font-semibold hover:bg-brand-silog active:scale-95 transition-all duration-150"
                >
                  Sign Up
                </Link>
              </div>
            )
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded-lg hover:bg-brand-rice transition"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Isara ang menu" : "Buksan ang menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <span className={`block w-5 h-0.5 bg-brand-bark rounded transition-all duration-200 origin-center ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block w-5 h-0.5 bg-brand-bark rounded transition-all duration-200 ${menuOpen ? "opacity-0 scale-x-0" : ""}`} />
          <span className={`block w-5 h-0.5 bg-brand-bark rounded transition-all duration-200 origin-center ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </nav>

      {/* Mobile dropdown */}
      <div
        id="mobile-menu"
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${menuOpen ? "max-h-96 border-t border-brand-rice" : "max-h-0"}`}
      >
        <ul className="px-4 py-3 space-y-1" role="list">
          {NAV_LINKS.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className={`
                  block px-4 py-2.5 rounded-lg font-body text-sm font-medium transition-all
                  ${isActive(href) ? "bg-brand-rust text-white" : "text-brand-bark hover:bg-brand-rice"}
                `}
                aria-current={isActive(href) ? "page" : undefined}
              >
                {label}
              </Link>
            </li>
          ))}

          {/* Mobile auth */}
          <li className="pt-2 border-t border-brand-rice mt-2">
            {!isLoading && (
              user ? (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm font-body text-brand-smoke">
                    Hi, <strong className="text-brand-bark">{firstName}</strong>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-body text-brand-rust font-medium underline underline-offset-2"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/login"
                    className="w-full py-2.5 text-center border border-brand-rust text-brand-rust font-body font-semibold text-sm rounded-lg hover:bg-brand-rust hover:text-white transition"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="w-full py-2.5 text-center bg-brand-rust text-white font-body font-semibold text-sm rounded-lg hover:bg-brand-silog transition"
                  >
                    Sign Up
                  </Link>
                </div>
              )
            )}
          </li>
        </ul>
      </div>
    </header>
  );
}
