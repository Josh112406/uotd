"use client";

/**
 * /suggest page
 *
 * Flow:
 * 1. User picks a meal type (Breakfast / Lunch / Dinner / Meryenda)
 * 2. Hits "Suggest Ulam" → POST /api/suggest
 * 3. Shows 5 cards sorted: full match first, then partial by fewest missing
 * 4. Each card → "Tingnan ang Recipe →" → /search?dish=Dish+Name
 *
 * States handled:
 * - Auth loading / not logged in → redirect
 * - No meal type selected → button disabled with tooltip reason
 * - Loading (Gemini thinking) → skeleton cards with pulse
 * - API error → friendly Filipino error message + retry
 * - Empty pantry error (from API) → CTA to go fill pantry
 * - Results → cards
 * - Results exist + user changes meal type → stale results hidden until new fetch
 *
 * Bugs prevented:
 * - Double-submit blocked (isLoading guard on button)
 * - Stale suggestions cleared when meal type changes (never shows wrong context)
 * - estimatedCostPHP=0 on full match shows "Kumpleto!" not "₱0"
 * - missingIngredients empty array on full match shows nothing, not an empty list
 * - Card "Tingnan" link encodes dish name for safe URL params
 * - Auth redirect fallback in useEffect (middleware is primary)
 */

import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { scaleAmount, scaleCost } from "@/lib/scaleAmount";
import { inPantry, countMissing } from "@/lib/ingredientMatch";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Suggestion {
  name: string;
  matchType: "full" | "partial";
  missingIngredients: string[];
  estimatedCostPHP: number;
  mealType: string;
  reason: string;
}

interface Ingredient {
  name: string;
  amount: string;
}

interface RecipeStep {
  step: number;
  instruction: string;
  timerMinutes: number;
}

interface FullRecipe {
  name: string;
  description: string;
  servings: number;
  estimatedCostPHP: number;
  calories: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Meryenda"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_TYPE_FILIPINO: Record<MealType, string> = {
  Breakfast: "Almusal",
  Lunch: "Tanghalian",
  Dinner: "Hapunan",
  Meryenda: "Meryenda",
};

