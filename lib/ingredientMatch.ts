/**
 * ingredientMatch.ts
 *
 * Shared utility for pantry cross-checking.
 *
 * Problem it solves:
 * - User types "Eggs" in pantry, Gemini writes "Itlog" in recipe → no match
 * - User types "Bawang" in pantry, Gemini writes "Garlic" in recipe → no match
 * - User types "Vinegar", Gemini writes "Cane Vinegar" → fuzzy handles this
 *
 * Three-layer matching:
 * 1. Exact lowercase match (fastest, handles identical strings)
 * 2. Bidirectional includes (handles "Cane Vinegar" vs "Vinegar")
 * 3. Filipino↔English dictionary lookup (handles language mismatch)
 *
 * Only covers the ~30 most common Filipino cooking ingredients.
 * Covers both directions: Filipino→English and English→Filipino.
 */

// ── Filipino ↔ English dictionary ─────────────────────────────────────────────
// Each entry maps one language to the other.
// Keys are lowercase. Values are arrays to handle multiple forms.

const FIL_TO_ENG: Record<string, string[]> = {
  // Proteins
  "baboy": ["pork"],
  "liempo": ["pork belly", "pork"],
  "manok": ["chicken"],
  "isda": ["fish"],
  "hipon": ["shrimp", "prawns"],
  "karne": ["meat", "beef"],
  "baka": ["beef"],
  "itlog": ["egg", "eggs"],

  // Vegetables
  "sibuyas": ["onion", "onions"],
  "kamatis": ["tomato", "tomatoes"],
  "luya": ["ginger"],
  "dahon ng laurel": ["bay leaf", "bay leaves"],
  "kangkong": ["water spinach", "kangkong"],
  "pechay": ["bok choy", "chinese cabbage"],
  "sitaw": ["string beans", "green beans"],
  "talong": ["eggplant"],
  "ampalaya": ["bitter melon", "bitter gourd"],
  "patola": ["luffa", "sponge gourd"],
  "sayote": ["chayote"],
  "gabi": ["taro"],
  "kamote": ["sweet potato"],
  "kalabasa": ["squash", "pumpkin"],
  "gulay": ["vegetables", "veggies"],

  // Spices & Condiments
  "bawang": ["garlic"],
  "asin": ["salt"],
  "paminta": ["pepper", "black pepper", "ground pepper"],
  "asukal": ["sugar"],
  "toyo": ["soy sauce"],
  "suka": ["vinegar"],
  "patis": ["fish sauce"],
  "bagoong": ["shrimp paste", "fermented shrimp"],
  "mantika": ["cooking oil", "oil", "vegetable oil"],
  "achuete": ["annatto", "atsuete"],
  "atsuete": ["annatto", "achuete"],
  "dahon ng pandan": ["pandan leaves", "pandan"],

  // Grains & Staples
  "kanin": ["rice", "cooked rice", "day-old rice"],
  "bigas": ["rice", "uncooked rice"],
  "harina": ["flour", "all-purpose flour"],
  "cornstarch": ["cornstarch", "corn starch"],

  // Liquids
  "tubig": ["water"],
  "gata": ["coconut milk"],
  "calamansi": ["calamansi", "lime", "lemon"],

  // Dairy & Eggs
  "gatas": ["milk"],
  "mantikilya": ["butter"],
};

// Build reverse map: English → Filipino
const ENG_TO_FIL: Record<string, string[]> = {};
for (const [fil, engList] of Object.entries(FIL_TO_ENG)) {
  for (const eng of engList) {
    if (!ENG_TO_FIL[eng]) ENG_TO_FIL[eng] = [];
    ENG_TO_FIL[eng].push(fil);
  }
}

// ── Get all equivalent terms for a given ingredient string ────────────────────

function getEquivalents(term: string): string[] {
  const lower = term.toLowerCase().trim();
  const equivalents = new Set<string>([lower]);

  // Check Filipino → English
  for (const [fil, engList] of Object.entries(FIL_TO_ENG)) {
    if (lower.includes(fil) || fil.includes(lower)) {
      engList.forEach((e) => equivalents.add(e));
      equivalents.add(fil);
    }
  }

  // Check English → Filipino
  for (const [eng, filList] of Object.entries(ENG_TO_FIL)) {
    if (lower.includes(eng) || eng.includes(lower)) {
      filList.forEach((f) => equivalents.add(f));
      equivalents.add(eng);
    }
  }

  return Array.from(equivalents);
}

// ── Main match function ────────────────────────────────────────────────────────

/**
 * Returns true if pantryItem and ingredientName refer to the same ingredient.
 * Handles: exact match, fuzzy substring, and Filipino↔English translation.
 */
export function ingredientMatches(pantryItem: string, ingredientName: string): boolean {
  const pantryLower = pantryItem.toLowerCase().trim();
  const ingLower = ingredientName.toLowerCase().trim();

  // Layer 1: Exact match
  if (pantryLower === ingLower) return true;

  // Layer 2: Bidirectional substring (handles "Cane Vinegar" vs "Vinegar")
  if (pantryLower.includes(ingLower) || ingLower.includes(pantryLower)) return true;

  // Layer 3: Dictionary — get all equivalents for both sides, then cross-check
  const pantryEquivs = getEquivalents(pantryLower);
  const ingEquivs = getEquivalents(ingLower);

  for (const pe of pantryEquivs) {
    for (const ie of ingEquivs) {
      if (pe === ie) return true;
      if (pe.includes(ie) || ie.includes(pe)) return true;
    }
  }

  return false;
}

/**
 * Check if an ingredient name is found in a list of pantry items.
 * Returns:
 *   true  — found in pantry
 *   false — not found in pantry
 *   null  — pantry not loaded yet
 */
export function inPantry(
  ingredientName: string,
  pantryItems: { name: string }[] | null
): boolean | null {
  if (pantryItems === null) return null;
  return pantryItems.some((p) => ingredientMatches(p.name, ingredientName));
}

/**
 * Count how many ingredients from a recipe are missing from the pantry.
 * Returns null if pantry not loaded yet.
 */
export function countMissing(
  ingredients: { name: string }[],
  pantryItems: { name: string }[] | null
): number | null {
  if (pantryItems === null) return null;
  return ingredients.filter((ing) => !inPantry(ing.name, pantryItems)).length;
}
