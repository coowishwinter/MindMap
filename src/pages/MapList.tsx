import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  BookOpen,
  LogOut,
  Trash2,
  Clock,
  User as UserIcon,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  Network,
} from "lucide-react";
import { getMapsApi, createMapApi, deleteMapApi } from "../api/maps.js";
import { useAuthStore } from "../store/authStore.js";
import { MindMap } from "../types.js";

export const MapList: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [maps, setMaps] = useState<MindMap[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchMaps = async (p = page, q = searchQuery) => {
    setLoading(true);
    try {
      const data = await getMapsApi({ page: p, pageSize: 12, q });
      setMaps(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch maps:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaps(page, searchQuery);
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMaps(1, searchQuery);
  };

  const handleCreateMap = async () => {
    const title = newTitle.trim() || "未命名导图";
    try {
      const res = await createMapApi({ title });
      setShowCreateModal(false);
      setNewTitle("");
      navigate(`/maps/${res.map.id}`);
    } catch (err) {
      alert("创建导图失败，请重试");
    }
  };

  const handleDeleteMap = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确认删除该导图及其所有节点吗？此操作不可撤销。")) return;
    try {
      await deleteMapApi(id);
      fetchMaps(page, searchQuery);
    } catch (err) {
      alert("只有所有者可以删除该导图");
    }
  };

  const totalPages = Math.ceil(total / 12) || 1;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
            <Network className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">我的思维导图</span>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/templates")}
            className="px-3.5 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-medium text-xs flex items-center space-x-2 transition-colors border border-slate-200"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span>模板市场</span>
          </button>

          <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
            <div className="flex items-center space-x-2">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full border" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                  {user?.username?.substring(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-semibold text-slate-700">{user?.username}</span>
            </div>

            <button
              onClick={() => logout()}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col space-y-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative max-w-md w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜索导图标题..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </form>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>新建思维导图</span>
          </button>
        </div>

        {/* Mind Map Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">加载导图列表中...</div>
        ) : maps.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-xs max-w-lg mx-auto my-12">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Network className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-700 text-base mb-1">暂无思维导图</h3>
            <p className="text-slate-400 text-xs mb-6">点击上方“新建思维导图”开始绘制你的第一个结构化图表</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-blue-600 text-white font-medium text-xs rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center space-x-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>创建我的第一个导图</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {maps.map((map) => (
              <div
                key={map.id}
                onClick={() => navigate(`/maps/${map.id}`)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-200 p-5 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center space-x-1 ${
                        map.role === "owner"
                          ? "bg-blue-50 text-blue-700 border border-blue-100"
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}
                    >
                      <span>{map.role === "owner" ? "所有者" : "协同编辑"}</span>
                    </span>

                    {map.role === "owner" && (
                      <button
                        onClick={(e) => handleDeleteMap(map.id, e)}
                        className="p-1 text-slate-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="删除导图"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-800 text-base mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {map.title}
                  </h3>

                  <p className="text-slate-400 text-xs line-clamp-2 mb-4">
                    {map.description || "包含丰富的分支与关联论述节点"}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{new Date(map.lastEditedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {map.isPublic ? (
                      <span title="公开"><Globe className="w-3 h-3 text-emerald-500" /></span>
                    ) : (
                      <span title="私有"><Lock className="w-3 h-3 text-slate-400" /></span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 pt-6">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-semibold text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <h3 className="font-bold text-slate-800 text-lg mb-4">新建思维导图</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">导图主题名称</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="例如：2026年终总结与规划"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateMap()}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleCreateMap}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs"
                >
                  确认创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
