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
export const fetchModulesApi = async (params?: { page?: number; page_size?: number | string }): Promise<any> => {
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
export const fetchLeadsApi = async (params?: { page?: number; page_size?: number; search?: string; stage?: string; assigned_to?: string; unassigned?: boolean | string; program?: string; source?: string; created_from?: string; created_to?: string; follow_up_from?: string; follow_up_to?: string; ordering?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.stage) query.append("stage", params.stage);
  if (params?.assigned_to) query.append("assigned_to", params.assigned_to);
  if (params?.unassigned) query.append("unassigned", "true");
  if (params?.program) query.append("program", params.program);
  if (params?.source) query.append("source", params.source);
  if (params?.created_from) query.append("created_from", params.created_from);
  if (params?.created_to) query.append("created_to", params.created_to);
  if (params?.follow_up_from) query.append("follow_up_from", params.follow_up_from);
  if (params?.follow_up_to) query.append("follow_up_to", params.follow_up_to);
  if (params?.ordering) query.append("ordering", params.ordering);
  const queryString = query.toString();
  return await apiRequest(`/leads/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchLeadWorkflowApi = async (): Promise<any> => {
  return await apiRequest("/leads/workflow/", "GET");
};

export const assignLeadApi = async (leadUid: string, payload: { assigned_to: string | null; note?: string }): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/assign/`, "PATCH", payload);
};

export const autoAssignLeadApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/auto-assign/`, "POST");
};

export const fetchLeadAssignmentsApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/assignments/`, "GET");
};

export const startLeadCallApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/call/start/`, "POST");
};

export const recordLeadCallApi = async (leadUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/call/`, "POST", payload);
};

export const fetchLeadCallsApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/call/`, "GET");
};

export const fetchLeadFollowUpsApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/follow-ups/`, "GET");
};

export const createLeadFollowUpApi = async (leadUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/follow-ups/`, "POST", payload);
};

export const markLeadInterestedApi = async (leadUid: string, payload: { notes?: string }): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/mark-interested/`, "POST", payload);
};

export const fetchFollowUpsApi = async (params?: { page?: number; page_size?: number; scope?: string; status?: string; counsellor?: string; date_from?: string; date_to?: string; search?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.scope) query.append("scope", params.scope);
  if (params?.status) query.append("status", params.status);
  if (params?.counsellor) query.append("counsellor", params.counsellor);
  if (params?.date_from) query.append("date_from", params.date_from);
  if (params?.date_to) query.append("date_to", params.date_to);
  if (params?.search) query.append("search", params.search);
  const queryString = query.toString();
  return await apiRequest(`/leads/follow-ups/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const updateFollowUpApi = async (followUpId: number, payload: any): Promise<any> => {
  return await apiRequest(`/leads/follow-ups/${followUpId}/`, "PATCH", payload);
};

export const fetchLeadActivitiesApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/activities/?page_size=all`, "GET");
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

// ----------------Student service------- //
export const fetchLeadProfileApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/profile/`, "GET");
};

export const updateLeadProfileApi = async (leadUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/profile/`, "PATCH", payload);
};

export const completeLeadProfileApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/complete-profile/`, "POST");
};

export const sendDocumentEmailApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/send-document-email/`, "POST");
};

export const fetchLeadDocumentsApi = async (leadUid: string, history?: boolean): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/documents/${history ? "?history=true" : ""}`, "GET");
};

export const approveLeadProfileApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/approve-profile/`, "POST");
};

export const fetchStudentsApi = async (params?: { page?: number; page_size?: number; search?: string; stage?: string; profile_status?: string; status?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.stage) query.append("stage", params.stage);
  if (params?.profile_status) query.append("profile_status", params.profile_status);
  if (params?.status) query.append("status", params.status);
  const queryString = query.toString();
  return await apiRequest(`/students/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchStudentByIdApi = async (applicationId: string): Promise<any> => {
  return await apiRequest(`/students/${applicationId}/`, "GET");
};

export const fetchPendingReviewDocumentsApi = async (params?: { page?: number; page_size?: number; search?: string; document_type?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.search) query.append("search", params.search);
  if (params?.document_type) query.append("document_type", params.document_type);
  const queryString = query.toString();
  return await apiRequest(`/students/documents/pending-review/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const reviewStudentDocumentApi = async (documentId: number, payload: { status: string; rejection_reason?: string }): Promise<any> => {
  return await apiRequest(`/students/documents/${documentId}/review/`, "PATCH", payload);
};

export const downloadStudentDocumentApi = async (documentId: number): Promise<any> => {
  return await apiRequest(`/students/documents/${documentId}/download/`, "GET");
};

// ----------------Interview service------- //
export const fetchLeadInterviewApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/interview/`, "GET");
};

export const scheduleInterviewApi = async (leadUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/interview/`, "POST", payload);
};

