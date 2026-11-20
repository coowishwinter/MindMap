import { create } from "zustand";
import { MapNodeItem, MindMap, OpItem, NodeStyle } from "../types.js";
import { calculateTreeLayout } from "../lib/layout.js";
import { OpQueueManager } from "../lib/opQueue.js";

interface EditorState {
  map: MindMap | null;
  nodes: MapNodeItem[];
  selectedNodeKey: string | null;
  editingNodeKey: string | null;
  historyStack: MapNodeItem[][];
  redoStack: MapNodeItem[][];
  opQueue: OpItem[];
  queueManager: OpQueueManager | null;
  readOnly: boolean;
  isOffline: boolean;

  // Actions
  initEditor: (map: MindMap, nodes: MapNodeItem[], readOnly?: boolean) => void;
  setSelectedNodeKey: (key: string | null) => void;
  setEditingNodeKey: (key: string | null) => void;
  setOfflineStatus: (offline: boolean) => void;

  // Mutations
  addNode: (parentKey: string, text?: string) => string;
  addSiblingNode: (nodeKey: string) => string;
  updateText: (nodeKey: string, text: string) => void;
  updateNote: (nodeKey: string, note: string | null) => void;
  updateStyle: (nodeKey: string, style: NodeStyle) => void;
  moveNode: (nodeKey: string, targetParentKey: string, sortOrder?: number) => void;
  toggleCollapse: (nodeKey: string) => void;
  deleteNode: (nodeKey: string) => void;
  updateTitle: (title: string) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Remote Sync
  applyRemoteOps: (ops: any[]) => void;
  flushOpsToSocket: (socketEmit: (event: string, payload: any) => void) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  map: null,
  nodes: [],
  selectedNodeKey: null,
  editingNodeKey: null,
  historyStack: [],
  redoStack: [],
  opQueue: [],
  queueManager: null,
  readOnly: false,
  isOffline: !navigator.onLine,

  initEditor: (map, rawNodes, readOnly = false) => {
    const layoutNodes = calculateTreeLayout(rawNodes);
    const qManager = new OpQueueManager(map.id);
    const existingQueue = qManager.getQueue();

    set({
      map,
      nodes: layoutNodes,
      selectedNodeKey: "root",
      editingNodeKey: null,
      historyStack: [],
      redoStack: [],
      opQueue: existingQueue,
      queueManager: qManager,
      readOnly,
    });
  },

  setSelectedNodeKey: (key) => set({ selectedNodeKey: key }),
  setEditingNodeKey: (key) => set({ editingNodeKey: key }),
  setOfflineStatus: (offline) => set({ isOffline: offline }),

  addNode: (parentKey, text = "分支节点") => {
    const { nodes, queueManager, historyStack, readOnly } = get();
    if (readOnly) return "";

    const newNodeKey = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const children = nodes.filter((n) => n.parentKey === parentKey);
    const sortOrder = children.length;

    const newNode: MapNodeItem = {
      nodeKey: newNodeKey,
      parentKey,
      text,
      sortOrder,
      collapsed: false,
    };

    const newNodes = calculateTreeLayout([...nodes, newNode]);
    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "add_node",
      clientOpId,
      payload: { nodeKey: newNodeKey, parentKey, text, sortOrder },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({
      nodes: newNodes,
      selectedNodeKey: newNodeKey,
      editingNodeKey: newNodeKey,
      historyStack: [...historyStack.slice(-30), nodes],
      redoStack: [],
    });

    return newNodeKey;
  },

  addSiblingNode: (nodeKey) => {
    const { nodes, addNode } = get();
    const currNode = nodes.find((n) => n.nodeKey === nodeKey);
    if (!currNode || !currNode.parentKey) {
      // Cannot add sibling to root
      return addNode("root");
    }
    return addNode(currNode.parentKey, "新分支");
  },

