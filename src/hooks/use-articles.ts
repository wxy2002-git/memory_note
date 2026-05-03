"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createArticle,
  ensureQuestionInsight,
  getQuestionDetail,
  listArticles,
  searchSimilarArticles,
  setPreferredAnswer,
  updateArticleSourceUrl,
  updateArticleTitle
} from "@/data/articles";
import { deleteArticle } from "@/data/deletions";

export function useQuestionDetail(questionId: string) {
  return useQuery({
    queryKey: ["question", questionId],
    queryFn: () => getQuestionDetail(questionId)
  });
}

export function useArticles(questionId: string, search: string) {
  return useQuery({
    queryKey: ["articles", questionId, search],
    queryFn: () => listArticles(questionId, search)
  });
}

export function useSimilarArticles(questionId: string, input: string) {
  return useQuery({
    queryKey: ["articles", questionId, "similar", input],
    queryFn: () => searchSimilarArticles(questionId, input),
    enabled: input.trim().length > 0
  });
}

export function useCreateArticle(questionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => createArticle(questionId, title),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["articles", questionId] }),
        queryClient.invalidateQueries({ queryKey: ["questions"] }),
        queryClient.invalidateQueries({ queryKey: ["question", questionId] })
      ]);
    }
  });
}

export function useUpdateArticleTitle(questionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ articleId, title }: { articleId: string; title: string }) =>
      updateArticleTitle(articleId, title),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["articles", questionId] });
    }
  });
}

export function useUpdateArticleSourceUrl(questionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ articleId, sourceUrl }: { articleId: string; sourceUrl: string }) =>
      updateArticleSourceUrl(articleId, sourceUrl),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["articles", questionId] });
    }
  });
}

export function useSetPreferredAnswer(questionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (articleId: string) => setPreferredAnswer(questionId, articleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["articles", questionId] }),
        queryClient.invalidateQueries({ queryKey: ["question", questionId] })
      ]);
    }
  });
}

export function useEnsureQuestionInsight(questionId: string) {
  return useMutation({
    mutationFn: () => ensureQuestionInsight(questionId)
  });
}

export function useDeleteArticle(questionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (articleId: string) => deleteArticle(articleId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["articles", questionId] }),
        queryClient.invalidateQueries({ queryKey: ["questions"] }),
        queryClient.invalidateQueries({ queryKey: ["question", questionId] }),
        queryClient.invalidateQueries({ queryKey: ["document"] }),
        queryClient.invalidateQueries({ queryKey: ["flowcharts"] })
      ]);
    }
  });
}
