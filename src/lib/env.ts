import type { SupabaseConfigStatus } from "@/types/domain";

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "note-assets";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missing.length > 0) {
    return {
      configured: false,
      missing,
      siteUrl,
      storageBucket
    };
  }

  return {
    configured: true,
    siteUrl,
    storageBucket
  };
}
