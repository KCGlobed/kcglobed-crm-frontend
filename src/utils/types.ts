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
}

// Auth
export interface LoginCred {
  email: string;
  password: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  first_name: string;
  last_name: string;
  role: {
    id: number;
    name: string;
    slug: string;
  };
  is_active: boolean;
  is_admin: boolean;
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

export interface LoginResponse {
  status_code: number;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
    user: AuthUser;
    access: AuthAccess;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  loading: boolean;
  error: string | null;
  /** Optional profile details, read defensively by the header/sidebar. */
  user?: AuthUser | null;
  /** User access/permissions */
  access?: AuthAccess | null;
  /** Optional API origin used by some legacy screens. */
  baseUrl?: string | null;
}

// Theme
export type ThemeMode = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
}

// Notifications (UI-only until a notifications API exists)
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

// Role
export interface RoleItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  permission_codes: string[];
  permissions_detail?: PermissionDetail[];
  user_count?: number;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RolesListApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RoleItem[];
}

export interface CreateRolePayload {
  name: string;
  description: string;
  permissions: string[];
}

export interface UpdateRolePermissionsPayload {
  id: number;
  permissions: string[];
}

export interface UpdateRoleStatusPayload {
  id: number;
  is_active: boolean;
}

// User / Staff
export interface UserItem {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  is_superadmin: boolean;
  is_student: boolean;
  role: number | null;
  role_name: string | null;
  role_detail?: RoleItem | null;
  reports_to: number | null;
  reports_to_name: string | null;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface UsersListApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UserItem[];
}

export interface CreateUserPayload {
  email: string;
  full_name: string;
  phone?: string;
  role: number;
  password?: string;
  confirm_password?: string;
}
