"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
  type Viewport
} from "@xyflow/react";
import { Check, Expand, FilePlus2, GitBranch, Maximize2, Minimize2, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getReadableError } from "@/data/errors";
import {
  useCreateFlowchart,
  useDeleteFlowchart,
  useFlowcharts,
  useSaveFlowchart,
  useUpdateFlowchartTitle
} from "@/hooks/use-flowcharts";
import type { FlowchartListItem, SaveStatus } from "@/types/domain";

type FlowchartPanelProps = {
  documentId: string;
};

function normalizeNodes(nodes: unknown[]): Node[] {
  return nodes.filter((node): node is Node => {
    if (!node || typeof node !== "object") {
      return false;
    }

    const candidate = node as Partial<Node>;
    return typeof candidate.id === "string" && Boolean(candidate.position) && Boolean(candidate.data);
  });
}

function normalizeEdges(edges: unknown[]): Edge[] {
  return edges.filter((edge): edge is Edge => {
    if (!edge || typeof edge !== "object") {
      return false;
    }

    const candidate = edge as Partial<Edge>;
    return typeof candidate.id === "string" && typeof candidate.source === "string" && typeof candidate.target === "string";
  });
}

function normalizeViewport(viewport: Record<string, unknown>): Viewport {
  return {
    x: typeof viewport.x === "number" ? viewport.x : 0,
    y: typeof viewport.y === "number" ? viewport.y : 0,
    zoom: typeof viewport.zoom === "number" ? viewport.zoom : 1
  };
}

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isSameViewport(left: Viewport, right: Viewport) {
  return left.x === right.x && left.y === right.y && left.zoom === right.zoom;
}

function makeNodeLabel(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return "未命名节点";
}

