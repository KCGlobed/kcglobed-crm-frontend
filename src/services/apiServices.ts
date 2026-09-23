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
export const fetchRolesApi = async (): Promise<any> => {
  return await apiRequest("/access/roles/", "GET");
};

export const fetchRoleByIdApi = async (roleId: number): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/`, "GET");
};

export const createRoleApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/roles/", "POST", payload);
};

export const fetchRolePermissionsApi = async (roleId: number): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/permissions/`, "GET");
};

export const updateRolePermissionsApi = async (roleId: number, payload: any): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/permissions/`, "PUT", payload);
};

export const deleteRoleApi = async (roleId: number): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/`, "DELETE");
};

// ----------------Module service------- //
export const fetchModulesApi = async (): Promise<any> => {
  return await apiRequest("/access/modules/", "GET");
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
export const fetchUsersApi = async (): Promise<any> => {
  return await apiRequest("/access/users/", "GET");
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
