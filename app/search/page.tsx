"use client";

/**
 * /search page — with recipe scalability
 *
 * Serving control:
 * - Default = 1 serving (scaled down from Gemini's base)
 * - Stepper (- / +) + typed input, range 1–50
 * - All ingredient amounts scale live with the serving count
 * - Cost scales proportionally, rounded to whole PHP
 * - "to taste", "pinch", "as needed" — never scaled
 * - Calories shown per serving (stays fixed — it's already per-serving)
 *
 * Bugs prevented:
 * - Typed input: non-numeric, 0, negative, >50 all clamped/rejected
 * - Typed input blank → treated as 1, not 0 or NaN
 * - Ratio = currentServings / baseServings (Gemini's original serving count)
 * - Auto-search fires ONCE via useRef (not on every re-render)
 * - dish param URL-decoded before display and search
 * - isLoading blocks double-submit
 * - Pantry cross-check failure → silent fallback
 * - Cross-check case-insensitive
 * - Only one card expanded at a time — serving state is per-card via index map
 * - Expanding a new card does NOT reset serving size of already-set cards
 */

import { useState, useEffect, useRef, FormEvent, Suspense } from "react";
import { inPantry as checkInPantry, countMissing } from "@/lib/ingredientMatch";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { scaleAmount, scaleCost } from "@/lib/scaleAmount";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ingredient {
  name: string;
  amount: string;
}

interface Step {
  step: number;
  instruction: string;
  timerMinutes: number;
}

interface RecipeResult {
  name: string;
  description: string;
  servings: number;   // base servings from Gemini
  estimatedCostPHP: number;
  calories: number;   // per serving — stays fixed
  ingredients: Ingredient[];
  steps: Step[];
}

interface PantryItem {
  name: string;
}

const RESULT_LIMIT = 6;

// ── Serving Stepper Component ─────────────────────────────────────────────────

interface ServingStepperProps {
  value: number;
  onChange: (n: number) => void;
}

function ServingStepper({ value, onChange }: ServingStepperProps) {
  const [inputVal, setInputVal] = useState(String(value));

  // Keep local input in sync if parent changes it
  useEffect(() => {
    setInputVal(String(value));
  }, [value]);

  function clamp(n: number): number {
    if (isNaN(n) || n < 1) return 1;
    if (n > 50) return 50;
    return Math.round(n);
  }

  function handleDecrement() {
    const next = clamp(value - 1);
    onChange(next);
  }

  function handleIncrement() {
    const next = clamp(value + 1);
    onChange(next);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Allow typing freely — only clamp on blur/enter
    setInputVal(e.target.value);
  }

  function handleInputCommit() {
    const parsed = parseInt(inputVal, 10);
    const clamped = clamp(parsed);
    onChange(clamped);
    setInputVal(String(clamped));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="flex items-center gap-0 rounded-xl border-2 border-brand-rust overflow-hidden bg-white">
      {/* Decrement */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= 1}
        aria-label="Bawasan ang serving"
        className="w-10 h-10 flex items-center justify-center text-brand-rust font-bold text-xl hover:bg-brand-rust/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        −
      </button>

      {/* Input */}
      <input
        type="number"
        min={1}
        max={50}
        value={inputVal}
        onChange={handleInputChange}
        onBlur={handleInputCommit}
        onKeyDown={handleKeyDown}
        aria-label="Bilang ng servings"
        className="w-12 text-center font-body font-bold text-brand-bark text-base border-x border-brand-rust/30 h-10 focus:outline-none focus:bg-brand-rust/5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />

      {/* Increment */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= 50}
        aria-label="Dagdagan ang serving"
        className="w-10 h-10 flex items-center justify-center text-brand-rust font-bold text-xl hover:bg-brand-rust/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
    </div>
  );
}

// ── Search Inner ──────────────────────────────────────────────────────────────

function SearchInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const paramDish = searchParams.get("dish")
    ? decodeURIComponent(searchParams.get("dish")!)
    : "";

  const [query, setQuery] = useState(paramDish);
  const [results, setResults] = useState<RecipeResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[] | null>(null);

  // Per-card serving state: cardIndex → currentServings
  // Separate so each card keeps its own serving count independently
  const [servingsMap, setServingsMap] = useState<Record<number, number>>({});

  const autoSearched = useRef(false);

  useEffect(() => {
    if (paramDish && !autoSearched.current) {
      autoSearched.current = true;
      doSearch(paramDish);
    }
  }, [paramDish]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/pantry")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPantryItems(Array.isArray(data) ? data : []))
      .catch(() => setPantryItems([]));
  }, [user]);

  async function doSearch(searchTerm: string) {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError("");
    setResults(null);
    setExpandedIndex(null);
    setServingsMap({});

    try {
      const res = await fetch(
        `/api/search?dish=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "May error. Subukan ulit.");
        return;
      }

      if (!data.results || data.results.length === 0) {
        setError("Walang nahanap. Subukan ng ibang pangalan.");
        return;
      }

      setResults(data.results);

      // Default each card to its own recipe's serving count
      const initial: Record<number, number> = {};
      (data.results as RecipeResult[]).forEach((r, i) => {
        initial[i] = (r as RecipeResult).servings ?? 4;
      });
      setServingsMap(initial);
    } catch {
      setError("Hindi maabot ang server. I-check ang iyong koneksyon.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    doSearch(query);
  }

  function toggleExpand(index: number) {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }

  function setServings(cardIndex: number, n: number) {
    setServingsMap((prev) => ({ ...prev, [cardIndex]: n }));
  }

  function inPantry(ingredientName: string): boolean | null {
    return checkInPantry(ingredientName, pantryItems);
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8">

      {/* ── Header ── */}
      <div className="mb-6">
        <p className="text-xs font-body font-semibold tracking-widest text-brand-rust uppercase mb-1">
          Recipe Search
        </p>
        <h1 className="font-display text-3xl font-bold text-brand-bark">
          Hanapin ang Recipe
        </h1>
        <p className="text-sm font-body text-brand-smoke mt-1">
          I-type ang pangalan ng ulam — makikita mo ang recipe at mga ingredients.
        </p>
      </div>

      {/* ── Search bar ── */}
      <form onSubmit={handleSubmit} noValidate className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-smoke/60" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Sinigang, Adobo, Tinola…"
              autoComplete="off"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:border-brand-rust focus:outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="px-5 py-3 bg-brand-rust hover:bg-brand-silog disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-semibold text-sm rounded-xl transition-all active:scale-95"
          >
            {isLoading ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              "Hanapin"
            )}
          </button>
        </div>
      </form>

      {/* ── Error ── */}
      {error && (
        <div className="mb-5 px-4 py-3 bg-brand-rust/10 border border-brand-rust/30 rounded-xl">
          <p className="text-sm font-body text-brand-rust">⚠ {error}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && <SearchSkeleton />}

      {/* ── Results ── */}
      {!isLoading && results && (
        <div className="space-y-3">
          <p className="text-xs font-body font-semibold text-brand-smoke uppercase tracking-widest mb-3">
            {results.length} resulta para sa &ldquo;{query}&rdquo;
          </p>

          {results.map((recipe, i) => {
            const currentServings = servingsMap[i] ?? recipe.servings;
            // ratio = how much to scale relative to Gemini's base serving count
            const ratio = currentServings / recipe.servings;
            const scaledCost = scaleCost(recipe.estimatedCostPHP, recipe.servings, currentServings);

            return (
              <div key={`${recipe.name}-${i}`} className="rounded-2xl border border-brand-rice bg-brand-garlic overflow-hidden">

                {/* ── Collapsed header — always visible ── */}
                <button
                  onClick={() => toggleExpand(i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-4 text-left hover:bg-brand-rice/40 transition min-h-[56px]"
                  aria-expanded={expandedIndex === i}
                >
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-lg font-bold text-brand-bark truncate">
                      {recipe.name}
                    </h2>
                    <p className="text-xs font-body text-brand-smoke mt-0.5 line-clamp-1">
                      {recipe.description}
                    </p>
                    {/* Pantry summary badge — shown when logged in */}
                    {user && pantryItems !== null && (() => {
                      const missing = countMissing(recipe.ingredients, pantryItems);
                      if (missing === 0) return (
                        <span className="inline-block mt-1 text-xs font-body font-semibold text-brand-leaf">
                          ✅ Kumpleto sa pantry
                        </span>
                      );
                      if (missing !== null && missing > 0) return (
                        <span className="inline-block mt-1 text-xs font-body font-semibold text-brand-silog">
                          ⚠️ {missing} ingredient{missing !== 1 ? "s" : ""} kulang
                        </span>
                      );
                      return null;
                    })()}
                  </div>
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={`shrink-0 text-brand-smoke transition-transform duration-200 ${expandedIndex === i ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {/* ── Expanded recipe ── */}
                {expandedIndex === i && (
                  <div className="border-t border-brand-rice">

                    {/* ── SERVING CONTROL — prominent, top of expanded ── */}
                    <div className="px-4 py-4 bg-brand-rust/8 border-b border-brand-rust/20">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-body font-bold text-brand-bark text-sm">
                            Ilang serving?
                          </p>
                          <p className="text-xs font-body text-brand-smoke mt-0.5">
                            I-adjust ang dami ng pagkain
                          </p>
                        </div>
                        <ServingStepper
                          value={currentServings}
                          onChange={(n) => setServings(i, n)}
                        />
                      </div>

                      {/* Scaled summary — visible at a glance */}
                      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-brand-rust/15">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base" aria-hidden="true">🍽️</span>
                          <div>
                            <p className="text-xs font-body text-brand-smoke">Serving</p>
                            <p className="font-body font-bold text-brand-bark text-sm">{currentServings}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base" aria-hidden="true">💰</span>
                          <div>
                            <p className="text-xs font-body text-brand-smoke">Estimated Cost</p>
                            <p className="font-body font-bold text-brand-bark text-sm">₱{scaledCost}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-base" aria-hidden="true">🔥</span>
                          <div>
                            <p className="text-xs font-body text-brand-smoke">Calories</p>
                            <p className="font-body font-bold text-brand-bark text-sm">{recipe.calories} / serving</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Ingredients ── */}
                    <div className="px-4 py-4 border-b border-brand-rice">
                      <p className="text-xs font-body font-semibold text-brand-smoke uppercase tracking-widest mb-3">
                        Mga Sangkap
                        {currentServings !== recipe.servings && (
                          <span className="ml-2 normal-case text-brand-rust font-normal">
                            (scaled para sa {currentServings} serving{currentServings !== 1 ? "s" : ""})
                          </span>
                        )}
                      </p>
                      <ul className="space-y-2">
                        {recipe.ingredients.map((ing, j) => {
                          const present = inPantry(ing.name);
                          const scaledAmount = scaleAmount(ing.amount, ratio);
                          return (
                            <li key={j} className="flex items-center gap-2.5">
                              {present === true && (
                                <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-brand-leaf/15 text-brand-leaf text-xs" aria-label="nasa pantry">✓</span>
                              )}
                              {present === false && (
                                <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-brand-rust/10 text-brand-rust text-xs" aria-label="wala sa pantry">✗</span>
                              )}
                              {present === null && (
                                <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-brand-rice text-brand-smoke text-xs">•</span>
                              )}
                              <span className={`font-body text-sm flex-1 ${present === false ? "text-brand-rust" : "text-brand-bark"}`}>
                                {ing.name}
                              </span>
                              <span className={`font-body text-sm font-semibold shrink-0 ${ratio !== 1 ? "text-brand-rust" : "text-brand-smoke"}`}>
                                {scaledAmount}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {user && pantryItems && (
                        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-brand-rice">
                          <span className="text-xs font-body text-brand-smoke flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-brand-leaf/15 text-brand-leaf flex items-center justify-center text-xs">✓</span>
                            nasa pantry mo
                          </span>
                          <span className="text-xs font-body text-brand-smoke flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-brand-rust/10 text-brand-rust flex items-center justify-center text-xs">✗</span>
                            kulang pa
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Steps ── */}
                    <div className="px-4 py-4 border-b border-brand-rice">
                      <p className="text-xs font-body font-semibold text-brand-smoke uppercase tracking-widest mb-3">
                        Paraan ng Pagluluto
                      </p>
                      <ol className="space-y-3">
                        {recipe.steps.map((step) => (
                          <li key={step.step} className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-brand-bark text-white font-body font-bold text-xs mt-0.5">
                              {step.step}
                            </span>
                            <div className="flex-1">
                              <p className="font-body text-sm text-brand-bark leading-relaxed">
                                {step.instruction}
                              </p>
                              {step.timerMinutes > 0 && (
                                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-brand-silog/15 text-brand-silog font-body text-xs rounded-full">
                                  ⏱ {step.timerMinutes} minuto
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* ── Action buttons ── */}
                    <div className="px-4 py-4 flex flex-col sm:flex-row gap-2">
                      <button
                        disabled
                        title="Coming soon"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-rice text-brand-smoke/60 font-body font-semibold text-sm rounded-xl cursor-not-allowed"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        Start Cooking
                        <span className="text-xs bg-brand-smoke/20 px-1.5 py-0.5 rounded-full">Soon</span>
                      </button>
                      <button
                        disabled
                        title="Coming soon"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-rice text-brand-smoke/60 font-body font-semibold text-sm rounded-xl cursor-not-allowed"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                        </svg>
                        Shopping List
                        <span className="text-xs bg-brand-smoke/20 px-1.5 py-0.5 rounded-full">Soon</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty / initial state ── */}
      {!isLoading && !results && !error && (
        <div className="text-center py-16">
          <span className="text-5xl mb-4 block" aria-hidden="true">🔍</span>
          <p className="font-display text-xl font-bold text-brand-bark mb-2">
            Maghanap ng Ulam
          </p>
          <p className="text-sm font-body text-brand-smoke max-w-xs mx-auto">
            I-type ang pangalan ng kahit anong Filipino dish para makita ang recipe.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {["Sinigang", "Adobo", "Tinola", "Kare-kare", "Menudo", "Nilaga"].map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); doSearch(s); }}
                className="px-3 py-1.5 bg-brand-garlic border border-brand-rice text-brand-bark font-body text-xs rounded-full hover:border-brand-rust hover:text-brand-rust transition"
              >
                {s}
              </button>
            ))}
          </div>
          {!paramDish && (
            <div className="mt-8">
              <Link href="/suggest" className="text-sm font-body text-brand-rust font-semibold hover:underline underline-offset-2">
                ← Bumalik sa Suggest
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SearchSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: RESULT_LIMIT }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-brand-rice bg-brand-garlic px-4 py-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="h-5 bg-brand-rice rounded w-1/2 mb-2" />
            <div className="h-3 bg-brand-rice rounded w-3/4" />
          </div>
          <div className="w-5 h-5 bg-brand-rice rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto w-full px-4 py-8 animate-pulse">
        <div className="h-8 bg-brand-rice rounded w-48 mb-2" />
        <div className="h-4 bg-brand-rice rounded w-64 mb-6" />
        <div className="h-12 bg-brand-rice rounded-xl mb-6" />
        <SearchSkeleton />
      </div>
    }>
      <SearchInner />
    </Suspense>
  );
}
