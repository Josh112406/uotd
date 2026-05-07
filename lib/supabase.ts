import { createBrowserClient } from "@supabase/ssr";

/**
 * Returns a Supabase browser client.
 * Safe to call in "use client" components only.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missingVars = [];
    if (!url) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    throw new Error(`Missing: ${missingVars.join(", ")}`);
  }

  return createBrowserClient(url, key);
}
