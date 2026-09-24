import { apiRequest } from "./apiRequest";

import { BASE_URL } from "../utils/constants";

import type { LoginCred } from "../utils/types";

// ----------------Auth service------- //
export const loginApi = async (payload: LoginCred): Promise<any> => {
  return await apiRequest("/auth/login/", "POST", payload);
};

export const refreshTokenApi = async (payload: { refresh: string }): Promise<any> => {
  return await apiRequest(`${BASE_URL}/auth/refresh/`, "POST", payload);
};

// ----------------Role service------- //
export const fetchRolesApi = async (params?: { page?: number; page_size?: number }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  const queryString = query.toString();
  return await apiRequest(`/access/roles/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchRoleByIdApi = async (roleId: number): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/`, "GET");
};

export const createRoleApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/roles/", "POST", payload);
};

export const fetchRolePermissionsApi = async (roleId: number, params?: { page?: number; page_size?: number }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  const queryString = query.toString();
  return await apiRequest(`/access/roles/${roleId}/permissions/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const updateRolePermissionsApi = async (roleId: number, payload: any): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/permissions/`, "PUT", payload);
};

export const deleteRoleApi = async (roleId: number): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/`, "DELETE");
};

// ----------------Module service------- //
export const fetchModulesApi = async (params?: { page?: number; page_size?: number }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  const queryString = query.toString();
  return await apiRequest(`/access/modules/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchModuleByIdApi = async (moduleId: number | string): Promise<any> => {
  return await apiRequest(`/access/modules/${moduleId}/`, "GET");
};

export const createModuleApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/modules/", "POST", payload);
};

export const updateModuleApi = async (moduleId: number | string, payload: any): Promise<any> => {
  return await apiRequest(`/access/modules/${moduleId}/`, "PATCH", payload);
};

// ----------------User service------- //
export const fetchUsersApi = async (params?: { page?: number; page_size?: number }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  const queryString = query.toString();
  return await apiRequest(`/access/users/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchUserByUidApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/`, "GET");
};

export const createUserApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/users/", "POST", payload);
};

export const updateUserRoleApi = async (userUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/role/`, "PATCH", payload);
};

// ----------------Reporting service------- //
export const fetchReportingTreeApi = async (): Promise<any> => {
  return await apiRequest("/access/users/reporting-tree/", "GET");
};
