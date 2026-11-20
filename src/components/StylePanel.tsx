import React from "react";
import { X, Palette, Smile, Type, FileText } from "lucide-react";
import { useEditorStore } from "../store/editorStore.js";

const PRESET_COLORS = [
  { name: "默认", color: "#0f172a", bg: "#ffffff" },
  { name: "蓝色", color: "#2563eb", bg: "#eff6ff" },
  { name: "绿色", color: "#16a34a", bg: "#f0fdf4" },
  { name: "琥珀", color: "#d97706", bg: "#fffbeb" },
  { name: "紫色", color: "#9333ea", bg: "#faf5ff" },
  { name: "红色", color: "#dc2626", bg: "#fef2f2" },
];

const PRESET_EMOJIS = ["🚀", "💡", "📖", "💼", "✅", "⚠️", "🔥", "🎯", "⭐", "📌", "💬", "🔍"];

export const StylePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { nodes, selectedNodeKey, updateText, updateNote, updateStyle, readOnly } =
    useEditorStore();

  const selectedNode = nodes.find((n) => n.nodeKey === selectedNodeKey);

  if (!selectedNode) return null;

  const style = selectedNode.styleJson || {};

  return (
    <div className="w-80 h-full bg-white border-l border-slate-200 shadow-xl flex flex-col z-30 select-none">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Palette className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-gray-800 text-sm">节点样式与属性</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Node Text Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">节点内容</label>
          <input
            type="text"
            disabled={readOnly}
            value={selectedNode.text}
            onChange={(e) => updateText(selectedNode.nodeKey, e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">背景与文字主题</label>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_COLORS.map((item) => (
              <button
                key={item.name}
                disabled={readOnly}
                onClick={() =>
                  updateStyle(selectedNode.nodeKey, {
                    color: item.color,
                    background: item.bg,
                  })
                }
                className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:border-blue-400 transition-all text-xs"
                style={{ backgroundColor: item.bg }}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border border-slate-300"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium" style={{ color: item.color }}>
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Emoji Icons */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
            <span>图标 Emoji</span>
            {style.icon && (
              <button
                onClick={() => updateStyle(selectedNode.nodeKey, { icon: undefined })}
                className="text-[11px] text-red-500 hover:underline"
              >
                清除图标
              </button>
            )}
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                disabled={readOnly}
                onClick={() => updateStyle(selectedNode.nodeKey, { icon: emoji })}
                className={`p-2 text-lg rounded-lg border hover:bg-gray-50 transition-colors flex items-center justify-center ${
                  style.icon === emoji ? "border-indigo-500 bg-indigo-50" : "border-gray-100"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">字号调整</label>
          <div className="flex items-center space-x-2">
            <Type className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min={12}
              max={22}
              step={1}
              disabled={readOnly}
              value={style.fontSize || 14}
              onChange={(e) =>
                updateStyle(selectedNode.nodeKey, { fontSize: Number(e.target.value) })
              }
              className="w-full accent-indigo-600"
            />
            <span className="text-xs font-mono text-gray-600 w-8">
              {style.fontSize || 14}px
            </span>
          </div>
        </div>

        {/* Note / Memo */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2 flex items-center space-x-1">
            <FileText className="w-3.5 h-3.5 text-amber-500" />
            <span>节点详细备注</span>
          </label>
          <textarea
            rows={4}
            disabled={readOnly}
            placeholder="填写该节点的扩展补充说明或参考链接..."
            value={selectedNode.note || ""}
            onChange={(e) => updateNote(selectedNode.nodeKey, e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-gray-700 resize-none"
          />
        </div>
      </div>
    </div>
  );
};
