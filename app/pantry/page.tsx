"use client";

/**
 * /pantry page
 *
 * What it does:
 * - Shows all ingredients the user has at home, grouped by category
 * - Add new ingredients (name + optional quantity + category)
 * - Delete ingredients one by one
 * - "Go to Suggest" CTA that passes pantry context
 * - Empty state with helpful prompt
 * - Loading skeleton so it never looks broken while fetching
 *
 * Data flow:
 * - Reads/writes via /api/pantry (server route → Supabase)
 * - Optimistic UI: item appears immediately, rolls back on error
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

interface PantryItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Proteins",
  "Vegetables",
  "Spices & Condiments",
  "Grains & Staples",
  "Dairy & Eggs",
  "Fruits",
  "Others",
];

const CATEGORY_EMOJI: Record<string, string> = {
  "Proteins": "🥩",
  "Vegetables": "🥦",
  "Spices & Condiments": "🧄",
  "Grains & Staples": "🍚",
  "Dairy & Eggs": "🥚",
  "Fruits": "🍌",
  "Others": "🧺",
};

// Common Filipino pantry ingredients for quick-add suggestions
const QUICK_ADD_SUGGESTIONS = [
  "Garlic", "Onion", "Tomato", "Ginger", "Pork belly",
  "Chicken", "Fish", "Eggs", "Rice", "Soy sauce",
  "Vinegar", "Fish sauce", "Cooking oil", "Potatoes", "Kangkong",
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function PantryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const QUICK_ADD_SUGGESTIONS = [
  "Egg",
  "Rice",
  "Chicken",
  "Pork",
  "Garlic",
  "Onion",
  "Tomato",
  "Cooking Oil",
  "Soy Sauce",
  "Vinegar",
  ];
  // Add form state
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [unit, setUnit] = useState("");  const [category, setCategory] = useState("Others");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Deletion in-progress tracking (per item id)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  // Middleware handles the redirect, but this is a fallback for race conditions
  useEffect(() => {
    // If input is empty, remove suggestions
    if (!name.trim()) {
      setFilteredSuggestions([]);
      return;
    }

    // Find matching ingredients
    const matches = QUICK_ADD_SUGGESTIONS.filter((item) =>
      item.toLowerCase().includes(name.toLowerCase())
    );

    // Limit to 5 suggestions
    setFilteredSuggestions(matches.slice(0, 5));
  }, [name]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/pantry");
    }
  }, [authLoading, user, router]);

  // ── Fetch pantry items ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    async function fetchItems() {
      setIsFetching(true);
      setFetchError("");
      try {
        const res = await fetch("/api/pantry");
        if (!res.ok) throw new Error("Hindi ma-load ang pantry. Subukan ulit.");
        const data = await res.json();
        setItems(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Hindi ma-load ang pantry.");
      } finally {
        setIsFetching(false);
      }
    }

    fetchItems();
  }, [user]);

  // Auto-focus name input when form opens
  useEffect(() => {
    if (showForm) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [showForm]);

  // ── Add item ────────────────────────────────────────────────────────────────
  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setAddError("Ilagay ang pangalan ng ingredient.");
      nameInputRef.current?.focus();
      return;
    }

    if (!quantity.trim()) {
      setAddError("Lagyan ng quantity.");
      return;
    }

    if (!unit.trim()) {
      setAddError("Pumili ng unit.");
      return;
    }

    setIsAdding(true);

    // Optimistic UI — add immediately with a temp id
    const tempItem: PantryItem = {
      id: `temp-${Date.now()}`,
      name: trimmedName,
      quantity: quantity.trim(),
      category,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, tempItem]);

    try {
      const res = await fetch("/api/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
                              name: trimmedName,
                              quantity,
                              unit,
                              category,
                            }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Roll back optimistic update
        setItems((prev) => prev.filter((i) => i.id !== tempItem.id));
        setAddError(data.error ?? "Hindi naidagdag. Subukan ulit.");
        return;
      }

      // Replace temp item with real one from server
      setItems((prev) => prev.map((i) => (i.id === tempItem.id ? data : i)));

      // Reset form but keep it open for fast multi-add
      setName("");
      setQuantity("");
      setCategory("Others");
      nameInputRef.current?.focus();
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== tempItem.id));
      setAddError("Hindi naidagdag. I-check ang iyong koneksyon.");
    } finally {
      setIsAdding(false);
    }
  }

  // ── Delete item ─────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeletingIds((prev) => new Set(prev).add(id));

    // Optimistic removal
    const backup = items;
    setItems((prev) => prev.filter((i) => i.id !== id));

    try {
      const res = await fetch(`/api/pantry?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        // Roll back
        setItems(backup);
      }
    } catch {
      setItems(backup);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }
  // ── Group items by category ─────────────────────────────────────────────────
  const grouped = CATEGORIES.reduce<Record<string, PantryItem[]>>((acc, cat) => {
    const catItems = items.filter((i) => i.category === cat);
    if (catItems.length > 0) acc[cat] = catItems;
    return acc;
  }, {});

  useEffect(() => {
    if (!name.trim()) {
      setFilteredSuggestions([]);
      return;
    }

    const matches = QUICK_ADD_SUGGESTIONS.filter((item) =>
      item.toLowerCase().includes(name.toLowerCase())
    );

    setFilteredSuggestions(matches.slice(0, 5));
  }, [name]);

  // ── Quick add from suggestion ───────────────────────────────────────────────
  function quickAdd(suggestion: string) {
    setName(suggestion);
    setShowForm(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading) return <PageSkeleton />;
  if (!user) return null; // redirect in effect above

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-body font-semibold tracking-widest text-brand-rust uppercase mb-1">
            Iyong Pantry
          </p>
          <h1 className="font-display text-3xl font-bold text-brand-bark">
            Ano ang nasa bahay mo?
          </h1>
          <p className="text-sm font-body text-brand-smoke mt-1">
            {items.length === 0
              ? "Walang laman pa. Mag-dagdag ng ingredients."
              : `${items.length} ingredient${items.length !== 1 ? "s" : ""} ang naka-save.`}
          </p>
        </div>

        {/* Suggest CTA — only meaningful when pantry has items */}
        {items.length > 0 && (
          <Link
            href="/suggest"
            className="shrink-0 px-4 py-2.5 bg-brand-rust hover:bg-brand-silog text-white font-body font-semibold text-sm rounded-full transition-all active:scale-95 shadow-sm"
          >
            Mag-Suggest →
          </Link>
        )}
      </div>

      {/* ── Fetch error ── */}
      {fetchError && (
        <div className="mb-4 px-4 py-3 bg-brand-rust/10 border border-brand-rust/30 rounded-lg">
          <p className="text-sm font-body text-brand-rust">⚠ {fetchError}</p>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isFetching && <PantrySkeleton />}

      {/* ── Empty state ── */}
      {!isFetching && items.length === 0 && !fetchError && (
        <div className="text-center py-16 bg-brand-garlic border border-brand-rice rounded-2xl mb-6">
          <span className="text-5xl mb-4 block" aria-hidden="true">🧺</span>
          <p className="font-display text-xl font-bold text-brand-bark mb-2">
            Walang laman pa ang pantry mo
          </p>
          <p className="text-sm font-body text-brand-smoke mb-6 max-w-xs mx-auto">
            I-dagdag ang mga ingredients na mayroon ka ngayon para makapag-suggest ng ulam.
          </p>
          {/* Quick add suggestions */}
          <div className="flex flex-wrap justify-center gap-2 px-4">
            {QUICK_ADD_SUGGESTIONS.slice(0, 8).map((s) => (
              <button
                key={s}
                onClick={() => quickAdd(s)}
                className="px-3 py-1.5 bg-white border border-brand-rice text-brand-bark font-body text-xs rounded-full hover:border-brand-rust hover:text-brand-rust transition"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Pantry items grouped by category ── */}
      {!isFetching && Object.keys(grouped).length > 0 && (
        <div className="space-y-5 mb-6">
          {Object.entries(grouped).map(([cat, catItems]) => (
            <div key={cat} className="bg-brand-garlic border border-brand-rice rounded-2xl overflow-hidden">
              {/* Category header */}
              <div className="px-4 py-2.5 bg-brand-rice/60 border-b border-brand-rice flex items-center gap-2">
                <span aria-hidden="true">{CATEGORY_EMOJI[cat] ?? "🧺"}</span>
                <span className="text-xs font-body font-semibold tracking-widest text-brand-smoke uppercase">
                  {cat}
                </span>
                <span className="ml-auto text-xs text-brand-smoke/60 font-body">
                  {catItems.length}
                </span>
              </div>

              {/* Items */}
              <ul className="divide-y divide-brand-rice">
                {catItems.map((item) => (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between px-4 py-3 transition-opacity ${
                      deletingIds.has(item.id) ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-body font-medium text-brand-bark text-sm">
                        {item.name}
                      </span>
                      {item.quantity && (
                        <span className="ml-2 text-xs text-brand-smoke font-body">
                          {item.quantity}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingIds.has(item.id)}
                      className="ml-3 p-1.5 text-brand-smoke/50 hover:text-brand-rust hover:bg-brand-rust/10 rounded-lg transition disabled:cursor-not-allowed"
                      aria-label={`Tanggalin ang ${item.name}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ── Add ingredient form ── */}
      <div className="bg-brand-garlic border border-brand-rice rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3.5 font-body font-semibold text-sm text-brand-bark hover:bg-brand-rice/40 transition"
          aria-expanded={showForm}
        >
          <span className="flex items-center gap-2">
            <span className="text-brand-rust text-lg leading-none">+</span>
            Mag-dagdag ng ingredient
          </span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`text-brand-smoke transition-transform duration-200 ${showForm ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showForm && (
          <div className="border-t border-brand-rice px-4 py-4">
            <form onSubmit={handleAdd} noValidate className="space-y-3">
              <div className="flex gap-2">
                {/* Name — takes most space */}
                <div className="flex-1">
                  <label htmlFor="ing-name" className="block text-xs font-body font-semibold text-brand-bark mb-1">
                    Ingredient *
                  </label>
                  <input
                    ref={nameInputRef}
                    id="ing-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Garlic"
                    className="w-full px-3 py-2 rounded-lg border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:border-brand-rust focus:outline-none transition"
                    autoComplete="off"
                  />
                </div>
                {/* Quantity — smaller */}
                <div className="w-28">
                  <label htmlFor="ing-qty" className="block text-xs font-body font-semibold text-brand-bark mb-1">
                    Quantity
                  </label>
                  <input
                    id="ing-qty"
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 3 pcs"
                    className="w-full px-3 py-2 rounded-lg border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm placeholder:text-brand-smoke/50 focus:border-brand-rust focus:outline-none transition"
                    autoComplete="off"
                  />
                  {filteredSuggestions.length > 0 && (
                    <div className="mt-2 rounded-xl border bg-white shadow-sm overflow-hidden">
                      {filteredSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setName(suggestion);
                            setFilteredSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-brand-cream"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3"
                  >
                    <option value="">Select unit</option>
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="ml">ml</option>
                    <option value="cups">cups</option>
                    <option value="tbsp">tbsp</option>
                    <option value="tsp">tsp</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label htmlFor="ing-cat" className="block text-xs font-body font-semibold text-brand-bark mb-1">
                  Category
                </label>
                <select
                  id="ing-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-smoke/30 bg-white text-brand-bark font-body text-sm focus:border-brand-rust focus:outline-none transition"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_EMOJI[c]} {c}</option>
                  ))}
                </select>
              </div>

              {addError && (
                <p role="alert" className="text-xs font-body text-brand-rust font-medium">
                  ⚠ {addError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 py-2.5 bg-brand-rust hover:bg-brand-silog disabled:opacity-60 disabled:cursor-not-allowed text-white font-body font-semibold text-sm rounded-lg transition-all active:scale-95"
                >
                  {isAdding ? "Nagse-save…" : "I-dagdag"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setAddError(""); setName(""); setQuantity(""); setCategory("Others"); }}
                  className="px-4 py-2.5 border border-brand-smoke/30 text-brand-smoke font-body text-sm rounded-lg hover:bg-brand-rice transition"
                >
                  Kanselahin
                </button>
              </div>
            </form>

            {/* Quick add chips inside form */}
            {!name && (
              <div className="mt-3 pt-3 border-t border-brand-rice">
                <p className="text-xs font-body text-brand-smoke/60 mb-2">Mabilis na dagdag:</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ADD_SUGGESTIONS.filter(
                    (s) => !items.some((i) => i.name.toLowerCase() === s.toLowerCase())
                  ).slice(0, 10).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setName(s)}
                      className="px-2.5 py-1 bg-white border border-brand-rice text-brand-bark font-body text-xs rounded-full hover:border-brand-rust hover:text-brand-rust transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom CTA when pantry has items ── */}
      {items.length >= 3 && (
        <div className="mt-6 p-4 bg-brand-rust/10 border border-brand-rust/20 rounded-2xl flex items-center justify-between gap-4">
          <div>
            <p className="font-body font-semibold text-brand-bark text-sm">
              Handa ka na!
            </p>
            <p className="font-body text-xs text-brand-smoke mt-0.5">
              May {items.length} ingredients ka — tingnan ang pwedeng ulam.
            </p>
          </div>
          <Link
            href="/suggest"
            className="shrink-0 px-4 py-2 bg-brand-rust hover:bg-brand-silog text-white font-body font-semibold text-sm rounded-full transition-all active:scale-95"
          >
            Mag-Suggest →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Loading skeletons ─────────────────────────────────────────────────────────

function PantrySkeleton() {
  return (
    <div className="space-y-4 mb-6 animate-pulse">
      {[1, 2].map((i) => (
        <div key={i} className="bg-brand-garlic border border-brand-rice rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-brand-rice/60 h-9" />
          <div className="divide-y divide-brand-rice">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 h-4 bg-brand-rice rounded" />
                <div className="w-8 h-8 bg-brand-rice rounded-lg" />
              </div>
            ))}
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
      <PantrySkeleton />
    </div>
  );
}
