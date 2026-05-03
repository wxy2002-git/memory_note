"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQuestion, listQuestions, searchSimilarQuestions, updateQuestionTitle } from "@/data/questions";
import { deleteQuestion } from "@/data/deletions";

export function useQuestions(search: string) {
  return useQuery({
    queryKey: ["questions", search],
    queryFn: () => listQuestions(search)
  });
}

export function useSimilarQuestions(input: string) {
  return useQuery({
    queryKey: ["questions", "similar", input],
    queryFn: () => searchSimilarQuestions(input),
    enabled: input.trim().length > 0
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
