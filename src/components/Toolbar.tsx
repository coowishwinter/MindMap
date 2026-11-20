import React, { useState } from "react";
import {
  Undo2,
  Redo2,
  Plus,
  CornerDownRight,
  Trash2,
  Palette,
  Share2,
  Download,
  BookOpen,
  Wifi,
  WifiOff,
  UserPlus,
  ArrowLeft,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEditorStore } from "../store/editorStore.js";
import { useCollabStore } from "../store/collabStore.js";
import { publishTemplateApi, getTemplateCategoriesApi } from "../api/templates.js";

export const Toolbar: React.FC<{
  onToggleStylePanel: () => void;
  onOpenShare: () => void;
  onOpenExport: () => void;
}> = ({ onToggleStylePanel, onOpenShare, onOpenExport }) => {
  const navigate = useNavigate();
  const {
    map,
    selectedNodeKey,
    historyStack,
    redoStack,
    isOffline,
    readOnly,
    addNode,
    addSiblingNode,
    deleteNode,
    undo,
    redo,
    updateTitle,
  } = useEditorStore();

  const { isConnected, cursors } = useCollabStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(map?.title || "");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | "">("");
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDesc, setPublishDesc] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const activeUsers = Object.values(cursors);

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue.trim() !== map?.title) {
      updateTitle(titleValue.trim());
    }
  };

  const handleOpenPublish = async () => {
    setShowPublishModal(true);
    setPublishTitle(map?.title || "");
    try {
      const cats = await getTemplateCategoriesApi();
      setCategories(cats);
      if (cats.length > 0) setSelectedCatId(cats[0].id);
    } catch (e) {}
  };

  const handlePublishTemplate = async () => {
    if (!map || !selectedCatId || !publishTitle) return;
    setIsPublishing(true);
    try {
      await publishTemplateApi(map.id, {
        categoryId: Number(selectedCatId),
        title: publishTitle,
        description: publishDesc,
      });
      alert("发布成模板成功！可以在模板市场中浏览使用。");
      setShowPublishModal(false);
    } catch (err) {
      alert("发布失败，请检查操作权限");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-20 shadow-xs select-none">
      {/* Left: Back & Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="返回我的导图"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
          {isEditingTitle && !readOnly ? (
            <input
              type="text"
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
              className="font-bold text-slate-800 text-base outline-none border-b-2 border-blue-500 bg-transparent px-1"
            />
          ) : (
            <h1
              onDoubleClick={() => {
                if (!readOnly) {
                  setTitleValue(map?.title || "");
                  setIsEditingTitle(true);
                }
              }}
              className="font-bold text-slate-800 text-base cursor-pointer hover:text-blue-600 transition-colors"
              title="双击重命名导图"
            >
              {map?.title || "未命名导图"}
            </h1>
          )}

          {readOnly && (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              只读模式
            </span>
          )}
        </div>
      </div>

      {/* Center: Editing Tools */}
      {!readOnly && (
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
          <button
            disabled={historyStack.length === 0}
            onClick={undo}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            disabled={redoStack.length === 0}
            onClick={redo}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="重做 (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-300 mx-1" />

          <button
            onClick={() => selectedNodeKey && addNode(selectedNodeKey)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-indigo-600 transition-colors flex items-center space-x-1"
            title="添加子节点 (Tab)"
          >
            <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
            <span>子节点</span>
          </button>

          <button
            onClick={() => selectedNodeKey && addSiblingNode(selectedNodeKey)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:text-indigo-600 transition-colors flex items-center space-x-1"
            title="添加同级节点 (Enter)"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-500" />
            <span>同级节点</span>
          </button>

          <button
            disabled={!selectedNodeKey || selectedNodeKey === "root"}
            onClick={() => selectedNodeKey && deleteNode(selectedNodeKey)}
            className="p-1.5 rounded-lg text-red-600 hover:bg-white disabled:opacity-30 transition-colors"
            title="删除节点 (Delete)"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-300 mx-1" />

          <button
            onClick={onToggleStylePanel}
            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-colors"
            title="外观样式"
          >
            <Palette className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Right: Presence, Share, Export */}
      <div className="flex items-center space-x-3">
        {/* Status Indicator */}
        <div className="flex items-center space-x-1.5 text-xs text-slate-500 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
          {isConnected && !isOffline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-700 font-medium text-[11px]">协同在线</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-700 font-medium text-[11px]">离线模式</span>
            </>
          )}
        </div>

        {/* Collaborators Stack */}
        {activeUsers.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {activeUsers.slice(0, 3).map((u) => (
              <div
                key={u.userId}
                title={u.username}
                className="w-7 h-7 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs"
                style={{ backgroundColor: u.color }}
              >
                {u.username.substring(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {!readOnly && (
          <button
            onClick={handleOpenPublish}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs flex items-center space-x-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>发布模板</span>
          </button>
        )}

        <button
          onClick={onOpenExport}
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-xs flex items-center space-x-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-purple-500" />
          <span>导出</span>
        </button>

        {!readOnly && (
          <button
            onClick={onOpenShare}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>分享协作</span>
          </button>
        )}
      </div>

      {/* Publish Template Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <h3 className="font-bold text-slate-800 text-lg mb-4">发布到模板市场</h3>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">模板分类</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">模板名称</label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">模板说明</label>
                <textarea
                  rows={3}
                  value={publishDesc}
                  onChange={(e) => setPublishDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={handlePublishTemplate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
                >
                  {isPublishing ? "发布中..." : "确认发布"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