  updateText: (nodeKey, text) => {
    const { nodes, queueManager, historyStack, readOnly } = get();
    if (readOnly) return;

    const newNodes = nodes.map((n) => (n.nodeKey === nodeKey ? { ...n, text } : n));
    const layoutNodes = calculateTreeLayout(newNodes);

    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "update_text",
      clientOpId,
      payload: { nodeKey, text },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({
      nodes: layoutNodes,
      historyStack: [...historyStack.slice(-30), nodes],
      redoStack: [],
    });
  },

  updateNote: (nodeKey, note) => {
    const { nodes, queueManager, historyStack, readOnly } = get();
    if (readOnly) return;

    const newNodes = nodes.map((n) => (n.nodeKey === nodeKey ? { ...n, note } : n));
    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "update_note",
      clientOpId,
      payload: { nodeKey, note },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({
      nodes: newNodes,
      historyStack: [...historyStack.slice(-30), nodes],
      redoStack: [],
    });
  },

  updateStyle: (nodeKey, style) => {
    const { nodes, queueManager, historyStack, readOnly } = get();
    if (readOnly) return;

    const newNodes = nodes.map((n) => {
      if (n.nodeKey === nodeKey) {
        return {
          ...n,
          styleJson: { ...(n.styleJson || {}), ...style },
        };
      }
      return n;
    });

    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "update_style",
      clientOpId,
      payload: { nodeKey, style },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({
      nodes: newNodes,
      historyStack: [...historyStack.slice(-30), nodes],
      redoStack: [],
    });
  },

  moveNode: (nodeKey, targetParentKey, sortOrder = 0) => {
    const { nodes, queueManager, historyStack, readOnly } = get();
    if (readOnly || nodeKey === "root") return;

    // Check cycle: parent cannot be in node's subtree
    let curr: string | null = targetParentKey;
    while (curr) {
      if (curr === nodeKey) return; // ignore cycle
      const p = nodes.find((n) => n.nodeKey === curr);
      curr = p?.parentKey || null;
    }

    const updated = nodes.map((n) =>
      n.nodeKey === nodeKey ? { ...n, parentKey: targetParentKey, sortOrder } : n
    );
    const layoutNodes = calculateTreeLayout(updated);

    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "move_node",
      clientOpId,
      payload: { nodeKey, parentKey: targetParentKey, sortOrder },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({
      nodes: layoutNodes,
      historyStack: [...historyStack.slice(-30), nodes],
      redoStack: [],
    });
  },

  toggleCollapse: (nodeKey) => {
    const { nodes, queueManager, historyStack, readOnly } = get();
    if (readOnly) return;

    let targetCollapsed = false;
    const newNodes = nodes.map((n) => {
      if (n.nodeKey === nodeKey) {
        targetCollapsed = !n.collapsed;
        return { ...n, collapsed: targetCollapsed };
      }
      return n;
    });

    const layoutNodes = calculateTreeLayout(newNodes);

    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "collapse",
      clientOpId,
      payload: { nodeKey, collapsed: targetCollapsed },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({
      nodes: layoutNodes,
      historyStack: [...historyStack.slice(-30), nodes],
      redoStack: [],
    });
  },

  deleteNode: (nodeKey) => {
    const { nodes, queueManager, historyStack, readOnly } = get();
    if (readOnly || nodeKey === "root") return;

    const keysToDelete = new Set<string>();
    const collectDescendants = (k: string) => {
      keysToDelete.add(k);
      const children = nodes.filter((n) => n.parentKey === k);
      children.forEach((c) => collectDescendants(c.nodeKey));
    };

    collectDescendants(nodeKey);

    const remaining = nodes.filter((n) => !keysToDelete.has(n.nodeKey));
    const layoutNodes = calculateTreeLayout(remaining);

    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "delete_node",
      clientOpId,
      payload: { nodeKey },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({
      nodes: layoutNodes,
      selectedNodeKey: "root",
      historyStack: [...historyStack.slice(-30), nodes],
      redoStack: [],
    });
  },

  updateTitle: (title) => {
    const { map, queueManager, readOnly } = get();
    if (readOnly || !map) return;

    const updatedMap = { ...map, title };

    const clientOpId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const op: OpItem = {
      opType: "update_title",
      clientOpId,
      payload: { title },
    };

    if (queueManager) {
      const updatedQueue = queueManager.enqueue(op);
      set({ opQueue: updatedQueue });
    }

    set({ map: updatedMap });
  },

