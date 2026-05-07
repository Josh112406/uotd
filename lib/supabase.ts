import { createBrowserClient } from "@supabase/ssr";

/**
 * Returns a Supabase browser client.
 * Safe to call in "use client" components only.
 * Guards against missing env vars so build doesn't crash without .env.local.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missingVars = [];
    if (!url) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const error = `Missing environment variables: ${missingVars.join(", ")}. Check Vercel project settings.`;
    console.error(error);
    throw new Error(error);
  }

  // Validate URL format
  if (!url.startsWith("https://")) {
    console.error("Invalid NEXT_PUBLIC_SUPABASE_URL format:", url);
    throw new Error("Invalid Supabase URL format");
  }

  return createBrowserClient(url, key);
}
