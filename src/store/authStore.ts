import { create } from "zustand";
import { User } from "../types.js";
import { logoutApi } from "../api/auth.js";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (data: { user: User; accessToken: string; refreshToken: string }) => void;
  logout: () => Promise<void>;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: localStorage.getItem("refreshToken"),
  isAuthenticated: !!localStorage.getItem("accessToken"),

  setAuth: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(user));
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch (e) {
        // ignore error on logout
      }
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  initAuth: () => {
    const storedUser = localStorage.getItem("user");
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    if (storedUser && accessToken) {
      try {
        set({
          user: JSON.parse(storedUser),
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
  },
}));
