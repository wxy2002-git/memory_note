import { requireSupabaseBrowserClient } from "@/lib/supabase/client";
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
  const normalizedTitle = title.trim() || "未命名流程图";
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("请先登录。");
  }

  const { data, error } = await supabase
    .from("flowcharts")
    .insert({
      user_id: user.id,
      document_id: documentId,
      title: normalizedTitle,
      nodes: [
        {
          id: "start",
          type: "default",
          position: { x: 80, y: 120 },
          data: { label: "中心主题" }
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
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("流程图标题不能为空。");
  }

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
