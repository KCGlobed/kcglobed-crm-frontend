// Generic API Response
export interface PaginationInfo {
  total_results?: number | null;
  total_pages?: number | null;
  current_page?: number | null;
  next_page?: number | null;
  previous_page?: number | null;
  page_size?: number | null;
}

export interface Essay { id: string; [key: string]: any; }

export interface StepProps {
  onDemandQuestionSave?: () => Promise<string | undefined> | string | undefined | void;
  stepKey?: string;
  data?: any;
  updateData?: any;
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
  permissions: Record<string, any>;
  scopes?: Record<string, string>;
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
  actionLoading?: boolean;
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
  parent?: string | number | null;
  sort_order?: number;
  icon?: string;
  path?: string;
  is_active?: boolean;
  created_at?: string;
}

// Role
export interface RolePermission {
  module?: string;
  module_name?: string;
  icon?: string;
  path?: string;
  show_in_menu?: boolean;
  parent?: string | null;
  can_view?: boolean;
  can_add?: boolean;
  can_change?: boolean;
  can_delete?: boolean;
  can_export?: boolean;
  can_import?: boolean;
  can_assign?: boolean;
  can_approve?: boolean;
  can_manage?: boolean;
  data_scope?: string;
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
  role?: string;
}

// Department
export interface Department {
  id?: number;
  name?: string;
  code?: string;
  description?: string;
  head?: ReportsTo | null;
  member_count?: number;
  team_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  head_uid?: string | null;
}

// Team
export interface Team {
  id?: number;
  name?: string;
  code?: string;
  description?: string;
  department?: Department | number | null;
  department_detail?: Department | null;
  parent?: number | null;
  parent_detail?: Team | null;
  leader?: ReportsTo | null;
  member_count?: number;
  child_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  leader_uid?: string | null;
}

// User / Staff
export interface User {
  uid?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone1?: string | null;
  phone2?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  dob?: string | null;
  role?: Role | number | string | null;
  reports_to?: ReportsTo | number | null;
  team?: Team | number | null;
  department?: Department | number | null;
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
  created_at?: string;
  updated_at?: string;
  last_login?: string | null;
  password?: string;
  confirm_password?: string;
  old_password?: string;
  new_password?: string;
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

// Menu
export interface MenuPermissions {
  view?: boolean;
  add?: boolean;
  change?: boolean;
  delete?: boolean;
  export?: boolean;
}

export interface MenuItem {
  code?: string;
  name?: string;
  icon?: string;
  path?: string;
  permissions?: MenuPermissions;
  children?: MenuItem[];
}

// Lead
export interface LeadQuery {
  id?: number;
  question?: string;
  status?: string;
  created_at?: string;
}

export interface LeadActivity {
  id?: number;
  action?: string;
  description?: string;
  created_at?: string;
}

// Stage
export interface Stage {
  id?: number;
  name?: string;
  code?: string;
  kind?: string;
  color?: string;
  sort_order?: number;
  is_default?: boolean;
  is_active?: boolean;
  lead_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Lead {
  uid?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  city?: string;
  source?: string;
  stage?: Stage;
  assigned_to?: ReportsTo | null;
  utm_source?: string;
  utm_campaign?: string;
  created_at?: string;
  updated_at?: string;
  state?: string;
  country?: string;
  remarks?: string;
  utm_medium?: string;
  utm_term?: string;
  utm_content?: string;
  landing_page?: string;
  referrer?: string;
  queries?: LeadQuery[];
  activities?: LeadActivity[];
}

// Audit Log
export interface AuditLog {
  id?: number;
  actor?: ReportsTo | null;
  actor_email?: string;
  action?: string;
  action_display?: string;
  module?: string;
  object_type?: string;
  object_id?: string;
  object_repr?: string;
  success?: boolean;
  message?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  created_at?: string;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

// Configuration
export interface Configuration {
  id?: number;
  key?: string;
  name?: string;
  group?: string;
  description?: string;
  data_type?: string;
  value?: any;
  default_value?: any;
  choices?: any[] | null;
  min_value?: number | null;
  max_value?: number | null;
  is_system?: boolean;
  is_active?: boolean;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}
