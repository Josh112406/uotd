const { getSupabaseClient } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData || !authData.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = {
      user_id: authData.user.id,
      ingredient_name: req.body.ingredient_name,
      quantity: Number(req.body.quantity || 0),
      unit: req.body.unit || ""
    };

    const { error } = await supabase.from("pantry_items").insert(payload);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
