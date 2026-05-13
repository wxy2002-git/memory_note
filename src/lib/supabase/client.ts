import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfigStatus } from "@/lib/env";

const SUPABASE_REQUEST_TIMEOUT_MS = 20_000;

let browserClient: SupabaseClient | null = null;

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : Boolean(error && typeof error === "object" && (error as { name?: string }).name === "AbortError");
}

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const originalSignal = init?.signal;
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);

  const abortFromOriginalSignal = () => controller.abort();

  if (originalSignal?.aborted) {
    controller.abort();
  } else {
    originalSignal?.addEventListener("abort", abortFromOriginalSignal, { once: true });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (didTimeout && isAbortError(error)) {
      throw new Error("Supabase 请求超时，请检查网络后重试。");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    originalSignal?.removeEventListener("abort", abortFromOriginalSignal);
  }
};

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
        global: {
          fetch: fetchWithTimeout
        },
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