export function FlowchartPanel({ documentId }: FlowchartPanelProps) {
  const flowcharts = useFlowcharts(documentId);
  const createFlowchart = useCreateFlowchart(documentId);
  const updateTitle = useUpdateFlowchartTitle(documentId);
  const saveFlowchart = useSaveFlowchart(documentId);
  const deleteFlowchart = useDeleteFlowchart(documentId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeLabelDraft, setNodeLabelDraft] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedFlowchartIdRef = useRef<string | null>(null);

  const activeFlowchart = useMemo(
    () => flowcharts.data?.find((flowchart) => flowchart.id === activeId) ?? null,
    [activeId, flowcharts.data]
  );

  useEffect(() => {
    if (!flowcharts.data?.length) {
      setActiveId(null);
      return;
    }

    if (!activeId || !flowcharts.data.some((flowchart) => flowchart.id === activeId)) {
      setActiveId(flowcharts.data[0].id);
    }
  }, [activeId, flowcharts.data]);

  useEffect(() => {
    if (!activeFlowchart) {
      loadedFlowchartIdRef.current = null;
      setNodes([]);
      setEdges([]);
      setViewport({ x: 0, y: 0, zoom: 1 });
      setTitleDraft("");
      setSaveStatus("idle");
      return;
    }

    if (loadedFlowchartIdRef.current === activeFlowchart.id) {
      setTitleDraft(activeFlowchart.title);
      return;
    }

    loadedFlowchartIdRef.current = activeFlowchart.id;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    setNodes(normalizeNodes(activeFlowchart.nodes));
    setEdges(normalizeEdges(activeFlowchart.edges));
    setViewport(normalizeViewport(activeFlowchart.viewport));
    setTitleDraft(activeFlowchart.title);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);
    setEditingNodeId(null);
    setNodeLabelDraft("");
    setSaveStatus("idle");
  }, [activeFlowchart]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  function queueSave(nextNodes: Node[], nextEdges: Edge[], nextViewport: Viewport, flowchart: FlowchartListItem | null = activeFlowchart) {
    if (!flowchart) {
      return;
    }

    setSaveStatus("dirty");

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      setSaveStatus("saving");
      saveFlowchart.mutate(
        {
          flowchartId: flowchart.id,
          nodes: nextNodes,
          edges: nextEdges,
          viewport: nextViewport
        },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("error")
        }
      );
    }, 900);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    createFlowchart.mutate(newTitle || "未命名流程图", {
      onSuccess: (flowchartId) => {
        setNewTitle("");
        setActiveId(flowchartId);
      }
    });
  }

  function handleTitleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeFlowchart || !titleDraft.trim() || titleDraft.trim() === activeFlowchart.title) {
      return;
    }

    updateTitle.mutate({
      flowchartId: activeFlowchart.id,
      title: titleDraft
    });
  }

  function handleNodesChange(changes: NodeChange[]) {
    const nextNodes = applyNodeChanges(changes, nodes);
    setNodes(nextNodes);
    queueSave(nextNodes, edges, viewport);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    const nextEdges = applyEdgeChanges(changes, edges);
    setEdges(nextEdges);
    queueSave(nodes, nextEdges, viewport);
  }

  function handleConnect(connection: Connection) {
    const nextEdges = addEdge(connection, edges);
    setEdges(nextEdges);
    queueSave(nodes, nextEdges, viewport);
  }

  function getConnectionNodeIds() {
    if (selectedNodeIds.length === 2) {
      return selectedNodeIds;
    }

    if (selectedNodeIds.length === 0 && nodes.length === 2) {
      return nodes.map((node) => node.id);
    }

    return [];
  }

  function connectSelectedNodes() {
    const nextConnectionNodeIds = getConnectionNodeIds();

    if (nextConnectionNodeIds.length !== 2) {
      return;
    }

    const [source, target] = nextConnectionNodeIds;

    if (edges.some((edge) => edge.source === source && edge.target === target)) {
      return;
    }

    const nextEdges: Edge[] = [
      ...edges,
      {
        id: `edge-${source}-${target}-${Date.now()}`,
        source,
        target
      }
    ];

    setEdges(nextEdges);
    queueSave(nodes, nextEdges, viewport);
  }

  function handleMoveEnd(nextViewport: Viewport) {
    if (isSameViewport(viewport, nextViewport)) {
      return;
    }

    setViewport(nextViewport);
    queueSave(nodes, edges, nextViewport);
  }

  function handleSelectionChange(selection: OnSelectionChangeParams) {
    const nextNodeIds = selection.nodes.map((node) => node.id);
    const nextEdgeIds = selection.edges.map((edge) => edge.id);

    setSelectedNodeIds((currentIds) => (areStringArraysEqual(currentIds, nextNodeIds) ? currentIds : nextNodeIds));
    setSelectedEdgeIds((currentIds) => (areStringArraysEqual(currentIds, nextEdgeIds) ? currentIds : nextEdgeIds));
  }

  function addNode() {
    const id = `node-${Date.now()}`;
    const nextNodes: Node[] = [
      ...nodes,
      {
        id,
        type: "default",
        position: {
          x: 120 + nodes.length * 28,
          y: 120 + nodes.length * 18
        },
        data: {
          label: "新节点"
        }
      }
    ];

    setNodes(nextNodes);
    queueSave(nextNodes, edges, viewport);
  }

  function startNodeEdit(node: Node) {
    setEditingNodeId(node.id);
    setNodeLabelDraft(makeNodeLabel(node.data?.label));
  }

  function cancelNodeEdit() {
    setEditingNodeId(null);
    setNodeLabelDraft("");
  }

  function commitNodeEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingNodeId || !nodeLabelDraft.trim()) {
      return;
    }

    const nextLabel = nodeLabelDraft.trim();
    let changed = false;
    const nextNodes = nodes.map((item) =>
      item.id === editingNodeId
        ? (() => {
            if (makeNodeLabel(item.data?.label) === nextLabel) {
              return item;
            }

            changed = true;
            return {
              ...item,
              data: {
                ...item.data,
                label: nextLabel
              }
            };
          })()
        : item
    );

    cancelNodeEdit();

    if (!changed) {
      return;
    }

    setNodes(nextNodes);
    queueSave(nextNodes, edges, viewport);
  }

  function deleteSelection() {
    if (!selectedNodeIds.length && !selectedEdgeIds.length) {
      return;
    }

    const nextNodes = nodes.filter((node) => !selectedNodeIds.includes(node.id));
    const nextEdges = edges.filter(
      (edge) =>
        !selectedEdgeIds.includes(edge.id) &&
        !selectedNodeIds.includes(edge.source) &&
        !selectedNodeIds.includes(edge.target)
    );

    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds([]);
    setSelectedEdgeIds([]);

    if (editingNodeId && selectedNodeIds.includes(editingNodeId)) {
      cancelNodeEdit();
    }

    queueSave(nextNodes, nextEdges, viewport);
  }

  function flushSave() {
    if (!activeFlowchart) {
      return;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    setSaveStatus("saving");
    saveFlowchart.mutate(
      {
        flowchartId: activeFlowchart.id,
        nodes,
        edges,
        viewport
      },
      {
        onSuccess: () => setSaveStatus("saved"),
        onError: () => setSaveStatus("error")
      }
    );
  }

  function removeFlowchart() {
    if (!activeFlowchart) {
      return;
    }

    if (!window.confirm(`确认删除流程图「${activeFlowchart.title}」吗？`)) {
      return;
    }

    deleteFlowchart.mutate(activeFlowchart.id);
  }

  const connectionNodeIds = getConnectionNodeIds();

  return (
    <section className={`flowchart-panel ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="flowchart-heading">
        <div>
          <p className="eyebrow">流程图</p>
          <h2>把这篇正文画成结构</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => setIsFullscreen((value) => !value)}>
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          {isFullscreen ? "退出全屏" : "全屏"}
        </button>
      </div>

      <div className="flowchart-body">
        <aside className="flowchart-list" aria-label="流程图列表">
          <form className="flowchart-create" onSubmit={handleCreate}>
            <input
              aria-label="新建流程图标题"
              placeholder="新建流程图..."
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
            />
            <button className="icon-button" type="submit" disabled={createFlowchart.isPending} aria-label="新建流程图">
              <FilePlus2 size={16} />
            </button>
          </form>

          {flowcharts.isLoading ? <p className="state-text compact">正在读取流程图...</p> : null}
          {flowcharts.error ? <p className="form-error">{getReadableError(flowcharts.error)}</p> : null}
          {createFlowchart.error ? <p className="form-error">{getReadableError(createFlowchart.error)}</p> : null}

          {!flowcharts.isLoading && !flowcharts.data?.length ? (
            <div className="flowchart-empty">
              <GitBranch size={18} />
              还没有流程图
            </div>
          ) : null}

          <div className="flowchart-tabs">
            {flowcharts.data?.map((flowchart) => (
              <button
                key={flowchart.id}
                className={`flowchart-tab ${activeId === flowchart.id ? "active" : ""}`}
                type="button"
                onClick={() => setActiveId(flowchart.id)}
              >
                <span>{flowchart.title}</span>
                <small>{flowchart.nodes.length} 节点</small>
              </button>
            ))}
          </div>
        </aside>

        <div className="flowchart-editor">
          {activeFlowchart ? (
            <>
              <div className="flowchart-toolbar">
                <form className="flowchart-title-form" onSubmit={handleTitleSubmit}>
                  <input
                    aria-label="流程图标题"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => {
                      if (activeFlowchart && titleDraft.trim() && titleDraft.trim() !== activeFlowchart.title) {
                        updateTitle.mutate({ flowchartId: activeFlowchart.id, title: titleDraft });
                      }
                    }}
                  />
                </form>
                <button className="tool-button" type="button" onClick={addNode} title="新增节点">
                  <Plus size={16} />
                </button>
                <button
                  className="tool-button danger-tool"
                  type="button"
                  onClick={deleteSelection}
                  disabled={!selectedNodeIds.length && !selectedEdgeIds.length}
                  title="删除选中"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  className="tool-button"
                  type="button"
                  onClick={connectSelectedNodes}
                  disabled={connectionNodeIds.length !== 2}
                  title="连接节点"
                  aria-label="连接节点"
                >
                  <GitBranch size={16} />
                </button>
                <button className="tool-button" type="button" onClick={flushSave} disabled={saveStatus === "saving"} title="立即保存">
                  <Save size={16} />
                </button>
                <button className="tool-button danger-tool" type="button" onClick={removeFlowchart} title="删除流程图">
                  <Trash2 size={16} />
                </button>
                <span className={`save-state ${saveStatus}`}>
                  {saveStatus === "dirty"
                    ? "未保存"
                    : saveStatus === "saving"
                      ? "保存中"
                      : saveStatus === "saved"
                        ? "已保存"
                        : saveStatus === "error"
                          ? "保存失败"
                          : "已就绪"}
                </span>
                {editingNodeId ? (
                  <form className="node-edit-form" onSubmit={commitNodeEdit}>
                    <input
                      aria-label="节点文字"
                      value={nodeLabelDraft}
                      onChange={(event) => setNodeLabelDraft(event.target.value)}
                      autoFocus
                    />
                    <button
                      className="tool-button"
                      type="submit"
                      disabled={!nodeLabelDraft.trim()}
                      title="保存节点文字"
                      aria-label="保存节点文字"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="tool-button"
                      type="button"
                      onClick={cancelNodeEdit}
                      title="取消编辑节点"
                      aria-label="取消编辑节点"
                    >
                      <X size={16} />
                    </button>
                  </form>
                ) : null}
              </div>

              {updateTitle.error ? <p className="form-error">{getReadableError(updateTitle.error)}</p> : null}
              {saveFlowchart.error ? <p className="form-error">{getReadableError(saveFlowchart.error)}</p> : null}
              {deleteFlowchart.error ? <p className="form-error">{getReadableError(deleteFlowchart.error)}</p> : null}

              <div className="flowchart-canvas">
                <ReactFlow
                  key={activeFlowchart.id}
                  nodes={nodes}
                  edges={edges}
                  defaultViewport={viewport}
                  fitView={nodes.length === 0}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={handleConnect}
                  onMoveEnd={(_, nextViewport) => handleMoveEnd(nextViewport)}
                  onSelectionChange={handleSelectionChange}
                  onNodeDoubleClick={(_, node) => startNodeEdit(node)}
                >
                  <Background />
                  <Controls />
                  <MiniMap pannable zoomable />
                </ReactFlow>
                <div className="flowchart-hint">
                  <Expand size={14} />
                  双击节点编辑文字，拖出连线建立关系
                </div>
              </div>
            </>
          ) : (
            <div className="flowchart-placeholder">
              <GitBranch size={24} />
              新建一个流程图来整理这篇正文。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
