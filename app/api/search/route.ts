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
  const limitParam = Number(searchParams.get("limit") ?? "8");
  const limit = Number.isFinite(limitParam)
    ? Math.min(10, Math.max(3, Math.floor(limitParam)))
    : 8;

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

  const prompt = `Give me ${limit} Filipino dish variants related to "${dish}".

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
- Real Filipino dishes only
- ingredient "name" field: ALWAYS in English (e.g. "Garlic" not "Bawang", "Eggs" not "Itlog", "Onion" not "Sibuyas", "Salt" not "Asin", "Vinegar" not "Suka", "Soy sauce" not "Toyo", "Cooking oil" not "Mantika", "Pork" not "Baboy", "Chicken" not "Manok", "Rice" not "Kanin/Bigas")
- description: 1 sentence in Filipino/Taglish
- estimatedCostPHP: realistic Philippine market price for all ingredients
- calories: per serving estimate
- ingredients: include amount as a string (e.g. "3 cloves", "1/2 cup", "200g")
- steps: numbered from 1, instruction in Filipino/Taglish is fine
- timerMinutes: 0 if no waiting time, otherwise the number of minutes to wait/cook
- Keep steps practical and clear for everyday Filipino cooking
- Keep steps concise (max 5 steps per dish)
- Return exactly ${limit} variants (e.g. Pork Adobo, Chicken Adobo, Adobong Kangkong for "Adobo")`;

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
            temperature: 0.5,
            maxOutputTokens: 8192,
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

  const validated = (results as RawResult[]).slice(0, limit).map((r) => ({
    name: String(r.name ?? "Unknown"),
    description: String(r.description ?? ""),
    servings: typeof r.servings === "number" ? Math.max(1, r.servings) : 4,
    estimatedCostPHP:
      typeof r.estimatedCostPHP === "number" ? Math.max(0, Math.round(r.estimatedCostPHP)) : 0,
    calories:
      typeof r.calories === "number" ? Math.max(0, Math.round(r.calories)) : 0,
    ingredients: Array.isArray(r.ingredients)
      ? (r.ingredients as unknown[]).map((ing: unknown) => {
          const i = ing as Record<string, unknown>;
          return {
            name: String(i.name ?? ""),
            amount: String(i.amount ?? ""),
          } as Ingredient;
        }).filter((i) => i.name)
      : [],
    steps: Array.isArray(r.steps)
      ? (r.steps as unknown[]).map((st: unknown, idx: number) => {
          const s = st as Record<string, unknown>;
          return {
            step: typeof s.step === "number" ? s.step : idx + 1,
            instruction: String(s.instruction ?? ""),
            timerMinutes:
              typeof s.timerMinutes === "number" ? Math.max(0, s.timerMinutes) : 0,
          } as Step;
        }).filter((s) => s.instruction)
      : [],
  }));

  return NextResponse.json({ results: validated });
}
