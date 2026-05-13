"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQuestion, listQuestions, searchSimilarQuestions, updateQuestionTitle } from "@/data/questions";
import { deleteQuestion } from "@/data/deletions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { canSearchSimilarTitle, toLimitedSearchTerm } from "@/lib/text-limits";

export function useQuestions(search: string) {
  const debouncedSearch = useDebouncedValue(toLimitedSearchTerm(search));

  return useQuery({
    queryKey: ["questions", debouncedSearch],
    queryFn: () => listQuestions(debouncedSearch)
  });
}

export function useSimilarQuestions(input: string) {
  const debouncedInput = useDebouncedValue(toLimitedSearchTerm(input));
  const enabled = canSearchSimilarTitle(input) && debouncedInput.length > 0;

  return useQuery({
    queryKey: ["questions", "similar", debouncedInput],
    queryFn: () => searchSimilarQuestions(debouncedInput),
    enabled
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createQuestion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["questions"] });
    }
  });
}

export function useUpdateQuestionTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionId, title }: { questionId: string; title: string }) =>
      updateQuestionTitle(questionId, title),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["questions"] });
    }
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questionId: string) => deleteQuestion(questionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["questions"] }),
        queryClient.invalidateQueries({ queryKey: ["articles"] }),
        queryClient.invalidateQueries({ queryKey: ["question"] }),
        queryClient.invalidateQueries({ queryKey: ["document"] }),
        queryClient.invalidateQueries({ queryKey: ["flowcharts"] })
      ]);
    }
  });
}
