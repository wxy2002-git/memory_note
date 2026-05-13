import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
import { requireCurrentUser } from "@/data/auth";
import { normalizeTitleInput } from "@/lib/text-limits";
import type { FlowchartListItem } from "@/types/domain";

type FlowchartRow = {
  id: string;
  document_id: string;
  title: string;
  nodes: unknown[] | null;
  edges: unknown[] | null;
  viewport: Record<string, unknown> | null;
  sort_order: number;
  updated_at: string;
};

export type SaveFlowchartInput = {
  flowchartId: string;
  nodes: unknown[];
  edges: unknown[];
  viewport: Record<string, unknown>;
};

function mapFlowchart(row: FlowchartRow): FlowchartListItem {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    nodes: Array.isArray(row.nodes) ? row.nodes : [],
    edges: Array.isArray(row.edges) ? row.edges : [],
    viewport: row.viewport ?? {},
    sortOrder: row.sort_order,
    updatedAt: row.updated_at
  };
}

export async function listFlowcharts(documentId: string): Promise<FlowchartListItem[]> {
  const supabase = requireSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("flowcharts")
    .select("id,document_id,title,nodes,edges,viewport,sort_order,updated_at")
    .eq("document_id", documentId)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as FlowchartRow[]).map(mapFlowchart);
}

export async function createFlowchart(documentId: string, title: string): Promise<string> {
  const supabase = requireSupabaseBrowserClient();
  const normalizedTitle = title.trim() ? normalizeTitleInput(title, "流程图标题") : "未命名流程图";
  const user = await requireCurrentUser();

  const { data, error } = await supabase
    .from("flowcharts")
    .insert({
      user_id: user.id,
      document_id: documentId,
      title: normalizedTitle,
      nodes: [
        {
          id: "start",
          type: "flowNode",
          position: { x: 80, y: 120 },
          data: { label: "中心主题", shape: "process" }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return (data as { id: string }).id;
}

export async function updateFlowchartTitle(flowchartId: string, title: string) {
  const supabase = requireSupabaseBrowserClient();
  const normalizedTitle = normalizeTitleInput(title, "流程图标题");

  const { error } = await supabase.from("flowcharts").update({ title: normalizedTitle }).eq("id", flowchartId);

  if (error) {
    throw error;
  }
}

export async function saveFlowchart(input: SaveFlowchartInput) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase
    .from("flowcharts")
    .update({
      nodes: input.nodes,
      edges: input.edges,
      viewport: input.viewport
    })
    .eq("id", input.flowchartId);

  if (error) {
    throw error;
  }
}

export async function deleteFlowchart(flowchartId: string) {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from("flowcharts").delete().eq("id", flowchartId);

  if (error) {
    throw error;
  }
}
