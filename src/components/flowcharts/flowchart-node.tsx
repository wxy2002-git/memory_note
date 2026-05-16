"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export const NODE_SHAPES = [
  { value: "process", label: "过程" },
  { value: "terminator", label: "开始/结束" },
  { value: "decision", label: "判断" },
  { value: "document", label: "文档" },
  { value: "database", label: "数据" },
  { value: "input", label: "输入/输出" },
  { value: "note", label: "注释" }
] as const;

export type FlowNodeShape = (typeof NODE_SHAPES)[number]["value"];

export type FlowNodeData = {
  label?: string;
  shape?: FlowNodeShape;
};

export type FlowchartNode = Node<FlowNodeData, "flowNode">;

const handlePositions = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left }
] as const;

export function isNodeShape(value: unknown): value is FlowNodeShape {
  return NODE_SHAPES.some((shape) => shape.value === value);
}

export function getNodeShape(value: unknown): FlowNodeShape {
  return isNodeShape(value) ? value : "process";
}

export function makeNodeLabel(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return "未命名节点";
}

function FlowNode({ data, selected }: NodeProps<FlowchartNode>) {
  const shape = getNodeShape(data.shape);
  const label = makeNodeLabel(data.label);

  return (
    <div className={`flow-node flow-node-${shape} ${selected ? "is-selected" : ""}`}>
      {handlePositions.map((handle) => (
        <Handle
          key={`${handle.id}-target`}
          id={`${handle.id}-target`}
          type="target"
          position={handle.position}
          className={`flow-handle flow-handle-${handle.id} flow-handle-target`}
        />
      ))}
      {handlePositions.map((handle) => (
        <Handle
          key={`${handle.id}-source`}
          id={`${handle.id}-source`}
          type="source"
          position={handle.position}
          className={`flow-handle flow-handle-${handle.id} flow-handle-source`}
        />
      ))}
      <div className="flow-node-content">
        <span className="flow-node-label">{label}</span>
      </div>
    </div>
  );
}

export const nodeTypes = {
  flowNode: FlowNode
};
