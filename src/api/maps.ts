import { apiClient } from "./client.js";

export async function getMapsApi(params?: { page?: number; pageSize?: number; q?: string }) {
  const res = await apiClient.get("/maps", { params });
  return res.data;
}

export async function createMapApi(data: { title: string }) {
  const res = await apiClient.post("/maps", data);
  return res.data;
}

export async function getMapApi(id: number) {
  const res = await apiClient.get(`/maps/${id}`);
  return res.data;
}

export async function updateMapApi(id: number, data: { title?: string; description?: string; isPublic?: boolean }) {
  const res = await apiClient.put(`/maps/${id}`, data);
  return res.data;
}

export async function deleteMapApi(id: number) {
  const res = await apiClient.delete(`/maps/${id}`);
  return res.data;
}

export async function getCollaboratorsApi(id: number) {
  const res = await apiClient.get(`/maps/${id}/collaborators`);
  return res.data;
}

export async function addCollaboratorApi(id: number, data: { email: string; role: "editor" | "viewer" }) {
  const res = await apiClient.put(`/maps/${id}/collaborators`, data);
  return res.data;
}

export async function removeCollaboratorApi(id: number, userId: number) {
  const res = await apiClient.delete(`/maps/${id}/collaborators/${userId}`);
  return res.data;
}

export async function createShareLinkApi(id: number, data: { permission: "view" | "edit"; expiresDays?: number }) {
  const res = await apiClient.post(`/maps/${id}/share-links`, data);
  return res.data;
}

export async function deleteShareLinkApi(token: string) {
  const res = await apiClient.delete(`/share-links/${token}`);
  return res.data;
}

export async function getSharedMapApi(token: string) {
  const res = await apiClient.get(`/s/${token}`);
  return res.data;
}

export async function exportMapApi(id: number, data: { svg: string; format: "png" | "pdf" | "svg"; width?: number; height?: number }) {
  const res = await apiClient.post(`/maps/${id}/export`, data);
  return res.data;
}
