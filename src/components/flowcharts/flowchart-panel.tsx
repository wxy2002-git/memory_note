"use client";

import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
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
import { FormEvent, useEffect, useRef, useState } from "react";
import { getReadableError } from "@/data/errors";
import {
  useCreateFlowchart,
  useDeleteFlowchart,
  useFlowcharts,
  useSaveFlowchart,
  useUpdateFlowchartTitle
} from "@/hooks/use-flowcharts";
import { MAX_TITLE_LENGTH } from "@/lib/text-limits";
import type { FlowchartListItem, SaveStatus } from "@/types/domain";
import {
  getNodeShape,
  makeNodeLabel,
  NODE_SHAPES,
  nodeTypes,
  type FlowchartNode,
  type FlowNodeData,
  type FlowNodeShape
} from "@/components/flowcharts/flowchart-node";

type FlowchartPanelProps = {
  documentId: string;
  onClose?: () => void;
};

const EDGE_COLOR = "#2f6f73";

const EDGE_TYPES = [
  { value: "smoothstep", label: "圆角线" },
  { value: "default", label: "曲线" },
  { value: "straight", label: "直线" },
  { value: "step", label: "折线" }
] as const;

const EDGE_PATTERNS = [
  { value: "solid", label: "实线" },
  { value: "dashed", label: "虚线" },
  { value: "dotted", label: "点线" }
] as const;

const EDGE_ARROWS = [
  { value: "end", label: "单箭头" },
  { value: "none", label: "无箭头" },
  { value: "both", label: "双向" }
] as const;

type FlowEdgeType = (typeof EDGE_TYPES)[number]["value"];
type FlowEdgePattern = (typeof EDGE_PATTERNS)[number]["value"];
type FlowEdgeArrow = (typeof EDGE_ARROWS)[number]["value"];

type FlowEdgeData = {
  pattern?: FlowEdgePattern;
  arrow?: FlowEdgeArrow;
};

type FlowchartEdge = Edge<FlowEdgeData, FlowEdgeType>;

function isEdgeType(value: unknown): value is FlowEdgeType {
  return EDGE_TYPES.some((edgeType) => edgeType.value === value);
}

function isEdgePattern(value: unknown): value is FlowEdgePattern {
  return EDGE_PATTERNS.some((pattern) => pattern.value === value);
}

function isEdgeArrow(value: unknown): value is FlowEdgeArrow {
  return EDGE_ARROWS.some((arrow) => arrow.value === value);
}

function getEdgeType(value: unknown): FlowEdgeType {
  return isEdgeType(value) ? value : "smoothstep";
}

function getEdgePattern(edge: Partial<FlowchartEdge>): FlowEdgePattern {
  if (isEdgePattern(edge.data?.pattern)) {
    return edge.data.pattern;
  }

  const strokeDasharray = edge.style?.strokeDasharray;

  if (typeof strokeDasharray === "string") {
    if (strokeDasharray.includes("2")) {
      return "dotted";
    }

    return "dashed";
  }

  return "solid";
}

function getEdgeArrow(edge: Partial<FlowchartEdge>): FlowEdgeArrow {
  if (isEdgeArrow(edge.data?.arrow)) {
    return edge.data.arrow;
  }

  if (edge.markerStart && edge.markerEnd) {
    return "both";
  }

  if (!edge.markerEnd) {
    return "none";
  }

  return "end";
}

function getEdgeAppearance(pattern: FlowEdgePattern, arrow: FlowEdgeArrow) {
  const strokeDasharray =
    pattern === "dashed" ? "9 7" : pattern === "dotted" ? "2 7" : undefined;
  const marker = { type: MarkerType.ArrowClosed, color: EDGE_COLOR, width: 18, height: 18 };

  return {
    animated: pattern === "dotted",
    markerStart: arrow === "both" ? marker : undefined,
    markerEnd: arrow === "none" ? undefined : marker,
    style: {
      stroke: EDGE_COLOR,
      strokeWidth: 2.2,
      strokeDasharray,
      strokeLinecap: "round" as const
    }
  };
}

function applyEdgeAppearance(
  edge: FlowchartEdge,
  updates: Partial<{ type: FlowEdgeType; pattern: FlowEdgePattern; arrow: FlowEdgeArrow }> = {}
): FlowchartEdge {
  const nextType = updates.type ?? getEdgeType(edge.type);
  const nextPattern = updates.pattern ?? getEdgePattern(edge);
  const nextArrow = updates.arrow ?? getEdgeArrow(edge);

  return {
    ...edge,
    type: nextType,
    data: {
      ...edge.data,
      pattern: nextPattern,
      arrow: nextArrow
    },
    ...getEdgeAppearance(nextPattern, nextArrow)
  };
}

