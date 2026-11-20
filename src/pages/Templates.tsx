import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ArrowLeft,
  Search,
  Download,
  Sparkles,
  ChevronRight,
  User,
} from "lucide-react";
import {
  getTemplateCategoriesApi,
  getTemplatesApi,
  useTemplateApi,
  getTemplateApi,
} from "../api/templates.js";
import { TemplateItem, TemplateCategory, MapNodeItem } from "../types.js";
import { calculateTreeLayout } from "../lib/layout.js";

export const Templates: React.FC = () => {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedCatSlug, setSelectedCatSlug] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Preview Modal state
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [previewNodes, setPreviewNodes] = useState<MapNodeItem[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUsing, setIsUsing] = useState(false);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const cats = await getTemplateCategoriesApi();
        setCategories(cats);
      } catch (e) {}
    };
    fetchCats();
  }, []);

  const fetchTemplates = async (catSlug = selectedCatSlug, q = searchQuery) => {
    setLoading(true);
    try {
      const data = await getTemplatesApi({ category: catSlug, q });
      setTemplates(data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates(selectedCatSlug, searchQuery);
  }, [selectedCatSlug]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTemplates(selectedCatSlug, searchQuery);
  };

  const handleOpenPreview = async (templateId: number) => {
    try {
      const data = await getTemplateApi(templateId);
      setPreviewTemplate(data.template);
      setPreviewNodes(calculateTreeLayout(data.nodes));
      setShowPreviewModal(true);
    } catch (e) {
      alert("读取模板预览失败");
    }
  };

  const handleUseTemplate = async (templateId: number) => {
    setIsUsing(true);
    try {
      const res = await useTemplateApi(templateId);
      setShowPreviewModal(false);
      navigate(`/maps/${res.mapId}`);
    } catch (err) {
      alert("请先登录账号以使用此模板");
      navigate("/login");
    } finally {
      setIsUsing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-slate-800 text-lg">思维导图模板市场</span>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜索精选模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-xl">
            <span className="inline-flex items-center space-x-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>结构化沉淀与高效思考</span>
            </span>
            <h2 className="text-2xl font-black mb-2 tracking-tight">精选思维框架与领域模板</h2>
            <p className="text-xs text-blue-100 opacity-90 leading-relaxed">
              涵盖读书笔记、产品 PRD 需求拆解、项目 OKR 落地、复盘总结等高频场景，1秒开启结构化创作。
            </p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 border-b border-slate-200">
          <button
            onClick={() => setSelectedCatSlug("")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              selectedCatSlug === ""
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            全部场景
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatSlug(cat.slug)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCatSlug === cat.slug
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">正在载入分类模板...</div>
        ) : templates.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">暂无符合条件的模板</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => handleOpenPreview(tpl.id)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-200 p-5 cursor-pointer flex flex-col justify-between group relative"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100">
                      {tpl.categoryName}
                    </span>
                    <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <Download className="w-3 h-3 text-slate-400" />
                      <span>{tpl.downloadCount} 次使用</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {tpl.title}
                  </h3>

                  <p className="text-slate-500 text-xs line-clamp-3 mb-4 leading-relaxed">
                    {tpl.description || "提供清晰的思维导图树形分支框架与知识沉淀结构。"}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1 text-slate-400">
                    <User className="w-3.5 h-3.5" />
                    <span className="text-[11px]">{tpl.authorName}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUseTemplate(tpl.id);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl transition-colors shadow-xs flex items-center space-x-1"
                  >
                    <span>使用此模板</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Preview Modal */}
      {showPreviewModal && previewTemplate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{previewTemplate.title}</h3>
                <p className="text-xs text-slate-500">{previewTemplate.description}</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                关闭
              </button>
            </div>

            {/* Tree Branch Hierarchy Overview */}
            <div className="flex-1 overflow-y-auto py-6 my-2 bg-slate-50 rounded-2xl p-4 border border-slate-200">
              <div className="text-xs font-semibold text-slate-500 mb-3">导图节点结构预览：</div>
              <ul className="space-y-2 text-xs font-medium text-slate-700 pl-2">
                {previewNodes.map((n) => (
                  <li
                    key={n.nodeKey}
                    style={{ paddingLeft: `${(n.depth || 0) * 20}px` }}
                    className="flex items-center space-x-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                已有人使用此模板创作
              </span>
              <button
                disabled={isUsing}
                onClick={() => handleUseTemplate(previewTemplate.id)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
              >
                {isUsing ? "生成中..." : "一键使用生成全新导图"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
