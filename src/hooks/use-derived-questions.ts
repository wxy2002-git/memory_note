"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDerivedQuestion,
  listDerivedQuestions,
  removeDerivedQuestionLink,
  resolveQuestionJump
} from "@/data/derived-questions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toLimitedSearchTerm } from "@/lib/text-limits";

export function useDerivedQuestions(documentId: string, search: string) {
  const debouncedSearch = useDebouncedValue(toLimitedSearchTerm(search));

  return useQuery({
    queryKey: ["derived-questions", documentId, debouncedSearch],
    queryFn: () => listDerivedQuestions(documentId, debouncedSearch)
  });
}

export function useAddDerivedQuestion(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => addDerivedQuestion(documentId, title),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["derived-questions", documentId] }),
        queryClient.invalidateQueries({ queryKey: ["questions"] })
      ]);
    }
  });
}

export function useRemoveDerivedQuestion(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeDerivedQuestionLink,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["derived-questions", documentId] });
    }
  });
}

export function useResolveQuestionJump() {
  return useMutation({
    mutationFn: ({ questionId, jumpTarget }: { questionId: string; jumpTarget: "insight" | "preferred_article" }) =>
      resolveQuestionJump(questionId, jumpTarget)
  });
}
