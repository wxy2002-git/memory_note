"use client";

import { create } from "zustand";
import type { AppView, DocumentType } from "@/types/domain";

type NavigationState = {
  view: AppView;
  openQuestions: () => void;
  openAnswers: (questionId: string, questionTitle?: string) => void;
  openDocument: (input: {
    documentId: string;
    documentType: DocumentType;
    title: string;
    questionId?: string;
    questionTitle?: string;
    articleId?: string;
    articleTitle?: string;
    derivedJump?: boolean;
    originDocumentId?: string;
    originDocumentType?: DocumentType;
    originTitle?: string;
    originQuestionId?: string;
    originQuestionTitle?: string;
    originArticleId?: string;
    originArticleTitle?: string;
  }) => void;
};

export const useNavigationState = create<NavigationState>((set) => ({
  view: { name: "questions" },
  openQuestions: () => set({ view: { name: "questions" } }),
  openAnswers: (questionId, questionTitle) =>
    set({
      view: {
        name: "answers",
        questionId,
        questionTitle
      }
    }),
  openDocument: (input) =>
    set({
      view: {
        name: "document",
        ...input
      }
    })
}));
