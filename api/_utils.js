const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const getSupabaseClient = (req) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  }

  const token = req.headers.authorization || "";
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token
      }
    }
  });
};

const readJson = (fileName) => {
  const filePath = path.join(process.cwd(), "data", fileName);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const buildIngredientMap = (ingredients) => {
  const map = new Map();
  ingredients.forEach((item) => {
    map.set(normalize(item.name), item);
  });
  return map;
};

module.exports = {
  getSupabaseClient,
  readJson,
  normalize,
  buildIngredientMap
};
