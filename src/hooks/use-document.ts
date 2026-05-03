"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocument, saveDocument, type SaveDocumentInput } from "@/data/documents";
import type { DocumentDetail } from "@/types/domain";

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId)
  });
}

export function useSaveDocument(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<SaveDocumentInput, "documentId">) =>
      saveDocument({
        documentId,
        ...input
      }),
    onSuccess: (_result, input) => {
      queryClient.setQueryData<DocumentDetail>(["document", documentId], (current) =>
        current
          ? {
              ...current,
              contentJson: input.contentJson,
              contentHtml: input.contentHtml,
              plainText: input.plainText,
              wordCount: input.wordCount,
              contentVersion: input.nextContentVersion
            }
          : current
      );

      void queryClient.invalidateQueries({ queryKey: ["articles"] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    }
  });
}
