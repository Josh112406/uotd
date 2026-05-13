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

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Filipino ↔ English dictionary ─────────────────────────────────────────────
// Each entry maps one language to the other.
// Keys are lowercase. Values are arrays to handle multiple forms.

const FIL_TO_ENG: Record<string, string[]> = {
  // Proteins (Meats)
  "baboy": ["pork"],
  "liempo": ["pork belly", "pork"],
  "manok": ["chicken"],
  "karne": ["meat", "beef"],
  "baka": ["beef"],
  "itlog": ["egg", "eggs"],
  "giniling": ["ground pork", "ground beef", "ground meat", "minced meat"],
  "atay": ["liver", "pork liver", "chicken liver", "beef liver"],
  "hotdog": ["hotdog", "sausage", "hotdogs"],
  "tocino": ["tocino", "sweet cured pork"],
  "longganisa": ["longganisa", "filipino sausage"],
  "tapa": ["tapa", "cured beef", "beef tapa"],
  "tokwa": ["tofu", "firm tofu"],
  "tuwalya": ["beef tripe", "tripe"],
  "pata": ["pork hock", "pork knuckle", "pata"],
  "tadyang": ["ribs", "beef ribs", "pork ribs", "spare ribs"],
  "chorizo": ["chorizo", "spanish sausage"],
  "bacon": ["bacon"],
  
  // Seafood
  "isda": ["fish"],
  "hipon": ["shrimp", "prawns"],
  "bangus": ["milkfish", "bangus"],
  "tilapia": ["tilapia"],
  "galunggong": ["scad", "round scad", "galunggong"],
  "pusit": ["squid"],
  "tahong": ["mussels"],
  "talaba": ["oysters"],
  "alimango": ["crab", "mud crab"],
  "alimasag": ["crab", "blue crab"],
  "tuyo": ["dried fish", "salted fish"],
  "daing": ["dried fish"],
  "tinapa": ["smoked fish"],
  "alamang": ["krill", "small shrimp", "alamang"],
  "lapu-lapu": ["grouper", "lapu-lapu"],
  "maya-maya": ["snapper", "red snapper"],
  "tulingan": ["mackerel tuna", "tulingan"],
  "tambakol": ["yellowfin tuna", "tambakol"],

  // Vegetables
  "sibuyas": ["onion", "onions", "red onion", "white onion"],
  "kamatis": ["tomato", "tomatoes"],
  "luya": ["ginger"],
  "dahon ng laurel": ["bay leaf", "bay leaves"],
  "kangkong": ["water spinach", "kangkong"],
  "pechay": ["bok choy", "chinese cabbage", "pechay"],
  "sitaw": ["string beans", "green beans", "yardlong beans"],
  "talong": ["eggplant", "aubergine"],
  "ampalaya": ["bitter melon", "bitter gourd"],
  "patola": ["luffa", "sponge gourd"],
  "sayote": ["chayote"],
  "gabi": ["taro"],
  "kamote": ["sweet potato"],
  "kalabasa": ["squash", "pumpkin"],
  "gulay": ["vegetables", "veggies"],
  "repolyo": ["cabbage"],
  "karot": ["carrot", "carrots"],
  "patatas": ["potato", "potatoes"],
  "siling labuyo": ["bird's eye chili", "chili", "chili pepper", "red chili"],
  "siling haba": ["green chili", "finger chili", "long green pepper"],
  "bataw": ["hyacinth bean"],
  "sigarilyas": ["winged bean"],
  "malunggay": ["moringa", "moringa leaves"],
  "monggo": ["mung beans", "munggo", "green gram"],
  "labong": ["bamboo shoots"],
  "puso ng saging": ["banana blossom", "banana heart"],
  "upo": ["bottle gourd", "calabash"],
  "mustasa": ["mustard greens", "mustard leaves"],
  "chicharo": ["snow peas", "snap peas", "chicharo"],
  "togue": ["bean sprouts", "mung bean sprouts", "togue"],
  "saluyot": ["jute leaves", "saluyot"],
  "alugbati": ["malabar spinach", "alugbati"],

  // Spices & Condiments
  "bawang": ["garlic"],
  "asin": ["salt"],
  "paminta": ["pepper", "black pepper", "ground pepper", "peppercorns"],
  "asukal": ["sugar", "brown sugar", "white sugar"],
  "toyo": ["soy sauce"],
  "suka": ["vinegar", "white vinegar", "cane vinegar", "coconut vinegar"],
  "patis": ["fish sauce"],
  "bagoong": ["shrimp paste", "fermented shrimp", "bagoong alamang", "bagoong isda"],
  "mantika": ["cooking oil", "oil", "vegetable oil", "canola oil"],
  "achuete": ["annatto", "atsuete"],
  "atsuete": ["annatto", "achuete"],
  "dahon ng pandan": ["pandan leaves", "pandan"],
  "ketchup": ["ketchup", "catsup", "tomato ketchup", "banana ketchup"],
  "mayonnaise": ["mayonnaise", "mayo"],
  "oyster sauce": ["oyster sauce"],
  "magic sarap": ["magic sarap", "seasoning granules", "msg", "flavor enhancer"],
  "ginisa mix": ["ginisa mix", "seasoning mix"],
  "sinigang mix": ["sinigang mix", "tamarind soup base", "tamarind powder"],
  "tomato paste": ["tomato paste"],
  "tomato sauce": ["tomato sauce"],
  "lechon sauce": ["lechon sauce", "sarsa", "mang tomas"],
  "wansoy": ["cilantro", "coriander leaves"],
  "kinchay": ["celery", "chinese celery"],
  "star anise": ["star anise"],
  "sesame oil": ["sesame oil"],
  "hoisin sauce": ["hoisin sauce"],
  "chili oil": ["chili oil"],
  "vetsin": ["msg", "monosodium glutamate", "vetsin"],

  // Grains, Noodles & Staples
  "kanin": ["rice", "cooked rice", "day-old rice"],
  "bigas": ["rice", "uncooked rice"],
  "harina": ["flour", "all-purpose flour"],
  "cornstarch": ["cornstarch", "corn starch"],
  "pancit bihon": ["bihon", "rice noodles", "rice sticks"],
  "pancit canton": ["canton noodles", "egg noodles"],
  "sotanghon": ["sotanghon", "glass noodles", "cellophane noodles"],
  "misua": ["misua", "wheat noodles", "fine noodles"],
  "miki": ["miki noodles", "fresh egg noodles"],
  "lumpia wrapper": ["lumpia wrapper", "spring roll wrapper", "crepe wrapper"],
  "tinapay": ["bread", "tasty bread", "sliced bread", "pandesal"],
  "macaroni": ["macaroni", "elbow macaroni"],
  "spaghetti": ["spaghetti", "spaghetti noodles", "pasta"],

  // Canned Goods
  "corned beef": ["corned beef"],
  "sardinas": ["sardines", "canned sardines"],
  "tuna": ["canned tuna", "tuna flakes"],
  "spam": ["spam", "luncheon meat", "meat loaf"],
  "vienna sausage": ["vienna sausage"],
  "pork and beans": ["pork and beans", "baked beans"],

  // Liquids
  "tubig": ["water"],
  "gata": ["coconut milk", "coconut cream"],
  "calamansi": ["calamansi", "lime", "lemon", "calamansi juice"],
  "sabaw": ["broth", "stock", "soup", "water"],

  // Dairy & Eggs
  "gatas": ["milk", "evaporated milk", "condensed milk", "fresh milk"],
  "mantikilya": ["butter"],
  "keso": ["cheese", "cheddar cheese", "processed cheese", "eden cheese"],
  "itlog na maalat": ["salted egg", "salted duck egg"],
  "margarine": ["margarine", "star margarine"],
  "crema": ["cream", "all-purpose cream", "nestle cream", "heavy cream", "table cream"],

  // Fruits (often used in cooking)
  "saging": ["banana", "saba banana", "plantain"],
  "langka": ["jackfruit", "young jackfruit"],
  "pinya": ["pineapple", "pineapple chunks"],
  "mangga": ["mango", "green mango"],
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

  // Use word boundaries to avoid false positives (e.g. "a" matching everything)
  const regex = new RegExp(`\\b${escapeRegExp(lower)}\\b`);

  // Check Filipino → English
  for (const [fil, engList] of Object.entries(FIL_TO_ENG)) {
    const filRegex = new RegExp(`\\b${escapeRegExp(fil)}\\b`);
    if (filRegex.test(lower) || regex.test(fil)) {
      engList.forEach((e) => equivalents.add(e));
      equivalents.add(fil);
    }
  }

  // Check English → Filipino
  for (const [eng, filList] of Object.entries(ENG_TO_FIL)) {
    const engRegex = new RegExp(`\\b${escapeRegExp(eng)}\\b`);
    if (engRegex.test(lower) || regex.test(eng)) {
      filList.forEach((f) => equivalents.add(f));
      equivalents.add(eng);
    }
  }

  return Array.from(equivalents);
}

