import { createBrowserClient } from "@supabase/ssr";

/**
 * Returns a Supabase browser client.
 * Safe to call in "use client" components only.
 * Logs environment variables for debugging (values sanitized).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("[Supabase] Creating client with:");
  console.log("  URL:", url);
  console.log("  URL length:", url?.length);
  console.log("  Key length:", key?.length);
  console.log("  Key first 30 chars:", key?.substring(0, 30));

  if (!url || !key) {
    const missingVars = [];
    if (!url) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const error = `Missing environment variables: ${missingVars.join(", ")}. Ensure they are set in Vercel Environment Variables (Production & Preview).`;
    console.error("[Supabase]", error);
    throw new Error(error);
  }

  try {
    console.log("[Supabase] Calling createBrowserClient...");
    const client = createBrowserClient(url, key);
    
    // Intercept fetch to log what Supabase is trying to do
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const [resource] = args;
      if (typeof resource === 'string' && resource.includes('supabase')) {
        console.log("[Supabase Fetch]", resource);
      }
      return originalFetch.apply(this, args);
    };
    
    console.log("[Supabase] Client created successfully");
    return client;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Supabase] Failed to create client:", errorMsg, err);
    throw new Error(`Failed to initialize Supabase client: ${errorMsg}`);
  }
}
