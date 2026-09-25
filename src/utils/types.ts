// Generic API Response
export interface PaginationInfo {
  total_results?: number | null;
  total_pages?: number | null;
  current_page?: number | null;
  next_page?: number | null;
  previous_page?: number | null;
  page_size?: number | null;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  status_code?: number;
  status?: string | number;
  message?: string;
  pagination?: PaginationInfo;
  data: T;
}

// Pagination
export interface Pagination<T> {
  data?: T[];
  count?: number | null;
  total_results?: number | null;
  total_pages?: number | null;
  current_page?: number | null;
  next_page?: number | null;
  page_size?: number | null;
  previous_page?: number | null;
  next?: string | null;
  previous?: string | null;
  page?: number;
  loading?: boolean;
  error?: string | null;
  pagination?: PaginationInfo;
}

// Auth
export interface LoginCred {
  email: string;
  password: string;
}

export interface AuthUser {
  uid?: string;
  id?: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  role?: {
    id?: number;
    name?: string;
    slug?: string;
  };
  role_name?: string;
  is_active?: boolean;
  is_admin?: boolean;
  is_superadmin?: boolean;
}

export interface AuthAccess {
  role: {
    id: number;
    name: string;
    slug: string;
  };
  full_access: boolean;
  permissions: Record<string, unknown>;
}

export type LoginResponse = ApiResponse<{
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  access: AuthAccess;
}>;

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  loading: boolean;
  error: string | null;
  user?: AuthUser | null;
  access?: AuthAccess | null;
  baseUrl?: string | null;
}

// Theme
export type ThemeMode = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
}

// Notifications
export type NotificationKind = "lead" | "task" | "user" | "system";

export interface NotificationItem {
  id: number;
  kind: NotificationKind;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

// Permission
export interface PermissionDetail {
  id: number;
  code: string;
  name: string;
  module: string;
  description: string;
}

export interface ModulePermissionsGroup {
  module: string;
  permissions: PermissionDetail[];
}

// Module
export interface Module {
  id?: number;
  name?: string;
  code?: string;
  module_code?: string;
  description?: string;
  parent?: number | null;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
}

// Role
export interface RolePermission {
  module?: string;
  module_name?: string;
  parent?: string | null;
  can_view?: boolean;
  can_add?: boolean;
  can_change?: boolean;
  can_delete?: boolean;
  can_export?: boolean;
}

export interface RoleAccess {
  role?: Role;
  full_access?: boolean;
  permissions?: RolePermission[];
}

export interface Role {
  id?: number;
  name?: string;
  slug?: string;
  description?: string;
  is_system?: boolean;
  is_default?: boolean;
  is_active?: boolean;
  user_count?: number;
  created_at?: string;
  updated_at?: string;
  permissions?: RolePermission[];
  permission_codes?: string[];
  permissions_detail?: PermissionDetail[];
  created_by_name?: string | null;
}

// Reports To
export interface ReportsTo {
  uid?: string;
  name?: string;
  email?: string;
}

// User / Staff
export interface User {
  uid?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone1?: string | null;
  role?: Role | number | string | null;
  reports_to?: ReportsTo | number | null;
  is_active?: boolean;
  is_admin?: boolean;
  id?: number;
  full_name?: string;
  phone?: string;
  role_name?: string | null;
  role_detail?: Role | null;
  reports_to_name?: string | null;
  is_superadmin?: boolean;
  is_student?: boolean;
  date_joined?: string;
  last_login?: string | null;
  password?: string;
  confirm_password?: string;
  full_access?: boolean;
  overrides?: any[];
  effective?: Record<string, Record<string, boolean>>;
}

export interface ReportingNode {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  team_count?: number;
  team?: ReportingNode[];
}

export interface ReportingOption {
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
}
