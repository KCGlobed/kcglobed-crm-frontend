import { apiRequest } from "./apiRequest";

import type { LoginCred } from "../utils/types";

// ----------------Auth service------- //
export const loginApi = async (payload: LoginCred): Promise<any> => {
  return await apiRequest("/auth/login/", "POST", payload);
};

export const refreshTokenApi = async (payload: { refresh: string }): Promise<any> => {
  return await apiRequest("/auth/refresh/", "POST", payload);
};

export const logoutApi = async (payload: { refresh: string }): Promise<any> => {
  return await apiRequest("/auth/logout/", "POST", payload);
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

export const resetPasswordApi = async (payload: { uid: string; token: string; new_password: string; confirm_password: string; }): Promise<any> => {
  return await apiRequest("/auth/reset-password/", "POST", payload);
};

// ----------------Profile service------- //
export const fetchProfileApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/`, "GET");
};

export const changePasswordApi = async (payload: any): Promise<any> => {
  return await apiRequest("/auth/change-password/", "POST", payload);
};

// ----------------Menu service------- //
export const fetchMyMenuApi = async (): Promise<any> => {
  return await apiRequest("/access/me/menu/", "GET");
};

// ----------------Role service------- //
export const fetchRolesApi = async (params?: { page?: number; page_size?: number; search?: string; active?: boolean | string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.active !== undefined && params?.active !== "all" && params?.active !== "") query.append("active", String(params.active));
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

export const updateRoleApi = async (roleId: number, payload: any): Promise<any> => {
  return await apiRequest(`/access/roles/${roleId}/`, "PATCH", payload);
};

export const fetchPermissionCatalogApi = async (): Promise<any> => {
  return await apiRequest("/access/permissions/", "GET");
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

export const deleteModuleApi = async (moduleId: number | string): Promise<any> => {
  return await apiRequest(`/access/modules/${moduleId}/`, "DELETE");
};

// ----------------Lead service------- //
export const fetchLeadsApi = async (params?: { page?: number; page_size?: number }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  const queryString = query.toString();
  return await apiRequest(`/leads/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchLeadByIdApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/`, "GET");
};

export const fetchLeadAssigneesApi = async (): Promise<any> => {
  return await apiRequest("/leads/assignees/", "GET");
};

export const createLeadApi = async (payload: any): Promise<any> => {
  return await apiRequest("/leads/", "POST", payload);
};

export const deleteLeadApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/`, "DELETE");
};

export const updateLeadStageApi = async (leadUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/stage/`, "PATCH", payload);
};

export const fetchStageOptionsApi = async (): Promise<any> => {
  return await apiRequest("/leads/stages/options/", "GET");
};

// ----------------Stage service------- //
export const fetchStagesApi = async (params?: { page?: number; page_size?: number }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  const queryString = query.toString();
  return await apiRequest(`/leads/stages/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchStageByIdApi = async (stageId: number): Promise<any> => {
  return await apiRequest(`/leads/stages/${stageId}/`, "GET");
};

export const createStageApi = async (payload: any): Promise<any> => {
  return await apiRequest("/leads/stages/", "POST", payload);
};

export const updateStageApi = async (stageId: number, payload: any): Promise<any> => {
  return await apiRequest(`/leads/stages/${stageId}/`, "PATCH", payload);
};

export const deleteStageApi = async (stageId: number): Promise<any> => {
  return await apiRequest(`/leads/stages/${stageId}/`, "DELETE");
};

// ----------------User service------- //
export const fetchUsersApi = async (params?: { page?: number; page_size?: number; search?: string; role?: string; is_active?: boolean | string; team?: number | string; department?: number | string; reports_to?: string; ordering?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.role) query.append("role", params.role);
  if (params?.is_active !== undefined && params?.is_active !== "all" && params?.is_active !== "") query.append("is_active", String(params.is_active));
  if (params?.team) query.append("team", String(params.team));
  if (params?.department) query.append("department", String(params.department));
  if (params?.reports_to) query.append("reports_to", params.reports_to);
  if (params?.ordering) query.append("ordering", params.ordering);
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

export const setUserPasswordApi = async (userUid: string, payload: { new_password: string; confirm_password: string }): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/set-password/`, "PATCH", payload);
};

export const deleteUserApi = async (userUid: string): Promise<any> => {
  return await apiRequest(`/access/users/${userUid}/`, "DELETE");
};

// ----------------Department service------- //
export const fetchDepartmentsApi = async (params?: { page?: number; page_size?: number | string; search?: string; is_active?: boolean | string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.is_active !== undefined && params?.is_active !== "all" && params?.is_active !== "") query.append("is_active", String(params.is_active));
  const queryString = query.toString();
  return await apiRequest(`/access/departments/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchDepartmentByIdApi = async (departmentId: number): Promise<any> => {
  return await apiRequest(`/access/departments/${departmentId}/`, "GET");
};

export const fetchDepartmentOptionsApi = async (): Promise<any> => {
  return await apiRequest("/access/departments/options/", "GET");
};

export const createDepartmentApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/departments/", "POST", payload);
};

export const updateDepartmentApi = async (departmentId: number, payload: any): Promise<any> => {
  return await apiRequest(`/access/departments/${departmentId}/`, "PATCH", payload);
};

export const activateDepartmentApi = async (departmentId: number): Promise<any> => {
  return await apiRequest(`/access/departments/${departmentId}/activate/`, "PATCH");
};

export const deactivateDepartmentApi = async (departmentId: number): Promise<any> => {
  return await apiRequest(`/access/departments/${departmentId}/deactivate/`, "PATCH");
};

export const deleteDepartmentApi = async (departmentId: number): Promise<any> => {
  return await apiRequest(`/access/departments/${departmentId}/`, "DELETE");
};

// ----------------Team service------- //
export const fetchTeamsApi = async (params?: { page?: number; page_size?: number | string; search?: string; is_active?: boolean | string; department?: number | string; parent?: number | string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.is_active !== undefined && params?.is_active !== "all" && params?.is_active !== "") query.append("is_active", String(params.is_active));
  if (params?.department) query.append("department", String(params.department));
  if (params?.parent) query.append("parent", String(params.parent));
  const queryString = query.toString();
  return await apiRequest(`/access/teams/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchTeamByIdApi = async (teamId: number): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/`, "GET");
};

export const fetchTeamOptionsApi = async (params?: { department?: number | string; search?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.department) query.append("department", String(params.department));
  if (params?.search) query.append("search", params.search);
  const queryString = query.toString();
  return await apiRequest(`/access/teams/options/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const createTeamApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/teams/", "POST", payload);
};

export const updateTeamApi = async (teamId: number, payload: any): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/`, "PATCH", payload);
};

export const updateTeamLeaderApi = async (teamId: number, payload: { leader: string | null }): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/leader/`, "PATCH", payload);
};

export const fetchTeamMembersApi = async (teamId: number, params?: { page?: number; page_size?: number; search?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  const queryString = query.toString();
  return await apiRequest(`/access/teams/${teamId}/members/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const addTeamMembersApi = async (teamId: number, payload: { users: string[] }): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/members/`, "POST", payload);
};

export const removeTeamMembersApi = async (teamId: number, payload: { users: string[] }): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/members/`, "DELETE", payload);
};

