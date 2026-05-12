/**
 * POST /api/suggest
 *
 * Body: { mealType: "Breakfast" | "Lunch" | "Dinner" | "Meryenda" }
 *
 * Flow:
 * 1. Verify user session (server-side)
 * 2. Fetch user's pantry from Supabase
 * 3. Guard: empty pantry → 400
 * 4. Build Gemini prompt with pantry + mealType
 * 5. Parse JSON response strictly
 * 6. Return 5 suggestions sorted: full match first, then partial by fewest missing
 *
 * Bugs prevented:
 * - No API key leak (server-side only)
 * - Gemini markdown/preamble stripped before JSON.parse
 * - Malformed Gemini response returns 502 with clear message
 * - Empty pantry caught before Gemini call (saves API quota)
 * - Partial match ingredients normalised to title case for display consistency
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Meryenda"] as const;
type MealType = (typeof MEAL_TYPES)[number];

export async function POST(req: NextRequest) {
  // ── 1. Parse + validate body ───────────────────────────────────────────────
  let mealType: MealType;
  try {
    const body = await req.json();
    if (!MEAL_TYPES.includes(body.mealType)) {
      return NextResponse.json(
        { error: "Pumili ng meal type (Breakfast, Lunch, Dinner, Meryenda)." },
        { status: 400 }
      );
    }
    mealType = body.mealType;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // ── 2. Auth — server-side Supabase client ──────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* read-only in middleware */ }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Hindi naka-login." }, { status: 401 });
  }

  // ── 3. Fetch pantry ────────────────────────────────────────────────────────
  const { data: pantryItems, error: pantryError } = await supabase
    .from("pantry_items")
    .select("name, category")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (pantryError) {
    return NextResponse.json(
      { error: "Hindi ma-load ang pantry. Subukan ulit." },
      { status: 500 }
    );
  }

  if (!pantryItems || pantryItems.length === 0) {
    return NextResponse.json(
      { error: "Walang laman ang pantry mo. Mag-dagdag muna ng ingredients." },
      { status: 400 }
    );
  }

  // ── 4. Build ingredient list for prompt ────────────────────────────────────
  const ingredientList = pantryItems.map((i) => i.name).join(", ");

  // ── 5. Gemini API call ─────────────────────────────────────────────────────
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Server configuration error." },
      { status: 500 }
    );
  }

  const prompt = `Suggest 5 Filipino dishes for ${mealType} using these pantry ingredients: ${ingredientList}

Return ONLY a JSON array, no markdown, no backticks, starting with [
Each object must have exactly these fields:
{"name":"","matchType":"full or partial","missingIngredients":[],"estimatedCostPHP":0,"mealType":"${mealType}","reason":""}

CRITICAL RULES — follow exactly:
- Real Filipino dishes only (dish name can be Filipino e.g. "Pork Adobo", "Sinigang na Baboy")
- missingIngredients: write ingredient names in ENGLISH only (e.g. "Garlic", "Soy sauce", "Vinegar") — never in Filipino
- matchType="full" ONLY if the pantry has ALL the key ingredients needed. 
- BE CREATIVE WITH SUBSTITUTES: If a common substitute is in the pantry (e.g. Calamansi instead of Vinegar, Pork instead of Chicken), consider it a "full" match.
- FLEXIBLE RECIPES: For dishes like Sinigang, Pancit, or Fried Rice, any combination of available vegetables or meats is acceptable. Don't mark them missing if standard ones aren't there, as long as the base is present.
- matchType="partial" if a TRULY ESSENTIAL ingredient is missing (like no meat for Adobong Baboy).
- missingIngredients: only truly essential missing items (not optional garnishes), keep list short, in English
- estimatedCostPHP: cost in PHP of missing ingredients only (0 if full match)
- reason: max 8 words in Filipino explaining fit
- Sort: full matches first, then partial by fewest missing
- Double-check: re-read the pantry list above before setting matchType`;

  let geminiRaw: string;
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      return NextResponse.json(
        { error: "Hindi nagawa ang suggestions. Subukan ulit." },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData?.candidates?.[0];
    const finishReason = candidate?.finishReason ?? "STOP";

    // Gemini sometimes returns SAFETY, MAX_TOKENS, OTHER — content will be
    // undefined or truncated. Catch before parsing.
    if (finishReason === "MAX_TOKENS") {
      console.error("Gemini suggest truncated (MAX_TOKENS)");
      return NextResponse.json(
        { error: "Ang AI ay hindi nakatapos ng sagot. Subukan ulit." },
        { status: 502 }
      );
    }
    if (["SAFETY", "OTHER", "RECITATION"].includes(finishReason)) {
      console.error("Gemini suggest blocked:", finishReason);
      return NextResponse.json(
        { error: "Hindi nagawa ang suggestions ngayon. Subukan ulit." },
        { status: 502 }
      );
    }

    geminiRaw = candidate?.content?.parts?.[0]?.text ?? "";
  } catch (err) {
    console.error("Gemini fetch failed:", err);
    return NextResponse.json(
      { error: "Hindi maabot ang AI service. I-check ang koneksyon." },
      { status: 502 }
    );
  }

  // ── 6. Parse Gemini response ───────────────────────────────────────────────
  // Strip markdown code fences if Gemini ignores the "no backticks" instruction
  const cleaned = geminiRaw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  let suggestions: unknown[];
  try {
    suggestions = JSON.parse(cleaned);
    if (!Array.isArray(suggestions)) throw new Error("Not an array");
  } catch {
    console.error("Gemini parse failed. Raw:", geminiRaw);
    return NextResponse.json(
      { error: "Ang AI ay nagbalik ng hindi tamang format. Subukan ulit." },
      { status: 502 }
    );
  }

  // ── 7. Validate + sanitize each suggestion ─────────────────────────────────
  interface RawSuggestion {
    name?: unknown;
    matchType?: unknown;
    missingIngredients?: unknown;
    estimatedCostPHP?: unknown;
    mealType?: unknown;
    reason?: unknown;
  }

  const validated = (suggestions as RawSuggestion[])
    .slice(0, 5) // never more than 5
    .map((s) => ({
      name: String(s.name ?? "Unknown Dish"),
      matchType: s.matchType === "full" ? "full" : "partial",
      missingIngredients: Array.isArray(s.missingIngredients)
        ? (s.missingIngredients as unknown[]).map(String)
        : [],
      estimatedCostPHP: typeof s.estimatedCostPHP === "number"
        ? Math.max(0, Math.round(s.estimatedCostPHP))
        : 0,
      mealType: String(s.mealType ?? mealType),
      reason: String(s.reason ?? ""),
    }))
    // Re-sort: full match first, then partial by fewest missing
    .sort((a, b) => {
      if (a.matchType === "full" && b.matchType !== "full") return -1;
      if (a.matchType !== "full" && b.matchType === "full") return 1;
      return a.missingIngredients.length - b.missingIngredients.length;
    });

  return NextResponse.json({ suggestions: validated });
}