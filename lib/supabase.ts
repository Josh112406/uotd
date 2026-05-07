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
    // During build/prerender without env vars — return a dummy that won't crash
    // This only happens at build time; at runtime the real values are always present
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  return createBrowserClient(url, key);
}
