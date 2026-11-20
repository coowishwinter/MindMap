import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Network, Mail, Lock, ArrowRight } from "lucide-react";
import { loginApi } from "../api/auth.js";
import { useAuthStore } from "../store/authStore.js";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const data = await loginApi({ email, password });
      setAuth({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "登录失败，请检查账号与密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <Network className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">思维导图平台</h2>
          <p className="text-slate-500 text-sm mt-1">登录你的账号，开启高效协同思考</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium border border-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">邮箱地址</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-800"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2"
          >
            <span>{loading ? "登录中..." : "立即登录"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          还没有账号？{" "}
          <Link to="/register" className="text-blue-600 font-semibold hover:underline">
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
};
