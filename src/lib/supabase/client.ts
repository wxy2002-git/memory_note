import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfigStatus } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const config = getSupabaseConfigStatus();

  if (!config.configured) {
    return null;
  }

  if (!browserClient) {
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return browserClient;
}

export function requireSupabaseBrowserClient() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    throw new Error("Supabase is not configured. Fill .env.local first.");
  }

  return client;
}