// ── Main match function ────────────────────────────────────────────────────────

/**
 * Returns true if pantryItem and ingredientName refer to the same ingredient.
 * Handles: exact match, fuzzy substring with word boundaries, and Filipino↔English translation.
 */
export function ingredientMatches(pantryItem: string, ingredientName: string): boolean {
  const pantryLower = pantryItem.toLowerCase().trim();
  const ingLower = ingredientName.toLowerCase().trim();

  // Layer 1: Exact match
  if (pantryLower === ingLower) return true;

  // Helper for word-boundary matching
  const hasWord = (str: string, word: string) => new RegExp(`\\b${escapeRegExp(word)}\\b`).test(str);

  // Layer 2: Bidirectional substring (handles "Cane Vinegar" vs "Vinegar")
  // Use word boundaries to prevent "egg" matching "eggplant"
  if (hasWord(pantryLower, ingLower) || hasWord(ingLower, pantryLower)) return true;

  // Layer 3: Dictionary — get all equivalents for both sides, then cross-check
  const pantryEquivs = getEquivalents(pantryLower);
  const ingEquivs = getEquivalents(ingLower);

  for (const pe of pantryEquivs) {
    for (const ie of ingEquivs) {
      if (pe === ie) return true;
      if (hasWord(pe, ie) || hasWord(ie, pe)) return true;
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
