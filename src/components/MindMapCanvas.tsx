import React, { useMemo, useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  NodeTypes,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { NodeCard } from "./NodeCard.js";
import { useEditorStore } from "../store/editorStore.js";
import { useCollabStore } from "../store/collabStore.js";

const nodeTypes: NodeTypes = {
  mindmapNode: NodeCard as any,
};

export const MindMapCanvas: React.FC = () => {
  const {
    nodes: treeNodes,
    selectedNodeKey,
    addNode,
    addSiblingNode,
    deleteNode,
    moveNode,
    undo,
    redo,
    setSelectedNodeKey,
    map,
  } = useEditorStore();

  const emitCursor = useCollabStore((state) => state.emitCursor);

  // Convert treeNodes to React Flow nodes & edges
  const flowNodes: Node[] = useMemo(() => {
    // Check which nodes have children
    const parentKeys = new Set(treeNodes.map((n) => n.parentKey).filter(Boolean));

    return treeNodes.map((n) => ({
      id: n.nodeKey,
      type: "mindmapNode",
      position: { x: n.x || 0, y: n.y || 0 },
      data: {
        ...n,
        hasChildren: parentKeys.has(n.nodeKey),
        isRoot: !n.parentKey,
      },
    }));
  }, [treeNodes]);

  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    treeNodes.forEach((n) => {
      if (n.parentKey) {
        // Check if parent node exists and is not collapsed
        const parentNode = treeNodes.find((item) => item.nodeKey === n.parentKey);
        if (parentNode && !parentNode.collapsed) {
          edges.push({
            id: `edge_${n.parentKey}_${n.nodeKey}`,
            source: n.parentKey,
            target: n.nodeKey,
            type: "smoothstep",
            animated: false,
            style: { stroke: "#a5b4fc", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 10,
              height: 10,
              color: "#a5b4fc",
            },
          });
        }
      }
    });
    return edges;
  }, [treeNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  // Handle Drag & Drop to change parent
  const onNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      if (!node.id || node.id === "root") return;

      // Find nearby target node to attach to
      const targetNode = flowNodes.find((candidate) => {
        if (candidate.id === node.id) return false;
        const dx = Math.abs(candidate.position.x - node.position.x);
        const dy = Math.abs(candidate.position.y - node.position.y);
        return dx < 180 && dy < 80;
      });

      if (targetNode) {
        moveNode(node.id, targetNode.id);
      }
    },
    [flowNodes, moveNode]
  );

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (selectedNodeKey) {
          addNode(selectedNodeKey);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedNodeKey) {
          addSiblingNode(selectedNodeKey);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeKey && selectedNodeKey !== "root") {
          e.preventDefault();
          deleteNode(selectedNodeKey);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeKey, addNode, addSiblingNode, deleteNode, undo, redo]);

  // Emit collaborator cursor tracking
  const handlePaneClick = useCallback(() => {
    setSelectedNodeKey(null);
    if (map) {
      emitCursor(map.id, null);
    }
  }, [setSelectedNodeKey, map, emitCursor]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeKey(node.id);
      if (map) {
        emitCursor(map.id, node.id);
      }
    },
    [setSelectedNodeKey, map, emitCursor]
  );

  return (
    <div className="w-full h-full bg-slate-50 relative overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#cbd5e1" gap={24} size={1} />
        <Controls className="!bg-white !border-slate-200 !shadow-md !rounded-xl overflow-hidden" />
      </ReactFlow>
    </div>
  );
};
