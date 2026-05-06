const { readJson } = require("./_utils");

module.exports = (req, res) => {
  const items = readJson("ingredients.json");
  res.status(200).json({ items });
};