export const fetchInterviewsApi = async (params?: { page?: number; page_size?: number; status?: string; result?: string; counsellor?: string; interviewer?: string; search?: string; date_from?: string; date_to?: string; view?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.status) query.append("status", params.status);
  if (params?.result) query.append("result", params.result);
  if (params?.counsellor) query.append("counsellor", params.counsellor);
  if (params?.interviewer) query.append("interviewer", params.interviewer);
  if (params?.search) query.append("search", params.search);
  if (params?.date_from) query.append("date_from", params.date_from);
  if (params?.date_to) query.append("date_to", params.date_to);
  if (params?.view) query.append("view", params.view);
  const queryString = query.toString();
  return await apiRequest(`/interviews/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchInterviewByIdApi = async (interviewId: number): Promise<any> => {
  return await apiRequest(`/interviews/${interviewId}/`, "GET");
};

export const updateInterviewStatusApi = async (interviewId: number, payload: { status: string; notes?: string }): Promise<any> => {
  return await apiRequest(`/interviews/${interviewId}/status/`, "PATCH", payload);
};

export const updateInterviewResultApi = async (interviewId: number, payload: { result: string; notes?: string }): Promise<any> => {
  return await apiRequest(`/interviews/${interviewId}/result/`, "PATCH", payload);
};

export const fetchInterviewersApi = async (search?: string): Promise<any> => {
  return await apiRequest(`/interviews/interviewers/${search ? `?search=${encodeURIComponent(search)}` : ""}`, "GET");
};

// ----------------Payment service------- //
export const fetchPaymentGatewayApi = async (): Promise<any> => {
  return await apiRequest("/payments/gateway/", "GET");
};

export const fetchLeadPaymentApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/payment/`, "GET");
};

export const initiateLeadPaymentApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/payment/`, "POST");
};

export const verifyLeadPaymentApi = async (leadUid: string, payload: any): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/payment/verify/`, "POST", payload);
};

export const recordOfflinePaymentApi = async (leadUid: string, payload: FormData): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/offline-payment/`, "POST", payload);
};

export const verifyOfflinePaymentApi = async (paymentUid: string, payload: { approve: boolean; notes?: string }): Promise<any> => {
  return await apiRequest(`/payments/${paymentUid}/verify/`, "POST", payload);
};

export const fetchPaymentsApi = async (params?: { page?: number; page_size?: number; status?: string; method?: string; search?: string; date_from?: string; date_to?: string }): Promise<any> => {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", String(params.page));
  if (params?.page_size) query.append("page_size", String(params.page_size));
  if (params?.status) query.append("status", params.status);
  if (params?.method) query.append("method", params.method);
  if (params?.search) query.append("search", params.search);
  if (params?.date_from) query.append("date_from", params.date_from);
  if (params?.date_to) query.append("date_to", params.date_to);
  const queryString = query.toString();
  return await apiRequest(`/payments/${queryString ? `?${queryString}` : ""}`, "GET");
};

export const fetchPaymentByIdApi = async (paymentUid: string): Promise<any> => {
  return await apiRequest(`/payments/${paymentUid}/`, "GET");
};

export const fetchPaymentProofApi = async (paymentUid: string): Promise<any> => {
  return await apiRequest(`/payments/${paymentUid}/proof/`, "GET");
};

// ----------------Letter service------- //
export const fetchLeadLettersApi = async (leadUid: string, history?: boolean): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/letters/${history ? "?history=true" : ""}`, "GET");
};

export const generateLeadLettersApi = async (leadUid: string): Promise<any> => {
  return await apiRequest(`/leads/${leadUid}/generate-letters/`, "POST");
};

export const downloadLetterApi = async (letterUid: string): Promise<any> => {
  return await apiRequest(`/letters/${letterUid}/download/`, "GET");
};


