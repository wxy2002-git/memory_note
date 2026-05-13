import type { AuthUser } from "@/types/domain";
import { requireSupabaseBrowserClient } from "@/lib/supabase/client";

function isMissingSessionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { name?: string; message?: string };

  return candidate.name === "AuthSessionMissingError" || candidate.message === "Auth session missing!";
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error && !isMissingSessionError(error)) {
    throw error;
  }

  const user = data.session?.user;

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null
  };
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("请先登录。");
  }

  return user;
}

export async function sendEmailOtp(email: string) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false
    }
  });

  if (error) {
    throw error;
  }
}

export async function verifyEmailOtp(email: string, token: string) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email"
  });

  if (error) {
    throw error;
  }
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
