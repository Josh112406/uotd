const { readJson, normalize, buildIngredientMap } = require("./_utils");

module.exports = (req, res) => {
  const ingredients = readJson("ingredients.json");
  const ulam = readJson("ulam.json");
  const ingredientMap = buildIngredientMap(ingredients);

  const query = normalize(req.query.ingredients || "");
  const tokens = query
    ? query.split(",").map((item) => normalize(item)).filter(Boolean)
    : [];

  const results = ulam
    .map((dish) => {
      const totalIngredients = dish.ingredients.length;
      const matchCount = dish.ingredients.filter((ing) =>
        tokens.includes(normalize(ing.name))
      ).length;

      const estimatedCost = dish.ingredients.reduce((sum, ing) => {
        const base = ingredientMap.get(normalize(ing.name));
        if (!base || !base.price_per_unit) {
          return sum;
        }
        return sum + base.price_per_unit * ing.quantity;
      }, 0);

      return {
        id: dish.id,
        name: dish.name,
        kcalPerServing: dish.kcal_per_serving,
        estimatedCost,
        matchCount,
        totalIngredients
      };
    })
    .filter((dish) => (tokens.length ? dish.matchCount > 0 : true))
    .sort((a, b) => b.matchCount - a.matchCount);

  res.status(200).json({ items: results });
};
