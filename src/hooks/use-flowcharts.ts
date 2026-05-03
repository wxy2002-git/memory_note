"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFlowchart,
  deleteFlowchart,
  listFlowcharts,
  saveFlowchart,
  updateFlowchartTitle,
  type SaveFlowchartInput
} from "@/data/flowcharts";

export function useFlowcharts(documentId: string) {
  return useQuery({
    queryKey: ["flowcharts", documentId],
    queryFn: () => listFlowcharts(documentId)
  });
}

export function useCreateFlowchart(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => createFlowchart(documentId, title),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flowcharts", documentId] });
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    }
  });
}

export function useUpdateFlowchartTitle(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ flowchartId, title }: { flowchartId: string; title: string }) =>
      updateFlowchartTitle(flowchartId, title),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flowcharts", documentId] });
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    }
  });
}

export function useSaveFlowchart(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveFlowchartInput) => saveFlowchart(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flowcharts", documentId] });
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    }
  });
}

export function useDeleteFlowchart(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (flowchartId: string) => deleteFlowchart(flowchartId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flowcharts", documentId] });
      await queryClient.invalidateQueries({ queryKey: ["articles"] });
    }
  });
}
