const { getSupabaseClient, readJson, normalize, buildIngredientMap } = require("./_utils");

const generateDishFromAI = async (pantrySet, dietTags, kcalTarget) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const prompt = [
    "You are a Filipino meal planner.",
    "Create a new authentic Filipino dish using some of these ingredients if possible: " + Array.from(pantrySet).join(", "),
    dietTags.size > 0 ? "Dietary restrictions: " + Array.from(dietTags).join(", ") : "",
    kcalTarget > 0 ? "Target kcal per serving around: " + kcalTarget : "",
    "Respond in strictly JSON format with keys: name (string), kcal_per_serving (number), servings (number), ingredients (array of objects with name, quantity, unit), steps (array of strings), diet_tags (array of strings)."
  ].join(". ");

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
  };

  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const data = await res.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

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

    const modeCount = req.query.mode === "weekly" ? 7 : 1;
    let items = scored.sort((a, b) => b.score - a.score).slice(0, modeCount);

    // If weekly and we want variety or don't have enough, generate one from AI and save to DB
    if (modeCount > 1 || items.length === 0 || Math.random() > 0.5) {
      const generated = await generateDishFromAI(pantrySet, dietTags, kcalTarget);
      if (generated && generated.name) {
        const { data: inserted } = await supabase.from("dishes").insert({
          name: generated.name,
          kcal_per_serving: generated.kcal_per_serving,
          ingredients: generated.ingredients,
          steps: generated.steps,
          servings: generated.servings,
          diet_tags: generated.diet_tags
        }).select("id, name, kcal_per_serving, ingredients").single();

        if (inserted) {
          const estimatedCost = (inserted.ingredients || []).reduce((sum, ing) => {
            const base = ingredientMap.get(normalize(ing.name));
            return sum + (base?.price_per_unit || 0) * ing.quantity;
          }, 0);
          
          items.unshift({
            id: inserted.id,
            name: inserted.name,
            kcalPerServing: inserted.kcal_per_serving,
            estimatedCost: estimatedCost,
            matchCount: (inserted.ingredients || []).filter(ing => pantrySet.has(normalize(ing.name))).length,
            totalIngredients: (inserted.ingredients || []).length,
            score: 999 // Ensure AI dish is up top
          });
          
          items = items.slice(0, modeCount);
        }
      }
    }

    return res.status(200).json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
