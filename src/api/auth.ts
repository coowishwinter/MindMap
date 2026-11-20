import { apiClient } from "./client.js";

export async function registerApi(data: { email: string; username: string; password: string }) {
  const res = await apiClient.post("/auth/register", data);
  return res.data;
}

export async function loginApi(data: { email: string; password: string }) {
  const res = await apiClient.post("/auth/login", data);
  return res.data;
}

export async function logoutApi(refreshToken: string) {
  const res = await apiClient.post("/auth/logout", { refreshToken });
  return res.data;
}
