import React, { useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Plus, Minus, FileText, ChevronRight, CornerDownRight } from "lucide-react";
import { MapNodeItem } from "../types.js";
import { useEditorStore } from "../store/editorStore.js";
import { useCollabStore } from "../store/collabStore.js";

export const NodeCard: React.FC<NodeProps> = (props) => {
  const nodeData = props.data as unknown as MapNodeItem & {
    hasChildren: boolean;
    isRoot: boolean;
  };

  const {
    selectedNodeKey,
    editingNodeKey,
    setSelectedNodeKey,
    setEditingNodeKey,
    updateText,
    addNode,
    addSiblingNode,
    deleteNode,
    toggleCollapse,
    readOnly,
  } = useEditorStore();

  const cursors = useCollabStore((state) => state.cursors);

  const [isEditing, setIsEditing] = useState(false);
  const [textValue, setTextValue] = useState(nodeData.text);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const isSelected = selectedNodeKey === nodeData.nodeKey;
  const isNodeEditing = editingNodeKey === nodeData.nodeKey || isEditing;

  // Active collaborator cursor highlighting on this node
  const activeCursors = Object.values(cursors).filter(
    (c) => c.nodeId === nodeData.nodeKey
  );

  useEffect(() => {
    setTextValue(nodeData.text);
  }, [nodeData.text]);

  useEffect(() => {
    if (isNodeEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isNodeEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    setIsEditing(true);
    setEditingNodeKey(nodeData.nodeKey);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setEditingNodeKey(null);
    if (textValue.trim() !== nodeData.text) {
      updateText(nodeData.nodeKey, textValue.trim() || "未命名");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeKey(nodeData.nodeKey);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNodeKey(nodeData.nodeKey);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Close context menu on window click
  useEffect(() => {
    const handleWindowClick = () => setShowContextMenu(false);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  const nodeStyle = nodeData.styleJson || {};
  const bgColor = nodeStyle.background || "#ffffff";
  const borderColor = isSelected
    ? "#4f46e5"
    : nodeData.isRoot
    ? "#4f46e5"
    : nodeStyle.color || "#e5e7eb";

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`relative group transition-all duration-150 min-w-[140px] max-w-[280px] select-none ${
        nodeData.isRoot
          ? "px-4 py-3 rounded-xl border-2 shadow-lg z-20"
          : "px-3.5 py-2.5 rounded-lg border shadow-sm z-10 hover:border-indigo-300 hover:shadow-md"
      } ${
        isSelected
          ? "ring-2 ring-indigo-500 ring-offset-2 shadow-md z-30"
          : ""
      }`}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        color: nodeStyle.color || "#111827",
        fontSize: nodeStyle.fontSize ? `${nodeStyle.fontSize}px` : "14px",
      }}
    >
      {/* Target handle for incoming tree edge */}
      {!nodeData.isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white"
        />
      )}

      {/* Active Collaborators Badges */}
      {activeCursors.length > 0 && (
        <div className="absolute -top-6 left-0 flex items-center space-x-1 z-30 pointer-events-none">
          {activeCursors.map((c) => (
            <span
              key={c.userId}
              className="text-[9px] font-bold tracking-tight px-2 py-0.5 rounded-md text-white shadow-sm flex items-center gap-1 animate-pulse"
              style={{ backgroundColor: c.color || "#4f46e5" }}
            >
              {c.username}
            </span>
          ))}
        </div>
      )}

      {/* Root Node Eyebrow Label */}
      {nodeData.isRoot && (
        <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">
          核心节点
        </span>
      )}

      {/* Node Content */}
      <div className="flex items-center space-x-2">
        {/* Emoji Icon */}
        {nodeStyle.icon && (
          <span className="text-base leading-none">{nodeStyle.icon}</span>
        )}

        {/* Text / Input */}
        {isNodeEditing && !readOnly ? (
          <input
            ref={inputRef}
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-b-2 border-indigo-600 outline-none text-sm font-medium py-0.5 text-gray-900"
          />
        ) : (
          <span className={`font-medium break-words w-full ${nodeData.isRoot ? "font-bold text-gray-900 text-sm" : "text-xs text-gray-800"}`}>
            {nodeData.text || "分支节点"}
          </span>
        )}

        {/* Note indicator */}
        {nodeData.note && (
          <div
            title={nodeData.note}
            className="text-amber-500 hover:text-amber-600 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Collapse / Expand Toggle Button for parent nodes */}
      {nodeData.hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(nodeData.nodeKey);
          }}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition-colors z-20"
          title={nodeData.collapsed ? "展开分支" : "折叠分支"}
        >
          {nodeData.collapsed ? (
            <Plus className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
        </button>
      )}

      {/* Source handle for outgoing children edge */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white opacity-0 group-hover:opacity-100 transition-opacity"
      />

      {/* Right-Click Context Menu */}
      {showContextMenu && !readOnly && (
        <div
          className="fixed bg-white border border-gray-200 shadow-2xl rounded-xl py-1.5 min-w-[160px] text-xs font-medium z-50 text-gray-700 divide-y divide-gray-100"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              onClick={() => {
                setShowContextMenu(false);
                addNode(nodeData.nodeKey);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2"
            >
              <CornerDownRight className="w-3.5 h-3.5 text-indigo-500" />
              <span>添加子节点 (Tab)</span>
            </button>
            {!nodeData.isRoot && (
              <button
                onClick={() => {
                  setShowContextMenu(false);
                  addSiblingNode(nodeData.nodeKey);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2"
              >
                <ChevronRight className="w-3.5 h-3.5 text-indigo-500" />
                <span>添加同级节点 (Enter)</span>
              </button>
            )}
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setShowContextMenu(false);
                setIsEditing(true);
                setEditingNodeKey(nodeData.nodeKey);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-gray-50 hover:text-gray-900"
            >
              编辑文本
            </button>
          </div>

          {!nodeData.isRoot && (
            <div className="py-1">
              <button
                onClick={() => {
                  setShowContextMenu(false);
                  deleteNode(nodeData.nodeKey);
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 hover:text-red-700"
              >
                删除节点及其子树 (Delete)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
