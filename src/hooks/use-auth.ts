"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCurrentUser, sendEmailOtp, signInWithPassword, signOut, verifyEmailOtp } from "@/data/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseConfigStatus } from "@/lib/env";

export function useAuth() {
  const queryClient = useQueryClient();
  const config = getSupabaseConfigStatus();

  const userQuery = useQuery({
    queryKey: ["auth", "user"],
    queryFn: getCurrentUser,
    enabled: config.configured
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const sendOtpMutation = useMutation({
    mutationFn: sendEmailOtp
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ email, token }: { email: string; token: string }) => verifyEmailOtp(email, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    }
  });

  const signInWithPasswordMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => signInWithPassword(email, password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    }
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    }
  });

  return {
    config,
    user: userQuery.data ?? null,
    isLoading: userQuery.isLoading,
    userError: userQuery.error,
    sendOtp: sendOtpMutation,
    verifyOtp: verifyOtpMutation,
    signInWithPassword: signInWithPasswordMutation,
    signOut: signOutMutation
  };
}
