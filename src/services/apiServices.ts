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

export const logoutAllApi = async (): Promise<any> => {
  return await apiRequest("/auth/logout-all/", "POST");
};

// TODO: confirm this endpoint with the backend once the forgot-password API is ready
export const sendPasswordResetLinkApi = async (payload: { email: string }): Promise<any> => {
  return await apiRequest("/auth/forgot-password/", "POST", payload);
};

export const validateResetLinkApi = async (uid: string, token: string): Promise<any> => {
  return await apiRequest(`/auth/reset-password/${uid}/${token}/`, "GET");
};

export const resetPasswordApi = async (payload: {uid: string;token: string;new_password: string;confirm_password: string;}): Promise<any> => {
  return await apiRequest("/auth/reset-password/", "POST", payload);
};

// ----------------Profile service------- //
export const fetchProfileApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/`, "GET");
};

export const changePasswordApi = async (payload: any): Promise<any> => {
  return await apiRequest("/auth/change-password/", "POST", payload);
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

export const fetchRoleOptionsApi = async (): Promise<any> => {
  return await apiRequest("/access/roles/options/", "GET");
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
export const fetchUsersApi = async (params?: { page?: number; page_size?: number; search?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  const queryString = query.toString();
  return await apiRequest(`/access/users/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchUserPermissionsApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/permissions/`, "GET");
};

export const createUserApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/users/", "POST", payload);
};

export const updateUserApi = async (userUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/`, "PATCH", payload);
};

export const updateUserRoleApi = async (userUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/`, "PATCH", payload);
};

export const updateUserReportsToApi = async (userUid: string, payload: { reports_to: string | null }): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/`, "PATCH", payload);
};

export const activateUserApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/activate/`, "PATCH");
};

export const deactivateUserApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/deactivate/`, "PATCH");
};

// ----------------Reporting service------- //
export const fetchReportingTreeByUserApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/reporting-tree/?user=${userUid}`, "GET");
};


//-----------------Reporting Management service------- //

export const fetchReportingManagementOptionsApi = async (params?: { page?: number; page_size?: number }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  const queryString = query.toString();
  return await apiRequest(`/access/users/reporting-options/${queryString ? `?${queryString}` : ""}`, "GET");
};


