import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { CollaboratorCursor } from "../types.js";
import { useEditorStore } from "./editorStore.js";

interface CollabState {
  socket: Socket | null;
  isConnected: boolean;
  version: number;
  cursors: Record<string, CollaboratorCursor>;
  connectCollab: (mapId: number, token: string) => void;
  disconnectCollab: () => void;
  emitCursor: (mapId: number, nodeId: string | null) => void;
}

let lastCursorEmitTime = 0;

export const useCollabStore = create<CollabState>((set, get) => ({
  socket: null,
  isConnected: false,
  version: 0,
  cursors: {},

  connectCollab: (mapId, token) => {
    const existingSocket = get().socket;
    if (existingSocket) {
      existingSocket.disconnect();
    }

    const socket = io({
      path: "/socket.io",
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("WebSocket connected!");
      set({ isConnected: true });
      useEditorStore.getState().setOfflineStatus(false);

      // Join room
      socket.emit("join", { mapId });
    });

    socket.on("disconnect", () => {
      console.log("WebSocket disconnected!");
      set({ isConnected: false });
      useEditorStore.getState().setOfflineStatus(true);
    });

    socket.on("room_state", (data: { version: number }) => {
      set({ version: data.version });
      // Catchup missed ops if version differs
      const editorState = useEditorStore.getState();
      if (editorState.map && data.version > editorState.map.version) {
        socket.emit("catchup", { mapId, lastVersion: editorState.map.version });
      }
    });

    socket.on("op_broadcast", (data: { ops: any[]; newVersion: number; userId: number; username: string }) => {
      set({ version: data.newVersion });
      const editorState = useEditorStore.getState();
      editorState.applyRemoteOps(data.ops);
      if (editorState.map) {
        useEditorStore.setState({ map: { ...editorState.map, version: data.newVersion } });
      }
    });

    socket.on("op_ack", (data: { newVersion: number }) => {
      set({ version: data.newVersion });
      const editorState = useEditorStore.getState();
      if (editorState.map) {
        useEditorStore.setState({ map: { ...editorState.map, version: data.newVersion } });
      }
    });

    socket.on("catchup_result", (data: { ops: any[]; nextVersion: number }) => {
      set({ version: data.nextVersion });
      const editorState = useEditorStore.getState();
      if (data.ops && data.ops.length > 0) {
        editorState.applyRemoteOps(data.ops);
      }
      if (editorState.map) {
        useEditorStore.setState({ map: { ...editorState.map, version: data.nextVersion } });
      }
    });

    socket.on("cursor_update", (data: { userId: number; username: string; nodeId: string | null }) => {
      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
      const color = colors[data.userId % colors.length];

      set((state) => ({
        cursors: {
          ...state.cursors,
          [data.userId]: {
            userId: data.userId,
            username: data.username,
            nodeId: data.nodeId,
            color,
          },
        },
      }));
    });

    set({ socket });
  },

  disconnectCollab: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false, cursors: {} });
    }
  },

  emitCursor: (mapId, nodeId) => {
    const now = Date.now();
    // Throttle cursor emit by 1 second
    if (now - lastCursorEmitTime < 1000) return;
    lastCursorEmitTime = now;

    const socket = get().socket;
    if (socket && socket.connected) {
      socket.emit("cursor", { mapId, nodeId });
    }
  },
}));
