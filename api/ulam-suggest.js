const { getSupabaseClient, readJson, normalize, buildIngredientMap } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData || !authData.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = authData.user.id;
    const [{ data: profile }, { data: pantryItems }] = await Promise.all([
      supabase
        .from("profiles")
        .select("budget_per_meal,kcal_target,diet_tags")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("pantry_items")
        .select("ingredient_name")
        .eq("user_id", userId)
    ]);

    const pantrySet = new Set(
      (pantryItems || []).map((item) => normalize(item.ingredient_name))
    );

    const ingredients = readJson("ingredients.json");
    const ulam = readJson("ulam.json");
    const ingredientMap = buildIngredientMap(ingredients);

    const budget = Number(profile?.budget_per_meal || 0);
    const kcalTarget = Number(profile?.kcal_target || 0);
    const dietTags = new Set((profile?.diet_tags || []).map(normalize));

    const scored = ulam.map((dish) => {
      const totalIngredients = dish.ingredients.length;
      const matchCount = dish.ingredients.filter((ing) =>
        pantrySet.has(normalize(ing.name))
      ).length;

      const estimatedCost = dish.ingredients.reduce((sum, ing) => {
        const base = ingredientMap.get(normalize(ing.name));
        if (!base || !base.price_per_unit) {
          return sum;
        }
        return sum + base.price_per_unit * ing.quantity;
      }, 0);

      const dietMatch = dish.diet_tags
        ? dish.diet_tags.filter((tag) => dietTags.has(normalize(tag))).length
        : 0;

      let score = matchCount * 3 + dietMatch;

      if (budget > 0 && estimatedCost <= budget) {
        score += 2;
      }

      if (kcalTarget > 0 && dish.kcal_per_serving <= kcalTarget) {
        score += 1;
      }

      return {
        id: dish.id,
        name: dish.name,
        kcalPerServing: dish.kcal_per_serving,
        estimatedCost,
        matchCount,
        totalIngredients,
        score
      };
    });

    const items = scored.sort((a, b) => b.score - a.score).slice(0, 5);
    return res.status(200).json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
