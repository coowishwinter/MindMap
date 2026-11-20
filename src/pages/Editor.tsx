import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMapApi } from "../api/maps.js";
import { useEditorStore } from "../store/editorStore.js";
import { useCollabStore } from "../store/collabStore.js";
import { useAuthStore } from "../store/authStore.js";
import { Toolbar } from "../components/Toolbar.js";
import { MindMapCanvas } from "../components/MindMapCanvas.js";
import { StylePanel } from "../components/StylePanel.js";
import { ShareModal } from "../components/ShareModal.js";
import { ExportModal } from "../components/ExportModal.js";

export const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mapId = Number(id);

  const { initEditor, isOffline, flushOpsToSocket, opQueue } = useEditorStore();
  const { connectCollab, disconnectCollab, socket } = useCollabStore();
  const { accessToken } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    if (isNaN(mapId)) {
      navigate("/dashboard");
      return;
    }

    const loadMap = async () => {
      setLoading(true);
      try {
        const data = await getMapApi(mapId);
        const isReadOnly = data.map.role === "viewer";
        initEditor(data.map, data.nodes, isReadOnly);

        // Connect WebSocket for real-time multi-user collaboration
        if (accessToken) {
          connectCollab(mapId, accessToken);
        }
      } catch (err: any) {
        setErrorMsg(err.response?.data?.message || "无法加载导图，请确认访问权限");
      } finally {
        setLoading(false);
      }
    };

    loadMap();

    return () => {
      disconnectCollab();
    };
  }, [mapId, accessToken]);

  // Periodic flush of queued local operations to socket
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket && socket.connected && opQueue.length > 0) {
        flushOpsToSocket((event, payload) => socket.emit(event, payload));
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [socket, opQueue, flushOpsToSocket]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-500 text-xs font-medium">正在载入思维导图与节点数据...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm text-center border shadow-xl">
          <h3 className="font-bold text-red-600 text-base mb-2">访问受限</h3>
          <p className="text-slate-500 text-xs mb-6">{errorMsg}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium"
          >
            返回我的导图
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Top Bar */}
      <Toolbar
        onToggleStylePanel={() => setShowStylePanel(!showStylePanel)}
        onOpenShare={() => setShowShareModal(true)}
        onOpenExport={() => setShowExportModal(true)}
      />

      {/* Offline Toast Banner */}
      {isOffline && (
        <div className="bg-amber-500 text-white text-[11px] font-medium py-1 px-4 text-center shadow-xs z-30">
          ⚠️ 当前处于离线编辑状态，所有修改已保存在本地，网络恢复后将自动同步至云端。
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 h-full relative">
          <MindMapCanvas />
        </div>

        {/* Right Style Inspector Panel */}
        {showStylePanel && (
          <StylePanel onClose={() => setShowStylePanel(false)} />
        )}
      </div>

      {/* Share & Export Modals */}
      <ShareModal
        mapId={mapId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      <ExportModal
        mapId={mapId}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
};
