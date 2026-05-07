import { createBrowserClient } from "@supabase/ssr";

/**
 * Returns a Supabase browser client.
 * Safe to call in "use client" components only.
 * Logs environment variables for debugging (values sanitized).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Log sanitized values for debugging
  console.log(
    `[Supabase] URL present: ${!!url}`,
    url ? `(${url.substring(0, 20)}...)` : ""
  );
  console.log(
    `[Supabase] Key present: ${!!key}`,
    key ? `(${key.substring(0, 20)}...)` : ""
  );

  if (!url || !key) {
    const missingVars = [];
    if (!url) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const error = `Missing environment variables: ${missingVars.join(", ")}. Ensure they are set in Vercel Environment Variables (Production & Preview).`;
    console.error("[Supabase]", error);
    throw new Error(error);
  }

  // Validate URL format
  if (!url.startsWith("https://")) {
    const error = `Invalid NEXT_PUBLIC_SUPABASE_URL format (must start with https://): ${url}`;
    console.error("[Supabase]", error);
    throw new Error(error);
  }

  // Validate key format (should be a valid JWT-like token)
  if (!key.includes(".")) {
    const error = `Invalid NEXT_PUBLIC_SUPABASE_ANON_KEY format (should contain multiple parts). Key length: ${key.length}`;
    console.error("[Supabase]", error);
    throw new Error(error);
  }

  try {
    const client = createBrowserClient(url, key);
    console.log("[Supabase] Client initialized successfully");
    return client;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Supabase] Failed to create client:", errorMsg);
    throw new Error(`Failed to initialize Supabase client: ${errorMsg}`);
  }
}