const MEAL_TYPE_EMOJI: Record<MealType, string> = {
  Breakfast: "🌅",
  Lunch: "☀️",
  Dinner: "🌙",
  Meryenda: "🍵",
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SuggestPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isEmptyPantry, setIsEmptyPantry] = useState(false);
  // Pantry items for cross-check inside expanded recipe cards
  const [pantryItems, setPantryItems] = useState<{ name: string }[] | null>(null);

  // Auth guard fallback
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/suggest");
    }
  }, [authLoading, user, router]);

  // Fetch pantry once for cross-check in expanded recipe cards
  useEffect(() => {
    if (!user) return;
    fetch("/api/pantry")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPantryItems(Array.isArray(data) ? data : []))
      .catch(() => setPantryItems([]));
  }, [user]);

  // Clear stale suggestions when meal type changes
  function handleMealTypeSelect(meal: MealType) {
    setSelectedMeal(meal);
    setSuggestions(null);
    setError("");
    setIsEmptyPantry(false);
  }

  // ── Fetch suggestions ───────────────────────────────────────────────────────
  async function handleSuggest() {
    if (!selectedMeal || isLoading) return;

    setIsLoading(true);
    setError("");
    setSuggestions(null);
    setIsEmptyPantry(false);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType: selectedMeal }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Special case: empty pantry — show a CTA instead of generic error
        if (res.status === 400 && data.error?.includes("pantry")) {
          setIsEmptyPantry(true);
        } else {
          setError(data.error ?? "There was an error. Please try again.");
        }
        return;
      }

      setSuggestions(data.suggestions);
    } catch {
      setError("Could not reach server. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading) return <PageSkeleton />;
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8">

      {/* ── Header ── */}
      <div className="mb-6">
        <p className="text-xs font-body font-semibold tracking-widest text-brand-rust uppercase mb-1">
          AI Suggestions
        </p>
        <h1 className="font-display text-3xl font-bold text-brand-bark">
          What&apos;s for mealtime?
        </h1>
        <p className="text-sm font-body text-brand-smoke mt-1">
          Pick a meal type and we&apos;ll find what you can cook from your pantry.
        </p>
      </div>

      {/* ── Meal type selector ── */}
      <div className="mb-5">
        <p className="text-xs font-body font-semibold text-brand-bark mb-2 tracking-wide uppercase">
          What&apos;s this for?
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MEAL_TYPES.map((meal) => (
            <button
              key={meal}
              onClick={() => handleMealTypeSelect(meal)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 font-body text-sm font-semibold transition-all active:scale-95 ${
                selectedMeal === meal
                  ? "border-brand-rust bg-brand-rust text-white shadow-sm"
                  : "border-brand-rice bg-brand-garlic text-brand-bark hover:border-brand-rust/40 hover:bg-brand-rice/60"
              }`}
            >
              <span className="text-xl" aria-hidden="true">
                {MEAL_TYPE_EMOJI[meal]}
              </span>
              <span>{MEAL_TYPE_FILIPINO[meal]}</span>
              <span className={`text-xs font-normal ${selectedMeal === meal ? "text-white/80" : "text-brand-smoke"}`}>
                {meal}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Suggest button ── */}
      <button
        onClick={handleSuggest}
        disabled={!selectedMeal || isLoading}
        title={!selectedMeal ? "Pick a meal type first" : undefined}
        className="w-full py-3.5 bg-brand-rust hover:bg-brand-silog disabled:opacity-50 disabled:cursor-not-allowed text-white font-body font-semibold text-base rounded-xl transition-all active:scale-[0.98] shadow-sm mb-6"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner />
            Finding meals…
          </span>
        ) : (
          "Suggest Meals ✨"
        )}
      </button>

      {/* ── Empty pantry state ── */}
      {isEmptyPantry && (
        <div className="text-center py-12 bg-brand-garlic border border-brand-rice rounded-2xl">
          <span className="text-5xl mb-4 block" aria-hidden="true">🧺</span>
          <p className="font-display text-xl font-bold text-brand-bark mb-2">
            Your pantry is empty
          </p>
          <p className="text-sm font-body text-brand-smoke mb-5 max-w-xs mx-auto">
            Add some ingredients first so we can suggest a dish.
          </p>
          <Link
            href="/pantry"
            className="inline-block px-6 py-2.5 bg-brand-rust hover:bg-brand-silog text-white font-body font-semibold text-sm rounded-full transition-all active:scale-95"
          >
            Go to Pantry →
          </Link>
        </div>
      )}

      {/* ── Generic error ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-brand-rust/10 border border-brand-rust/30 rounded-xl">
          <p className="text-sm font-body text-brand-rust">⚠ {error}</p>
          <button
            onClick={handleSuggest}
            className="mt-2 text-xs font-body font-semibold text-brand-rust underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Loading skeleton cards ── */}
      {isLoading && <SuggestionSkeletons />}

      {/* ── Results ── */}
      {!isLoading && suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-body font-semibold text-brand-smoke uppercase tracking-widest mb-3">
            {suggestions.length} Suggestions for {selectedMeal && MEAL_TYPE_FILIPINO[selectedMeal]}
          </p>

          {suggestions.map((dish, i) => (
            <SuggestionCard key={`${dish.name}-${i}`} dish={dish} index={i} pantryItems={pantryItems} />
          ))}

          {/* Refresh nudge */}
          <div className="pt-3 text-center">
            <button
              onClick={handleSuggest}
              className="text-xs font-body text-brand-smoke hover:text-brand-rust underline underline-offset-2 transition"
            >
              Generate new suggestions
            </button>
          </div>
        </div>
      )}

      {/* ── Empty results (Gemini returned 0 dishes — shouldn't happen but guard it) ── */}
      {!isLoading && suggestions && suggestions.length === 0 && (
        <div className="text-center py-12 bg-brand-garlic border border-brand-rice rounded-2xl">
          <span className="text-5xl mb-4 block" aria-hidden="true">🍽️</span>
          <p className="font-display text-xl font-bold text-brand-bark mb-2">
            No suggestions found
          </p>
          <p className="text-sm font-body text-brand-smoke mb-5 max-w-xs mx-auto">
            Try adding more ingredients to your pantry.
          </p>
          <button
            onClick={handleSuggest}
            className="px-6 py-2.5 bg-brand-rust hover:bg-brand-silog text-white font-body font-semibold text-sm rounded-full transition-all active:scale-95"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Suggestion Card ───────────────────────────────────────────────────────────
// Expandable inline recipe — no redirect to /search needed.
// When user taps "Tingnan ang Recipe", fetches from /api/search and shows
// ingredients (with pantry cross-check) + steps right inside the card.

function SuggestionCard({
  dish,
  index,
  pantryItems,
}: {
  dish: Suggestion;
  index: number;
  pantryItems: { name: string }[] | null;
}) {
  const isFullMatch = dish.matchType === "full";

  const [isExpanded, setIsExpanded] = useState(false);
  const [recipe, setRecipe] = useState<FullRecipe | null>(null);
  const [isFetchingRecipe, setIsFetchingRecipe] = useState(false);
  const [recipeError, setRecipeError] = useState("");
  const [currentServings, setCurrentServings] = useState<number | null>(null);

  async function handleToggle() {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);

    // Already fetched — just re-expand
    if (recipe) return;

    setIsFetchingRecipe(true);
    setRecipeError("");

    try {
      const res = await fetch(`/api/search?dish=${encodeURIComponent(dish.name)}`);
      const data = await res.json();

      if (!res.ok || !data.results || data.results.length === 0) {
        setRecipeError("Could not find recipe. Try the Search tab.");
        return;
      }

      // Take the first result (closest match to dish name)
      const r: FullRecipe = data.results[0];
      setRecipe(r);
      setCurrentServings(r.servings);
    } catch {
      setRecipeError("Could not reach server. Please try again.");
    } finally {
      setIsFetchingRecipe(false);
    }
  }



  const servings = currentServings ?? recipe?.servings ?? 4;
  const ratio = recipe ? servings / recipe.servings : 1;
  const scaledCost = recipe ? scaleCost(recipe.estimatedCostPHP, recipe.servings, servings) : 0;

  // Recompute match status from real pantry data once recipe is loaded.
  // Overrides Gemini's guess which can be wrong.
  const realMissingCount = recipe && pantryItems !== null
    ? countMissing(recipe.ingredients, pantryItems)
    : null;
  const displayIsFullMatch = realMissingCount !== null
    ? realMissingCount === 0
    : isFullMatch; // fall back to Gemini's guess while loading

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-all ${
        isFullMatch ? "border-brand-leaf/40" : "border-brand-rice"
      } bg-brand-garlic`}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    >
      {/* ── Card header — match badge + dish name + cost ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-body font-semibold mb-2 ${
                displayIsFullMatch
                  ? "bg-brand-leaf/15 text-brand-leaf"
                  : "bg-brand-silog/15 text-brand-silog"
              }`}
            >
              {displayIsFullMatch
                ? "✅ Complete ingredients"
                : realMissingCount !== null
                  ? `⚠️ Missing ${realMissingCount} ingredient${realMissingCount !== 1 ? "s" : ""}`
                  : `⚠️ Missing ${dish.missingIngredients.length} ingredient${dish.missingIngredients.length !== 1 ? "s" : ""}`}
            </span>

            <h2 className="font-display text-xl font-bold text-brand-bark leading-tight">
              {dish.name}
            </h2>

            <p className="text-xs font-body text-brand-smoke mt-1 leading-relaxed">
              {dish.reason}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {displayIsFullMatch ? (
              <span className="text-xs font-body font-semibold text-brand-leaf bg-brand-leaf/10 px-2 py-1 rounded-lg">
                Complete!
              </span>
            ) : (
              <span className="text-xs font-body font-semibold text-brand-smoke bg-brand-rice px-2 py-1 rounded-lg">
                +₱{dish.estimatedCostPHP}
              </span>
            )}
          </div>
        </div>

        {/* Missing ingredients chips — display only for now */}
        {!isFullMatch && dish.missingIngredients.length > 0 && (
          <div className="mt-3 pt-3 border-t border-brand-rice">
            <p className="text-xs font-body font-semibold text-brand-smoke uppercase tracking-widest mb-1.5">
              Missing:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dish.missingIngredients.map((ing, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-brand-rust/8 border border-brand-rust/20 text-brand-rust font-body text-xs rounded-full"
                >
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Toggle recipe button ── */}
      <div className="px-4 pb-4">
        <button
          onClick={handleToggle}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-brand-bark hover:bg-brand-bark/80 text-brand-garlic font-body font-semibold text-sm rounded-xl transition-all active:scale-[0.98]"
        >
          {isExpanded ? "Hide Recipe ↑" : "View Recipe ↓"}
        </button>
      </div>

      {/* ── Expanded recipe content ── */}
      {isExpanded && (
        <div className="border-t border-brand-rice">

          {/* Loading state */}
          {isFetchingRecipe && (
            <div className="px-4 py-8 flex flex-col items-center gap-2 text-brand-smoke">
              <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <p className="text-xs font-body">Finding recipe…</p>
            </div>
          )}

          {/* Error state */}
          {!isFetchingRecipe && recipeError && (
            <div className="px-4 py-4">
              <p className="text-sm font-body text-brand-rust">⚠ {recipeError}</p>
              <button
                onClick={() => { setRecipe(null); handleToggle(); }}
                className="mt-2 text-xs font-body font-semibold text-brand-rust underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          )}

          {/* Recipe content */}
          {!isFetchingRecipe && recipe && (
            <>
              {/* Serving control */}
              <div className="px-4 py-3 bg-brand-rust/8 border-b border-brand-rust/20">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-body font-bold text-brand-bark text-sm">How many servings?</p>
                    <p className="text-xs font-body text-brand-smoke mt-0.5">Adjust the amount</p>
                  </div>
                  <div className="flex items-center gap-0 rounded-xl border-2 border-brand-rust overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setCurrentServings((s) => Math.max(1, (s ?? recipe.servings) - 1))}
                      disabled={(currentServings ?? recipe.servings) <= 1}
                      className="w-10 h-10 flex items-center justify-center text-brand-rust font-bold text-xl hover:bg-brand-rust/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >−</button>
                    <span className="w-10 text-center font-body font-bold text-brand-bark text-base border-x border-brand-rust/30 h-10 flex items-center justify-center">
                      {servings}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentServings((s) => Math.min(50, (s ?? recipe.servings) + 1))}
                      disabled={(currentServings ?? recipe.servings) >= 50}
                      className="w-10 h-10 flex items-center justify-center text-brand-rust font-bold text-xl hover:bg-brand-rust/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >+</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-brand-rust/15">
                  <div className="flex items-center gap-1.5">
                    <span aria-hidden="true">💰</span>
                    <div>
                      <p className="text-xs font-body text-brand-smoke">Est. Cost</p>
                      <p className="font-body font-bold text-brand-bark text-sm">₱{scaledCost}</p>
                    </div>
                  </div>
                  {recipe.calories > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span aria-hidden="true">🔥</span>
                      <div>
                        <p className="text-xs font-body text-brand-smoke">Calories</p>
                        <p className="font-body font-bold text-brand-bark text-sm">{recipe.calories} / serving</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ingredients */}
              <div className="px-4 py-4 border-b border-brand-rice">
                <p className="text-xs font-body font-semibold text-brand-smoke uppercase tracking-widest mb-3">
                  Ingredients
                  {ratio !== 1 && (
                    <span className="ml-2 normal-case text-brand-rust font-normal">
                      (for {servings} serving{servings !== 1 ? "s" : ""})
                    </span>
                  )}
                </p>
                <ul className="space-y-2">
                  {recipe.ingredients.map((ing, j) => {
                    const present = inPantry(ing.name, pantryItems);
                    const scaledAmt = scaleAmount(ing.amount, ratio);
                    return (
                      <li key={j} className="flex items-center gap-2.5">
                        {present === true && (
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-brand-leaf/15 text-brand-leaf text-xs" aria-label="in pantry">✓</span>
                        )}
                        {present === false && (
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-brand-rust/10 text-brand-rust text-xs" aria-label="not in pantry">✗</span>
                        )}
                        {present === null && (
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-brand-rice text-brand-smoke text-xs">•</span>
                        )}
                        <span className={`font-body text-sm flex-1 ${present === false ? "text-brand-rust" : "text-brand-bark"}`}>
                          {ing.name}
                        </span>
                        <span className={`font-body text-sm font-semibold shrink-0 ${ratio !== 1 ? "text-brand-rust" : "text-brand-smoke"}`}>
                          {scaledAmt}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {pantryItems && (
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-brand-rice">
                    <span className="text-xs font-body text-brand-smoke flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-brand-leaf/15 text-brand-leaf flex items-center justify-center text-xs">✓</span>
                      in your pantry
                    </span>
                    <span className="text-xs font-body text-brand-smoke flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-brand-rust/10 text-brand-rust flex items-center justify-center text-xs">✗</span>
                      missing
                    </span>
                  </div>
                )}
              </div>

              {/* Steps */}
              <div className="px-4 py-4 border-b border-brand-rice">
                <p className="text-xs font-body font-semibold text-brand-smoke uppercase tracking-widest mb-3">
                  Cooking Steps
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
                            ⏱ {step.timerMinutes} min
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Action buttons — Coming Soon */}
              <div className="px-4 py-4 flex flex-col sm:flex-row gap-2">
                <button disabled title="Coming soon"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-rice text-brand-smoke/60 font-body font-semibold text-sm rounded-xl cursor-not-allowed">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Start Cooking
                  <span className="text-xs bg-brand-smoke/20 px-1.5 py-0.5 rounded-full">Soon</span>
                </button>
                <button disabled title="Coming soon"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-rice text-brand-smoke/60 font-body font-semibold text-sm rounded-xl cursor-not-allowed">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  Shopping List
                  <span className="text-xs bg-brand-smoke/20 px-1.5 py-0.5 rounded-full">Soon</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin"
      width="18" height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function SuggestionSkeletons() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-2xl border border-brand-rice bg-brand-garlic overflow-hidden">
          <div className="px-4 pt-4 pb-4">
            <div className="h-4 bg-brand-rice rounded-full w-32 mb-3" />
            <div className="h-6 bg-brand-rice rounded w-3/4 mb-2" />
            <div className="h-3 bg-brand-rice rounded w-full mb-1" />
            <div className="h-3 bg-brand-rice rounded w-2/3" />
          </div>
          <div className="px-4 pb-4">
            <div className="h-10 bg-brand-rice rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8 animate-pulse">
      <div className="h-8 bg-brand-rice rounded w-48 mb-2" />
      <div className="h-4 bg-brand-rice rounded w-64 mb-8" />
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[1,2,3,4].map(i => <div key={i} className="h-20 bg-brand-rice rounded-xl" />)}
      </div>
      <div className="h-12 bg-brand-rice rounded-xl mb-6" />
    </div>
  );
}
