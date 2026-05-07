/**
 * GET /api/search?dish=Pork+Adobo
 *
 * Flow:
 * 1. Validate query — empty/whitespace rejected server-side
 * 2. Call Gemini — returns 3 dish variants as JSON
 * 3. Strip markdown fences before parsing
 * 4. Return validated array of results
 *
 * Bugs prevented:
 * - Empty query caught server-side (not just client-side)
 * - Gemini markdown fences stripped before JSON.parse
 * - Truncated response → clear 502 with log, not a crash
 * - API key never exposed to client (server route only)
 * - Each result validated/sanitised before returning
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dish = (searchParams.get("dish") ?? "").trim();
  const limitParam = Number(searchParams.get("limit") ?? "6");
  const limit = Number.isFinite(limitParam)
    ? Math.min(6, Math.max(3, Math.floor(limitParam)))
    : 6;

  if (!dish) {
    return NextResponse.json(
      { error: "Walang dish name na ibinigay." },
      { status: 400 }
    );
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const prompt = `Give me ${limit} Filipino dishes related to "${dish}".

Return ONLY a JSON array, no markdown, no backticks, no preamble, starting with [
Each object must have exactly these fields:
{
  "name": "full dish name in English or Filipino (e.g. Pork Adobo, Sinigang na Baboy)",
  "description": "one sentence description in Filipino/Taglish",
  "servings": 4,
  "estimatedCostPHP": 150,
  "calories": 320,
  "ingredients": [
    { "name": "ingredient name in ENGLISH", "amount": "1 cup" }
  ],
  "steps": [
    { "step": 1, "instruction": "instruction in Filipino/Taglish", "timerMinutes": 0 }
  ]
}

CRITICAL RULES — follow exactly:
- Real Filipino dishes only (common in the Philippines)
- Exclude foreign dishes, fusion, and made-up names
- ingredient "name" field: ALWAYS in English (e.g. "Garlic" not "Bawang", "Eggs" not "Itlog", "Onion" not "Sibuyas", "Salt" not "Asin", "Vinegar" not "Suka", "Soy sauce" not "Toyo", "Cooking oil" not "Mantika", "Pork" not "Baboy", "Chicken" not "Manok", "Rice" not "Kanin/Bigas")
- description: 1 sentence in Filipino/Taglish
- estimatedCostPHP: realistic Philippine market price for all ingredients
- calories: per serving estimate
- ingredients: include amount as a string (e.g. "3 cloves", "1/2 cup", "200g")
- steps: 6-8 steps, numbered from 1, 1 sentence each, more detailed cooking method
- timerMinutes: 0 if no waiting time, otherwise the number of minutes to wait/cook
- Keep steps practical and clear for everyday Filipino cooking
- Return exactly ${limit} dishes`;

  let geminiRaw = "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini search error:", errText);
      return NextResponse.json(
        { error: "Hindi nagawa ang search. Subukan ulit." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason ?? "STOP";

    if (finishReason === "MAX_TOKENS") {
      console.error("Gemini search truncated (MAX_TOKENS)");
      return NextResponse.json(
        { error: "Ang AI ay hindi nakatapos ng sagot. Subukan ulit." },
        { status: 502 }
      );
    }
    if (["SAFETY", "OTHER", "RECITATION"].includes(finishReason)) {
      console.error("Gemini search blocked:", finishReason);
      return NextResponse.json(
        { error: "Hindi nagawa ang search ngayon. Subukan ulit." },
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

  // Strip markdown fences
  const cleaned = geminiRaw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  let results: unknown[];
  try {
    results = JSON.parse(cleaned);
    if (!Array.isArray(results)) throw new Error("Not array");
  } catch {
    console.error("Gemini search parse failed. Raw:", geminiRaw);
    return NextResponse.json(
      { error: "Ang AI ay nagbalik ng hindi tamang format. Subukan ulit." },
      { status: 502 }
    );
  }

  // Validate and sanitise each result
  interface RawResult {
    name?: unknown;
    description?: unknown;
    servings?: unknown;
    estimatedCostPHP?: unknown;
    calories?: unknown;
    ingredients?: unknown;
    steps?: unknown;
  }

  interface Ingredient { name: string; amount: string; }
  interface Step { step: number; instruction: string; timerMinutes: number; }

  const FILIPINO_KEYWORDS = [
    "adobo", "sinigang", "tinola", "kare-kare", "karekare", "menudo",
    "kaldereta", "afritada", "mechado", "paksiw", "pinakbet", "pinakbet",
    "sisig", "bicol", "laing", "giniling", "tortang", "torta", "inihaw",
    "inihaw", "inasal", "nilaga", "bulalo", "pochero", "pancit", "lumpia",
    "tokwa", "ginataan", "lechon", "dinuguan", "kwek-kwek", "batchoy",
    "arroz", "lugaw", "goto", "sopas", "palabok", "canton", "mami",
    "kansi", "sarsa", "kinalas", "molo", "kadyos", "sinampalukang",
    "kansi", "kare", "kilaw", "kinilaw", "sinigang", "bulanglang"
  ];

  const BANLIST = [
    "ramen", "sushi", "pizza", "pasta", "spaghetti", "lasagna", "burger",
    "taco", "burrito", "shawarma", "kebab", "pho", "risotto", "curry",
    "naan", "ramyun", "paella", "bibimbap", "kimchi"
  ];

  const queryLower = dish.toLowerCase();

  function normalizeText(input: string): string {
    return input.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function isLikelyFilipinoDish(name: string): boolean {
    const normalized = normalizeText(name);
    if (!normalized) return false;
    if (BANLIST.some((bad) => normalized.includes(bad))) return false;
    if (queryLower && normalized.includes(queryLower)) return true;
    return FILIPINO_KEYWORDS.some((kw) => normalized.includes(kw));
  }

  const normalizedResults = (results as RawResult[]).map((r) => {
    const name = String(r.name ?? "").trim();
    const description = String(r.description ?? "").trim();
    const ingredients = Array.isArray(r.ingredients)
      ? (r.ingredients as unknown[])
          .map((ing: unknown) => {
            const i = ing as Record<string, unknown>;
            return {
              name: String(i.name ?? "").trim(),
              amount: String(i.amount ?? "").trim(),
            } as Ingredient;
          })
          .filter((i) => i.name)
          .slice(0, 15)
      : [];

    const steps = Array.isArray(r.steps)
      ? (r.steps as unknown[])
          .map((st: unknown, idx: number) => {
            const s = st as Record<string, unknown>;
            return {
              step: typeof s.step === "number" ? s.step : idx + 1,
              instruction: String(s.instruction ?? "").trim(),
              timerMinutes:
                typeof s.timerMinutes === "number" ? Math.max(0, s.timerMinutes) : 0,
            } as Step;
          })
          .filter((s) => s.instruction)
          .slice(0, 8)
      : [];

    return {
      name,
      description,
      servings: typeof r.servings === "number" ? Math.max(1, r.servings) : 4,
      estimatedCostPHP:
        typeof r.estimatedCostPHP === "number" ? Math.max(0, Math.round(r.estimatedCostPHP)) : 0,
      calories:
        typeof r.calories === "number" ? Math.max(0, Math.round(r.calories)) : 0,
      ingredients,
      steps,
    };
  });

  const filtered = normalizedResults
    .filter((r) => r.name && r.ingredients.length > 0 && r.steps.length >= 4)
    .filter((r) => isLikelyFilipinoDish(r.name))
    .slice(0, limit);

  return NextResponse.json({ results: filtered });
}
