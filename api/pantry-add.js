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
      ingredient_name: String(req.body.ingredient_name).trim().toLowerCase(),
      quantity: Number(req.body.quantity || 0),
      unit: req.body.unit || ""
    };

    // Check if ingredient exists, then update or insert
    const { data: existing } = await supabase
      .from("pantry_items")
      .select("id, quantity")
      .eq("user_id", authData.user.id)
      .eq("ingredient_name", payload.ingredient_name)
      .eq("unit", payload.unit)
      .maybeSingle();

    let error;
    if (existing) {
      const { error: updateError } = await supabase
        .from("pantry_items")
        .update({ quantity: existing.quantity + payload.quantity, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("pantry_items").insert(payload);
      error = insertError;
    }

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
