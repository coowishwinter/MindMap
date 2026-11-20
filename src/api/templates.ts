import { apiClient } from "./client.js";

export async function getTemplateCategoriesApi() {
  const res = await apiClient.get("/template-categories");
  return res.data;
}

export async function getTemplatesApi(params?: { category?: string; page?: number; pageSize?: number; q?: string }) {
  const res = await apiClient.get("/templates", { params });
  return res.data;
}

export async function getTemplateApi(id: number) {
  const res = await apiClient.get(`/templates/${id}`);
  return res.data;
}

export async function publishTemplateApi(mapId: number, data: { categoryId: number; title: string; description?: string }) {
  const res = await apiClient.post(`/maps/${mapId}/publish-template`, data);
  return res.data;
}

export async function useTemplateApi(templateId: number) {
  const res = await apiClient.post(`/templates/${templateId}/use`);
  return res.data;
}

export async function updateTemplateApi(templateId: number, data: { title?: string; description?: string; categoryId?: number }) {
  const res = await apiClient.put(`/templates/${templateId}`, data);
  return res.data;
}

export async function deleteTemplateApi(templateId: number) {
  const res = await apiClient.delete(`/templates/${templateId}`);
  return res.data;
}
