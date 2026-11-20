import React, { useState } from "react";
import { X, Share2, Copy, Check, Globe, Shield, Link2 } from "lucide-react";
import { createShareLinkApi } from "../api/maps.js";

export const ShareModal: React.FC<{
  mapId: number;
  isOpen: boolean;
  onClose: () => void;
}> = ({ mapId, isOpen, onClose }) => {
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    setLoading(true);
    try {
      const res = await createShareLinkApi(mapId, { permission });
      const fullUrl = `${window.location.origin}${res.url}`;
      setShareUrl(fullUrl);
    } catch (err) {
      alert("生成分享链接失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">分享思维导图</h3>
            <p className="text-xs text-slate-500">生成可访问链接，快速邀请他人协作或浏览</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">访问权限设置</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPermission("view")}
                className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition-all ${
                  permission === "view"
                    ? "border-blue-500 bg-blue-50/50 text-blue-700 ring-1 ring-blue-500"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <Globe className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-xs">仅浏览 (Read-only)</div>
                  <div className="text-[10px] opacity-75">他人仅可查阅导图</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPermission("edit")}
                className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition-all ${
                  permission === "edit"
                    ? "border-blue-500 bg-blue-50/50 text-blue-700 ring-1 ring-blue-500"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <Shield className="w-4 h-4" />
                <div>
                  <div className="font-semibold text-xs">可编辑 (Collaborate)</div>
                  <div className="text-[10px] opacity-75">他人可实时协同编辑</div>
                </div>
              </button>
            </div>
          </div>

          {!shareUrl ? (
            <button
              disabled={loading}
              onClick={handleGenerateLink}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors flex items-center justify-center space-x-2 shadow-sm"
            >
              <Link2 className="w-4 h-4" />
              <span>{loading ? "生成链接中..." : "生成分享链接"}</span>
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">专属分享链接</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "已复制" : "复制"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
