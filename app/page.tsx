"use client";

import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";

const FEATURES = [
  {
    emoji: "🍳",
    title: "I-Generate",
    subtitle: "Gamit ang pantry mo",
    description:
      "Ilagay ang mga sangkap sa bahay mo — bibigyan ka namin ng mga pwedeng ulam na luto ngayon.",
    href: "/suggest",
    cta: "Try it",
  },
  {
    emoji: "📅",
    title: "Mag-Plan",
    subtitle: "Para sa buong linggo",
    description:
      "Planuhin ang iyong menu para sa isang linggo. Makatipid ng pera, oras, at utak sa palengke.",
    href: "/suggest",
    cta: "Get Started",
  },
  {
    emoji: "🔍",
    title: "Maghanap",
    subtitle: "Recipe at ingredients",
    description:
      "Hanapin ang recipe ng paboritong ulam, o alamin kung anong kailangan mong bilhin.",
    href: "/search",
    cta: "Search",
  },
];

export default function HomePage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="flex flex-col">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 py-20 md:py-28 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 40%, #E07B3A18 0%, transparent 70%)",
          }}
        />

        <p className="relative z-10 text-xs font-body font-semibold tracking-widest text-brand-rust uppercase mb-4 animate-fade-in">
          🇵🇭 &nbsp;Filipino Meal Planner
        </p>

        <div className="relative z-10 animate-slide-up">
          {/* Avoid flash: only personalise once localStorage is read */}
          {!isLoading && user ? (
            <>
              <h1 className="font-display text-4xl md:text-6xl font-bold text-brand-bark leading-tight mb-2">
                Kamusta,{" "}
                <span className="text-brand-rust">{(user.user_metadata?.full_name ?? user.email ?? "ka").split(" ")[0]}</span>!
              </h1>
              <p className="font-body text-lg md:text-xl text-brand-smoke mt-3 max-w-md mx-auto">
                Anong ulam mo ngayon?
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl md:text-6xl font-bold text-brand-bark leading-tight">
                Anong ulam{" "}
                <span className="text-brand-rust italic">ngayon?</span>
              </h1>
              <p className="font-body text-lg md:text-xl text-brand-smoke mt-4 max-w-md mx-auto">
                Huwag nang mag-isip pa. UOTD ang bahala sa menu mo.
              </p>
            </>
          )}
        </div>

        <div
          className="relative z-10 flex flex-col sm:flex-row gap-3 mt-8 animate-slide-up"
          style={{ animationDelay: "0.15s", animationFillMode: "both" }}
        >
          <Link
            href="/suggest"
            className="px-7 py-3 bg-brand-rust hover:bg-brand-silog active:scale-95 text-white font-body font-semibold rounded-full text-sm shadow-md transition-all duration-150"
          >
            Get Suggestions →
          </Link>
          <Link
            href="/search"
            className="px-7 py-3 border border-brand-rust text-brand-rust hover:bg-brand-rust hover:text-white active:scale-95 font-body font-semibold rounded-full text-sm transition-all duration-150"
          >
            Search Recipe
          </Link>
        </div>

        <p className="relative z-10 mt-12 text-xs text-brand-smoke/50 font-body animate-bounce">
          ↓
        </p>
      </section>

      {/* ── ULAM OF THE DAY TEASER ──────────────────────── */}
      <section className="bg-brand-rust/10 border-y border-brand-rust/20 px-4 py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-6">
          <div className="text-5xl select-none" aria-hidden="true">🍲</div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-xs font-body font-semibold tracking-widest text-brand-rust uppercase mb-1">
              Ulam ng Araw
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-brand-bark">
              Sinigang na Baboy
            </h2>
            <p className="text-sm font-body text-brand-smoke mt-1">
              Maasim, mainit, at pampagana. Perpekto sa tag-ulan.
            </p>
          </div>
          <Link
            href="/search"
            className="shrink-0 px-5 py-2.5 bg-brand-bark hover:bg-brand-rust text-white font-body font-semibold text-sm rounded-full transition-all duration-150"
          >
            View Recipe →
          </Link>
        </div>
      </section>

      {/* ── FEATURE CARDS ───────────────────────────────── */}
      <section className="max-w-5xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-10">
          <p className="text-xs font-body font-semibold tracking-widest text-brand-rust uppercase mb-2">
            Ano ang kaya ng UOTD?
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-bark">
            Lahat ng kailangan mo,
            <br />
            <span className="text-brand-rust">nasa isang lugar.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="group bg-brand-garlic border border-brand-rice rounded-2xl p-6 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 animate-slide-up"
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: "both" }}
            >
              <span className="text-4xl select-none" aria-hidden="true">{f.emoji}</span>
              <div>
                <p className="text-xs font-body font-semibold tracking-widest text-brand-rust uppercase">
                  {f.subtitle}
                </p>
                <h3 className="font-display text-xl font-bold text-brand-bark mt-0.5">
                  {f.title}
                </h3>
              </div>
              <p className="font-body text-sm text-brand-smoke leading-relaxed flex-1">
                {f.description}
              </p>
              <Link
                href={f.href}
                className="inline-flex items-center gap-1 text-sm font-body font-semibold text-brand-rust group-hover:gap-2 transition-all"
              >
                {f.cta} <span aria-hidden="true">→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMING SOON BANNER ──────────────────────────── */}
      <section className="bg-brand-bark text-brand-cream px-4 py-12 text-center">
        <p className="text-xs font-body font-semibold tracking-widest text-brand-silog uppercase mb-3">
          Paparating na
        </p>
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
          Budget planner. Diet tracker.
          <br />
          <span className="text-brand-silog">Kalorie counter.</span>
        </h2>
        <p className="font-body text-sm text-brand-cream/70 max-w-sm mx-auto">
          Marami pang darating. I-save na ang UOTD para updated ka lagi.
        </p>
      </section>
    </div>
  );
}
