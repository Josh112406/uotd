const { getSupabaseClient } = require("./_utils");

module.exports = async (req, res) => {
  try {
    const supabase = getSupabaseClient(req);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData || !authData.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase
      .from("pantry_items")
      .select("id,ingredient_name,quantity,unit")
      .eq("user_id", authData.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ items: data || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
