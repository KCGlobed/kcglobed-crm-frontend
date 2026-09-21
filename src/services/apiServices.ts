import { apiRequest } from "./apiRequest";
import type {
  RoleItem,
  RolesListApiResponse,
  CreateRolePayload,
  ModulePermissionsGroup,
  UsersListApiResponse,
  UserItem,
  CreateUserPayload,
} from "../utils/types";

// ----------------Auth service------- //
export const loginApi = async (payload: { email: string; password: string }): Promise<any> => {
  return await apiRequest(`api/auth/login/`, "POST", payload);
};

export const refreshTokenApi = async (payload: { refresh: string }): Promise<any> => {
  return await apiRequest(`api/auth/refresh/`, "POST", payload);
};

// ----------------Roles service------- //
export async function fetchRolesApi(): Promise<RolesListApiResponse | RoleItem[]> {
  return await apiRequest(`api/roles/`, "GET");
}

export async function createRoleApi(payload: CreateRolePayload): Promise<RoleItem> {
  return await apiRequest(`api/roles/`, "POST", payload);
}

export async function updateRolePermissionsApi(id: number, permissions: string[]): Promise<RoleItem> {
  return await apiRequest(`api/roles/${id}/`, "PATCH", { permissions });
}

export async function updateRoleStatusApi(id: number, is_active: boolean): Promise<RoleItem> {
  return await apiRequest(`api/roles/${id}/`, "PATCH", { is_active });
}

export async function deleteRoleApi(id: number): Promise<any> {
  return await apiRequest(`api/roles/${id}/`, "DELETE");
}

export async function fetchPermissionsByModuleApi(): Promise<ModulePermissionsGroup[]> {
  return await apiRequest(`api/permissions/by-module/`, "GET");
}

// ----------------Users service------- //
export async function fetchUsersApi(): Promise<UsersListApiResponse> {
  return await apiRequest(`api/users/`, "GET");
}

export async function fetchUserByIdApi(userId: number): Promise<UserItem> {
  return await apiRequest(`api/users/${userId}/`, "GET");
}

export async function createUserApi(payload: CreateUserPayload): Promise<UserItem> {
  return await apiRequest(`api/users/`, "POST", payload);
}

export async function activateUserApi(userId: number): Promise<any> {
  return await apiRequest(`api/users/${userId}/activate/`, "POST");
}

export async function deactivateUserApi(userId: number): Promise<any> {
  return await apiRequest(`api/users/${userId}/`, "DELETE");
}
