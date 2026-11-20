import React, { useState } from "react";
import { X, Download, FileImage, FileText, Code2 } from "lucide-react";
import { exportMapApi } from "../api/maps.js";

export const ExportModal: React.FC<{
  mapId: number;
  isOpen: boolean;
  onClose: () => void;
}> = ({ mapId, isOpen, onClose }) => {
  const [format, setFormat] = useState<"png" | "pdf" | "svg">("png");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    try {
      // Find React Flow SVG element on DOM
      const svgElement = document.querySelector(".react-flow__renderer svg") as SVGElement;
      let svgString = "";

      if (svgElement) {
        svgString = new XMLSerializer().serializeToString(svgElement);
      } else {
        // Fallback clean SVG
        svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="100%" height="100%" fill="#ffffff"/><text x="50" y="50" font-size="20">Mind Map Export</text></svg>`;
      }

      const res = await exportMapApi(mapId, { svg: svgString, format });
      if (res.url) {
        const link = document.createElement("a");
        link.href = res.url;
        link.download = `mindmap_${mapId}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        onClose();
      }
    } catch (err) {
      alert("导出失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">导出思维导图</h3>
            <p className="text-xs text-slate-500">选择所需导出格式并一键高清离线保存</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setFormat("png")}
              className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center space-y-2 transition-all ${
                format === "png"
                  ? "border-purple-500 bg-purple-50/50 text-purple-700 ring-1 ring-purple-500"
                  : "border-slate-200 hover:border-slate-300 text-slate-700"
              }`}
            >
              <FileImage className="w-5 h-5" />
              <span className="font-medium text-xs">PNG 图片</span>
            </button>

            <button
              onClick={() => setFormat("pdf")}
              className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center space-y-2 transition-all ${
                format === "pdf"
                  ? "border-purple-500 bg-purple-50/50 text-purple-700 ring-1 ring-purple-500"
                  : "border-slate-200 hover:border-slate-300 text-slate-700"
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium text-xs">PDF 文档</span>
            </button>

            <button
              onClick={() => setFormat("svg")}
              className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center space-y-2 transition-all ${
                format === "svg"
                  ? "border-purple-500 bg-purple-50/50 text-purple-700 ring-1 ring-purple-500"
                  : "border-slate-200 hover:border-slate-300 text-slate-700"
              }`}
            >
              <Code2 className="w-5 h-5" />
              <span className="font-medium text-xs">SVG 矢量图</span>
            </button>
          </div>

          <button
            disabled={loading}
            onClick={handleExport}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? "导出中..." : `确认导出 (${format.toUpperCase()})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
