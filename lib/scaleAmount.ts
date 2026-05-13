/**
 * scaleAmount — scales a recipe ingredient amount string by a ratio
 *
 * Handles:
 * - Whole numbers:        "3 cloves"      × 2   → "6 cloves"
 * - Simple fractions:     "1/2 cup"       × 2   → "1 cup"
 * - Mixed numbers:        "1 1/2 cups"    × 2   → "3 cups"
 * - Decimals:             "0.5 kg"        × 3   → "1.5 kg"
 * - Ranges:               "2-3 pieces"    × 2   → "4-6 pieces"
 * - No number at all:     "to taste"      → "to taste" (unchanged)
 * - "pinch of X":         → unchanged
 * - Numbers with g/kg/ml: "200g"          × 1.5 → "300g"
 *
 * Returns a clean, human-readable string — no ugly decimals like 0.3333
 */

// Convert a fraction string like "1/2" to a decimal
function fractionToDecimal(str: string): number {
  const parts = str.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
  }
  return NaN;
}

// Format a decimal back to a human-readable fraction or whole number
function formatNumber(n: number): string {
  if (n === 0) return "0";

  // Whole number
  if (Number.isInteger(n)) return String(n);

  // Check common fractions first (within tolerance)
  const commonFractions: [number, string][] = [
    [1 / 4,  "1/4"],
    [1 / 3,  "1/3"],
    [1 / 2,  "1/2"],
    [2 / 3,  "2/3"],
    [3 / 4,  "3/4"],
    [1 / 8,  "1/8"],
    [3 / 8,  "3/8"],
    [5 / 8,  "5/8"],
    [7 / 8,  "7/8"],
  ];

  const whole = Math.floor(n);
  const remainder = n - whole;

  if (remainder > 0.01) {
    for (const [val, label] of commonFractions) {
      if (Math.abs(remainder - val) < 0.04) {
        return whole > 0 ? `${whole} ${label}` : label;
      }
    }
  }

  // Fall back to 1 decimal place if no clean fraction found
  const rounded = Math.round(n * 10) / 10;
  return String(rounded);
}

export function scaleAmount(amount: string, ratio: number): string {

  const str = amount.trim();

  // Patterns that should never be scaled
  const noScalePatterns = [
    /^to taste$/i,
    /^as needed$/i,
    /^pinch/i,
    /^dash/i,
    /^a few/i,
    /^some/i,
    /^optional/i,
  ];
  if (noScalePatterns.some((p) => p.test(str))) return str;

  // ── Range: "2-3 pieces" ──────────────────────────────────────────────────
  const rangeMatch = str.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)(.*)/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]) * ratio;
    const hi = parseFloat(rangeMatch[2]) * ratio;
    const unit = rangeMatch[3].trim();
    return `${formatNumber(lo)}-${formatNumber(hi)}${unit ? " " + unit : ""}`;
  }

  // ── Mixed number: "1 1/2 cups" ───────────────────────────────────────────
  const mixedMatch = str.match(/^(\d+)\s+(\d+\/\d+)(.*)/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const frac = fractionToDecimal(mixedMatch[2]);
    if (!isNaN(frac)) {
      const scaled = (whole + frac) * ratio;
      const unit = mixedMatch[3].trim();
      return `${formatNumber(scaled)}${unit ? " " + unit : ""}`;
    }
  }

  // ── Simple fraction: "1/2 cup" ───────────────────────────────────────────
  const fracMatch = str.match(/^(\d+\/\d+)(.*)/);
  if (fracMatch) {
    const val = fractionToDecimal(fracMatch[1]);
    if (!isNaN(val)) {
      const scaled = val * ratio;
      const unit = fracMatch[2].trim();
      return `${formatNumber(scaled)}${unit ? " " + unit : ""}`;
    }
  }

  // ── Number glued to unit: "200g", "1.5kg" ───────────────────────────────
  const gluedMatch = str.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l|oz|lb)(\b.*)?$/i);
  if (gluedMatch) {
    const val = parseFloat(gluedMatch[1]) * ratio;
    const unit = gluedMatch[2];
    const rest = (gluedMatch[3] ?? "").trim();
    return `${formatNumber(val)}${unit}${rest ? " " + rest : ""}`;
  }

  // ── Number at start followed by unit/text: "3 cloves", "0.5 tsp" ────────
  const numMatch = str.match(/^(\d+(?:\.\d+)?)(.*)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]) * ratio;
    const rest = numMatch[2].trim();
    return `${formatNumber(val)}${rest ? " " + rest : ""}`;
  }

  // ── No number found — return unchanged ───────────────────────────────────
  return str;
}

/**
 * Scale a cost (always integer PHP, minimum ₱1 if non-zero)
 */
export function scaleCost(baseCost: number, baseServings: number, currentServings: number): number {
  if (baseCost === 0) return 0;
  const scaled = (baseCost / baseServings) * currentServings;
  return Math.max(1, Math.round(scaled));
}
