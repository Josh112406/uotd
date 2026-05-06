const { readJson, normalize } = require("./_utils");

module.exports = (req, res) => {
  const ulam = readJson("ulam.json");
  const query = normalize(req.query.dish || "");

  const results = ulam
    .filter((dish) => (query ? normalize(dish.name).includes(query) : true))
    .map((dish) => ({
      id: dish.id,
      name: dish.name,
      ingredients: dish.ingredients.map((ing) => ing.name)
    }));

  res.status(200).json({ items: results });
};
