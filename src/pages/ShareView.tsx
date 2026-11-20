import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Network, Lock, Globe, Share2, Edit3 } from "lucide-react";
import { getSharedMapApi } from "../api/maps.js";
import { useEditorStore } from "../store/editorStore.js";
import { MindMapCanvas } from "../components/MindMapCanvas.js";

export const ShareView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { initEditor } = useEditorStore();

  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;

    const loadSharedMap = async () => {
      setLoading(true);
      try {
        const data = await getSharedMapApi(token);
        setMapData(data);
        initEditor(data.map, data.nodes, !data.canEdit);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.message || "分享链接不存在或已过期");
      } finally {
        setLoading(false);
      }
    };

    loadSharedMap();
  }, [token]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-500 text-xs font-medium">正在加载公开思维导图...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm text-center border shadow-xl">
          <h3 className="font-bold text-red-600 text-base mb-2">链接不可用</h3>
          <p className="text-slate-500 text-xs mb-6">{errorMsg}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium"
          >
            去我的首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Shared Map Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-xs">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-sm">{mapData?.map.title}</h1>
            <p className="text-[10px] text-slate-400">
              来自 {mapData?.map.ownerName} 的公开分享思维导图
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg flex items-center space-x-1">
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span>{mapData?.canEdit ? "可协作编辑" : "公开只读"}</span>
          </span>

          {mapData?.canEdit && (
            <button
              onClick={() => navigate(`/maps/${mapData.map.id}`)}
              className="px-3.5 py-1.5 bg-blue-600 text-white font-medium text-xs rounded-xl flex items-center space-x-1.5 shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>进入协同编辑器</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Shared Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <MindMapCanvas />
      </div>
    </div>
  );
};
