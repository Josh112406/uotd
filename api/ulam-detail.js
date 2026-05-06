const { readJson, normalize } = require("./_utils");

const buildPrompt = (dish) => {
  return [
    "You are a Filipino recipe assistant.",
    "Return JSON only with keys: servings, steps.",
    "Steps must be a short ordered list.",
    `Dish: ${dish.name}.`,
    `Ingredients: ${dish.ingredients.map((ing) => `${ing.quantity} ${ing.unit} ${ing.name}`).join(", ")}.`,
    `Servings: ${dish.servings}.`,
    "Keep steps concise and practical."
  ].join(" ");
};

const callGemini = async (dish) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(dish) }]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 512
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};

module.exports = async (req, res) => {
  try {
    const ulam = readJson("ulam.json");
    const id = normalize(req.query.id || "");
    const dish = ulam.find((item) => normalize(item.id) === id);

    if (!dish) {
      return res.status(404).json({ error: "Not found" });
    }

    const gemini = await callGemini(dish);
    const steps = Array.isArray(gemini?.steps) && gemini.steps.length
      ? gemini.steps
      : [
          "Prepare the ingredients and measure portions.",
          "Cook aromatics and protein, then add vegetables.",
          "Simmer until flavors blend, then taste and adjust seasoning.",
          "Serve hot with rice."
        ];

    const item = {
      id: dish.id,
      name: dish.name,
      servings: gemini?.servings || dish.servings,
      kcalPerServing: dish.kcal_per_serving,
      ingredients: dish.ingredients,
      steps
    };

    return res.status(200).json({ item });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