  undo: () => {
    const { historyStack, redoStack, nodes } = get();
    if (historyStack.length === 0) return;

    const previousNodes = historyStack[historyStack.length - 1];
    const newHistory = historyStack.slice(0, historyStack.length - 1);
    const layoutNodes = calculateTreeLayout(previousNodes);

    set({
      nodes: layoutNodes,
      historyStack: newHistory,
      redoStack: [nodes, ...redoStack],
    });
  },

  redo: () => {
    const { historyStack, redoStack, nodes } = get();
    if (redoStack.length === 0) return;

    const nextNodes = redoStack[0];
    const newRedo = redoStack.slice(1);
    const layoutNodes = calculateTreeLayout(nextNodes);

    set({
      nodes: layoutNodes,
      historyStack: [...historyStack, nodes],
      redoStack: newRedo,
    });
  },

  applyRemoteOps: (ops) => {
    const { nodes } = get();
    let currentNodes = [...nodes];

    ops.forEach((op) => {
      const { opType, payload } = op;
      if (opType === "add_node") {
        const { nodeKey, parentKey, text, sortOrder = 0 } = payload;
        const exists = currentNodes.some((n) => n.nodeKey === nodeKey);
        if (exists) {
          currentNodes = currentNodes.map((n) =>
            n.nodeKey === nodeKey ? { ...n, text, parentKey } : n
          );
        } else {
          currentNodes.push({
            nodeKey,
            parentKey,
            text,
            sortOrder,
            collapsed: false,
          });
        }
      } else if (opType === "update_text") {
        currentNodes = currentNodes.map((n) =>
          n.nodeKey === payload.nodeKey ? { ...n, text: payload.text } : n
        );
      } else if (opType === "update_note") {
        currentNodes = currentNodes.map((n) =>
          n.nodeKey === payload.nodeKey ? { ...n, note: payload.note } : n
        );
      } else if (opType === "update_style") {
        currentNodes = currentNodes.map((n) =>
          n.nodeKey === payload.nodeKey
            ? { ...n, styleJson: { ...(n.styleJson || {}), ...payload.style } }
            : n
        );
      } else if (opType === "move_node") {
        currentNodes = currentNodes.map((n) =>
          n.nodeKey === payload.nodeKey
            ? { ...n, parentKey: payload.parentKey, sortOrder: payload.sortOrder || 0 }
            : n
        );
      } else if (opType === "collapse") {
        currentNodes = currentNodes.map((n) =>
          n.nodeKey === payload.nodeKey ? { ...n, collapsed: payload.collapsed } : n
        );
      } else if (opType === "delete_node") {
        const keysToDelete = new Set<string>();
        const collect = (k: string) => {
          keysToDelete.add(k);
          currentNodes.filter((c) => c.parentKey === k).forEach((c) => collect(c.nodeKey));
        };
        collect(payload.nodeKey);
        currentNodes = currentNodes.filter((n) => !keysToDelete.has(n.nodeKey));
      } else if (opType === "update_title") {
        const { map } = get();
        if (map) {
          set({ map: { ...map, title: payload.title } });
        }
      }
    });

    const layoutNodes = calculateTreeLayout(currentNodes);
    set({ nodes: layoutNodes });
  },

  flushOpsToSocket: (socketEmit) => {
    const { opQueue, queueManager, map } = get();
    if (!map || opQueue.length === 0) return;

    const batch = opQueue.slice(0, 20);
    const clientOpId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    socketEmit("op", {
      mapId: map.id,
      clientOpId,
      ops: batch.map((item) => ({
        opType: item.opType,
        payload: item.payload,
      })),
      baseVersion: map.version,
    });

    if (queueManager) {
      const clientOpIdsToRemove = batch.map((b) => b.clientOpId);
      const remainingQueue = queueManager.removeOps(clientOpIdsToRemove);
      set({ opQueue: remainingQueue });
    }
  },
}));