function createFlowchartEdge(
  connection: Connection,
  type: FlowEdgeType,
  pattern: FlowEdgePattern,
  arrow: FlowEdgeArrow
): FlowchartEdge | null {
  if (!connection.source || !connection.target) {
    return null;
  }

  return applyEdgeAppearance(
    {
      id: `edge-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type,
      data: {
        pattern,
        arrow
      }
    },
    { type, pattern, arrow }
  );
}

function normalizeNodes(nodes: unknown[]): FlowchartNode[] {
  return nodes.flatMap((node): FlowchartNode[] => {
    if (!node || typeof node !== "object") {
      return [];
    }

    const candidate = node as Partial<Node>;
    if (typeof candidate.id !== "string" || !candidate.position || !candidate.data) {
      return [];
    }

    const data = candidate.data as FlowNodeData;

    return [
      {
        ...(candidate as Node),
        id: candidate.id,
        type: "flowNode",
        position: candidate.position,
        data: {
          ...data,
          label: makeNodeLabel(data.label),
          shape: getNodeShape(data.shape)
        }
      }
    ];
  });
}

function normalizeEdges(edges: unknown[]): FlowchartEdge[] {
  return edges.flatMap((edge): FlowchartEdge[] => {
    if (!edge || typeof edge !== "object") {
      return [];
    }

    const candidate = edge as Partial<Edge>;
    if (typeof candidate.id !== "string" || typeof candidate.source !== "string" || typeof candidate.target !== "string") {
      return [];
    }

    return [
      applyEdgeAppearance({
        ...(candidate as Edge),
        id: candidate.id,
        source: candidate.source,
        target: candidate.target,
        type: getEdgeType(candidate.type),
        data: {
          ...((candidate.data ?? {}) as FlowEdgeData),
          pattern: getEdgePattern(candidate as Partial<FlowchartEdge>),
          arrow: getEdgeArrow(candidate as Partial<FlowchartEdge>)
        }
      })
    ];
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

export function FlowchartPanel({ documentId, onClose }: FlowchartPanelProps) {
  const flowcharts = useFlowcharts(documentId);
  const createFlowchart = useCreateFlowchart(documentId);
  const updateTitle = useUpdateFlowchartTitle(documentId);
  const saveFlowchart = useSaveFlowchart(documentId);
  const deleteFlowchart = useDeleteFlowchart(documentId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [nodes, setNodes] = useState<FlowchartNode[]>([]);
  const [edges, setEdges] = useState<FlowchartEdge[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeLabelDraft, setNodeLabelDraft] = useState("");
  const [preferredNodeShape, setPreferredNodeShape] = useState<FlowNodeShape>("process");
  const [preferredEdgeType, setPreferredEdgeType] = useState<FlowEdgeType>("smoothstep");
  const [preferredEdgePattern, setPreferredEdgePattern] = useState<FlowEdgePattern>("solid");
  const [preferredEdgeArrow, setPreferredEdgeArrow] = useState<FlowEdgeArrow>("end");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newTitleTooLong = newTitle.trim().length > MAX_TITLE_LENGTH;
  const loadedFlowchartIdRef = useRef<string | null>(null);
  const localIdCounter = useRef(0);

  const activeFlowchart = flowcharts.data?.find((flowchart) => flowchart.id === activeId) ?? null;

  useEffect(() => {
    if (!flowcharts.data?.length) {
      // Local editor state mirrors the currently loaded remote flowchart list.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // Local canvas state is reset when there is no active remote flowchart.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNodes([]);
      setEdges([]);
      setViewport({ x: 0, y: 0, zoom: 1 });
      setTitleDraft("");
      setSaveStatus("idle");
      return;
    }

    if (loadedFlowchartIdRef.current === activeFlowchart.id) {
      // Keep the editable title draft in sync with remote title updates.
      setTitleDraft(activeFlowchart.title);
      return;
    }

    loadedFlowchartIdRef.current = activeFlowchart.id;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    // Hydrate the local canvas editor from the selected saved flowchart.
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

  function queueSave(
    nextNodes: FlowchartNode[],
    nextEdges: FlowchartEdge[],
    nextViewport: Viewport,
    flowchart: FlowchartListItem | null = activeFlowchart
  ) {
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

    if (newTitleTooLong) {
      return;
    }

    createFlowchart.mutate(newTitle || "未命名流程图", {
      onSuccess: (flowchartId) => {
        setNewTitle("");
        setActiveId(flowchartId);
      }
    });
  }

  function handleTitleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeFlowchart || !titleDraft.trim() || titleDraft.trim().length > MAX_TITLE_LENGTH || titleDraft.trim() === activeFlowchart.title) {
      return;
    }

    updateTitle.mutate({
      flowchartId: activeFlowchart.id,
      title: titleDraft
    });
  }

  function handleNodesChange(changes: NodeChange[]) {
    const nextNodes = applyNodeChanges(changes, nodes) as FlowchartNode[];
    setNodes(nextNodes);
    queueSave(nextNodes, edges, viewport);
  }

  function handleEdgesChange(changes: EdgeChange[]) {
    const nextEdges = applyEdgeChanges(changes, edges) as FlowchartEdge[];
    setEdges(nextEdges);
    queueSave(nodes, nextEdges, viewport);
  }

  function handleConnect(connection: Connection) {
    const nextEdge = createFlowchartEdge(connection, preferredEdgeType, preferredEdgePattern, preferredEdgeArrow);

    if (!nextEdge) {
      return;
    }

    if (
      edges.some(
        (edge) =>
          edge.source === nextEdge.source &&
          edge.target === nextEdge.target &&
          edge.sourceHandle === nextEdge.sourceHandle &&
          edge.targetHandle === nextEdge.targetHandle
      )
    ) {
      return;
    }

    const nextEdges = [...edges, nextEdge];
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

    const nextEdge = createFlowchartEdge(
      {
        source,
        target,
        sourceHandle: "right-source",
        targetHandle: "left-target"
      },
      preferredEdgeType,
      preferredEdgePattern,
      preferredEdgeArrow
    );

    if (!nextEdge) {
      return;
    }

    const nextEdges = [...edges, nextEdge];

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
    localIdCounter.current += 1;
    const id = `node-${localIdCounter.current}`;
    const nextNodes: FlowchartNode[] = [
      ...nodes,
      {
        id,
        type: "flowNode",
        position: {
          x: 120 + nodes.length * 28,
          y: 120 + nodes.length * 18
        },
        data: {
          label: "新节点",
          shape: preferredNodeShape
        }
      }
    ];

    setNodes(nextNodes);
    queueSave(nextNodes, edges, viewport);
  }

  function startNodeEdit(node: FlowchartNode) {
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

  function duplicateSelectedNodes() {
    if (selectedNodes.length === 0) {
      return;
    }

    localIdCounter.current += 1;
    const duplicateBatchId = localIdCounter.current;
    const idMap = new Map<string, string>();
    const duplicatedNodes = selectedNodes.map((node, index): FlowchartNode => {
      const nextId = `node-${duplicateBatchId}-${index}`;
      idMap.set(node.id, nextId);

      return {
        ...node,
        id: nextId,
        selected: true,
        position: {
          x: node.position.x + 36,
          y: node.position.y + 36
        },
        data: {
          ...node.data,
          label: `${makeNodeLabel(node.data.label)} 副本`
        }
      };
    });
    const duplicatedEdges = edges
      .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
      .map((edge, index): FlowchartEdge =>
        applyEdgeAppearance({
          ...edge,
          id: `edge-${duplicateBatchId}-${index}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
          selected: false
        })
      );
    const nextNodes = [...nodes.map((node) => ({ ...node, selected: false })), ...duplicatedNodes];
    const nextEdges = [...edges, ...duplicatedEdges];
    const nextSelectedNodeIds = duplicatedNodes.map((node) => node.id);

    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeIds(nextSelectedNodeIds);
    setSelectedEdgeIds([]);
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

  const selectedNodes = nodes.filter((node) => selectedNodeIds.includes(node.id));
  const selectedEdges = edges.filter((edge) => selectedEdgeIds.includes(edge.id));
  const currentNodeShape = selectedNodes.length > 0 ? getNodeShape(selectedNodes[0].data.shape) : preferredNodeShape;
  const currentEdgeType = selectedEdges.length > 0 ? getEdgeType(selectedEdges[0].type) : preferredEdgeType;
  const currentEdgePattern = selectedEdges.length > 0 ? getEdgePattern(selectedEdges[0]) : preferredEdgePattern;
  const currentEdgeArrow = selectedEdges.length > 0 ? getEdgeArrow(selectedEdges[0]) : preferredEdgeArrow;

  function applyNodeShape(shape: FlowNodeShape) {
    setPreferredNodeShape(shape);

    if (selectedNodeIds.length === 0) {
      return;
    }

    const nextNodes = nodes.map((node) =>
      selectedNodeIds.includes(node.id)
        ? {
            ...node,
            data: {
              ...node.data,
              shape
            }
          }
        : node
    );

    setNodes(nextNodes);
    queueSave(nextNodes, edges, viewport);
  }

  function applyEdgeType(type: FlowEdgeType) {
    setPreferredEdgeType(type);
    updateSelectedEdges({ type });
  }

  function applyEdgePattern(pattern: FlowEdgePattern) {
    setPreferredEdgePattern(pattern);
    updateSelectedEdges({ pattern });
  }

  function applyEdgeArrow(arrow: FlowEdgeArrow) {
    setPreferredEdgeArrow(arrow);
    updateSelectedEdges({ arrow });
  }

  function updateSelectedEdges(updates: Partial<{ type: FlowEdgeType; pattern: FlowEdgePattern; arrow: FlowEdgeArrow }>) {
    if (selectedEdgeIds.length === 0) {
      return;
    }

    const nextEdges = edges.map((edge) =>
      selectedEdgeIds.includes(edge.id) ? applyEdgeAppearance(edge, updates) : edge
    );

    setEdges(nextEdges);
    queueSave(nodes, nextEdges, viewport);
  }

  const connectionNodeIds = getConnectionNodeIds();

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const activeElement = document.activeElement;
      const target = event.target;
      const isFormField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      const isInsidePanel = Boolean(activeElement && panelRef.current?.contains(activeElement));

      if (!isInsidePanel || isFormField) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (key === "escape") {
        event.preventDefault();
        cancelNodeEdit();
        setSelectedNodeIds([]);
        setSelectedEdgeIds([]);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "s") {
        event.preventDefault();
        flushSave();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey && key === "d") {
        event.preventDefault();
        duplicateSelectedNodes();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  return (
    <section className={`flowchart-panel ${isFullscreen ? "fullscreen" : ""}`} ref={panelRef} tabIndex={-1}>
      <div className="flowchart-heading">
        <div>
          <p className="eyebrow">流程图</p>
          <h2>把这篇正文画成结构</h2>
        </div>
        <div className="flowchart-heading-actions">
          <button className="secondary-button" type="button" onClick={() => setIsFullscreen((value) => !value)}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {isFullscreen ? "退出全屏" : "全屏"}
          </button>
          {onClose ? (
            <button className="tool-button panel-close-button" type="button" onClick={onClose} aria-label="收起流程图" title="收起">
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flowchart-body">
        <aside className="flowchart-list" aria-label="流程图列表">
          <form className="flowchart-create" onSubmit={handleCreate}>
            <input
              aria-label="新建流程图标题"
              placeholder="新建流程图..."
              value={newTitle}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setNewTitle(event.target.value)}
            />
            <button className="icon-button" type="submit" disabled={newTitleTooLong || createFlowchart.isPending} aria-label="新建流程图">
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
                    maxLength={MAX_TITLE_LENGTH}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => {
                      if (
                        activeFlowchart &&
                        titleDraft.trim() &&
                        titleDraft.trim().length <= MAX_TITLE_LENGTH &&
                        titleDraft.trim() !== activeFlowchart.title
                      ) {
                        updateTitle.mutate({ flowchartId: activeFlowchart.id, title: titleDraft });
                      }
                    }}
                  />
                </form>
                <button className="tool-button" type="button" onClick={addNode} title="新增节点">
                  <Plus size={16} />
                </button>
                <label className="flowchart-tool-group" title={selectedNodeIds.length ? "修改选中节点形状" : "设置新节点形状"}>
                  <span>节点</span>
                  <select
                    value={currentNodeShape}
                    onChange={(event) => applyNodeShape(event.target.value as FlowNodeShape)}
                  >
                    {NODE_SHAPES.map((shape) => (
                      <option key={shape.value} value={shape.value}>
                        {shape.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flowchart-tool-group" title={selectedEdgeIds.length ? "修改选中线条形态" : "设置新线条形态"}>
                  <span>线型</span>
                  <select
                    value={currentEdgeType}
                    onChange={(event) => applyEdgeType(event.target.value as FlowEdgeType)}
                  >
                    {EDGE_TYPES.map((edgeType) => (
                      <option key={edgeType.value} value={edgeType.value}>
                        {edgeType.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flowchart-tool-group" title={selectedEdgeIds.length ? "修改选中线条样式" : "设置新线条样式"}>
                  <span>样式</span>
                  <select
                    value={currentEdgePattern}
                    onChange={(event) => applyEdgePattern(event.target.value as FlowEdgePattern)}
                  >
                    {EDGE_PATTERNS.map((pattern) => (
                      <option key={pattern.value} value={pattern.value}>
                        {pattern.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flowchart-tool-group" title={selectedEdgeIds.length ? "修改选中线条箭头" : "设置新线条箭头"}>
                  <span>箭头</span>
                  <select
                    value={currentEdgeArrow}
                    onChange={(event) => applyEdgeArrow(event.target.value as FlowEdgeArrow)}
                  >
                    {EDGE_ARROWS.map((arrow) => (
                      <option key={arrow.value} value={arrow.value}>
                        {arrow.label}
                      </option>
                    ))}
                  </select>
                </label>
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
                  nodeTypes={nodeTypes}
                  connectionMode={ConnectionMode.Loose}
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
                  双击节点编辑文字，从节点四边拖出连线
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