export const activateTeamApi = async (teamId: number): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/activate/`, "PATCH");
};

export const deactivateTeamApi = async (teamId: number): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/deactivate/`, "PATCH");
};

export const deleteTeamApi = async (teamId: number): Promise<any> => {
  return await apiRequest(`/access/teams/${teamId}/`, "DELETE");
};

// ----------------Audit Log service------- //
export const fetchAuditLogsApi = async (params?: { page?: number; page_size?: number; search?: string; user?: string; action?: string; module?: string; success?: boolean | string; date_from?: string; date_to?: string; ordering?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.user) query.append("user", params.user);
  if (params?.action) query.append("action", params.action);
  if (params?.module) query.append("module", params.module);
  if (params?.success !== undefined && params?.success !== "all" && params?.success !== "") query.append("success", String(params.success));
  if (params?.date_from) query.append("date_from", params.date_from);
  if (params?.date_to) query.append("date_to", params.date_to);
  if (params?.ordering) query.append("ordering", params.ordering);
  const queryString = query.toString();
  return await apiRequest(`/access/audit-logs/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchAuditLogByIdApi = async (auditId: number): Promise<any> => {
  return await apiRequest(`/access/audit-logs/${auditId}/`, "GET");
};

export const fetchAuditLogOptionsApi = async (): Promise<any> => {
  return await apiRequest("/access/audit-logs/options/", "GET");
};

// ----------------Configuration service------- //
export const fetchConfigurationsApi = async (params?: { page?: number; page_size?: number | string; search?: string; group?: string; is_active?: boolean | string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.group) query.append("group", params.group);
  if (params?.is_active !== undefined && params?.is_active !== "all" && params?.is_active !== "") query.append("is_active", String(params.is_active));
  const queryString = query.toString();
  return await apiRequest(`/access/configurations/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchConfigurationByIdApi = async (configId: number): Promise<any> => {
  return await apiRequest(`/access/configurations/${configId}/`, "GET");
};

export const createConfigurationApi = async (payload: any): Promise<any> => {
  return await apiRequest("/access/configurations/", "POST", payload);
};

export const updateConfigurationApi = async (configId: number, payload: any): Promise<any> => {
  return await apiRequest(`/access/configurations/${configId}/`, "PATCH", payload);
};

export const activateConfigurationApi = async (configId: number): Promise<any> => {
  return await apiRequest(`/access/configurations/${configId}/activate/`, "PATCH");
};

export const deactivateConfigurationApi = async (configId: number): Promise<any> => {
  return await apiRequest(`/access/configurations/${configId}/deactivate/`, "PATCH");
};

export const deleteConfigurationApi = async (configId: number): Promise<any> => {
  return await apiRequest(`/access/configurations/${configId}/`, "DELETE");
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


