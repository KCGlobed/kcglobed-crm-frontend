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
  type?: string;
  type_display?: string;
  action?: string;
  description?: string;
  from_stage?: string | null;
  to_stage?: string | null;
  from_value?: string | null;
  to_value?: string | null;
  note?: string | null;
  changes?: Record<string, any> | null;
  actor?: ReportsTo | null;
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
  actions?: string[];
}

export interface Lead {
  uid?: string;
  application_id?: string | null;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  alternate_phone?: string;
  email?: string;
  city?: string;
  program?: string;
  source?: string;
  stage?: Stage;
  assigned_to?: ReportsTo | null;
  assigned_by?: ReportsTo | null;
  assigned_at?: string | null;
  created_by?: ReportsTo | null;
  application?: Student | null;
  next_follow_up_at?: string | null;
  lost_reason?: string;
  lost_reason_detail?: string;
  available_actions?: string[];
  pending_follow_up?: FollowUp | null;
  interview?: Interview | null;
  payment?: Payment | null;
  letters?: Letter[];
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

// Workflow (GET /api/leads/workflow/)
export interface WorkflowOption {
  value?: string;
  label?: string;
}

export interface Workflow {
  stages?: Stage[];
  terminal_stages?: string[];
  call_outcomes?: WorkflowOption[];
  not_eligible_reasons?: WorkflowOption[];
  follow_up_statuses?: WorkflowOption[];
  action_permissions?: Record<string, { module?: string; action?: string }>;
}

// Follow-up
export interface FollowUp {
  id?: number;
  lead?: Lead;
  counsellor?: ReportsTo | null;
  follow_up_date?: string;
  follow_up_time?: string;
  notes?: string;
  status?: string;
  outcome?: string;
  is_overdue?: boolean;
  completed_at?: string | null;
  created_at?: string;
}

// Call Log
export interface CallLog {
  id?: number;
  counsellor?: ReportsTo | null;
  called_at?: string;
  outcome?: string;
  reason?: string;
  reason_detail?: string;
  notes?: string;
  follow_up?: number | null;
  created_at?: string;
}

// Lead Assignment history
export interface LeadAssignment {
  id?: number;
  counsellor?: ReportsTo | null;
  assignment_type?: string;
  assigned_by?: ReportsTo | null;
  note?: string;
  assigned_at?: string;
}

// Student application (students module)
export interface Student {
  id?: number;
  application_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  contact_name?: string;
  contact_phone?: string;
  date_of_birth?: string | null;
  gender?: number | string | null;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  tenth_passing_year?: string | number | null;
  tenth_passing_percentage?: string | number | null;
  tenth_score_type?: string;
  tenth_medium?: string;
  twelveth_passing_year?: string | number | null;
  twelveth_passing_percentage?: string | number | null;
  twelveth_score_type?: string;
  twelveth_medium?: string;
  medium_instruction?: string;
  other_instruction?: string;
  pg_status?: string;
  pg_percentage?: string | number | null;
  institution?: string;
  higher_education_status?: string;
  higher_qualification?: string;
  higher_qualification_institution?: string;
  ug_score_type?: string;
  employement_status?: string;
  student_experience?: string;
  guardian_dropdown?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_email?: string;
  guardian_other_reason?: string;
  guardian_key_status?: string;
  initial_program?: string;
  final_program?: string;
  fee_waiver_category?: string;
  referral_code?: string;
  referred_code?: string;
  profile_status?: boolean | string;
  status?: boolean | string;
  lead_uid?: string;
  profile_completed_at?: string | null;
  profile_completed_by?: ReportsTo | string | null;
  approved_at?: string | null;
  approved_by?: ReportsTo | string | null;
  document_email_sent_at?: string | null;
  // Full object on the lead detail payload; a plain stage code string on list rows
  stage?: Stage | string;
  lead?: Lead;
  missing_fields?: string[];
  created_at?: string;
  updated_at?: string;
}

// Student document (checklist row and pending-review row share this shape)
export interface StudentDocument {
  id?: number;
  document_type?: string;
  label?: string;
  required?: boolean;
  status?: string;
  original_name?: string;
  size?: number;
  uploaded_at?: string;
  uploaded_by?: ReportsTo | null;
  reviewed_at?: string | null;
  reviewed_by?: ReportsTo | null;
  rejection_reason?: string | null;
  download_url?: string;
  document?: StudentDocument | null;
  lead?: Lead;
  application?: Student | null;
  application_id?: string;
  full_name?: string;
  is_current?: boolean;
}

// Interview
export interface Interview {
  id?: number;
  lead?: Lead;
  application_id?: string;
  full_name?: string;
  counsellor?: ReportsTo | null;
  interviewer?: ReportsTo | null;
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  mode?: string;
  meeting_link?: string;
  location?: string;
  notes?: string;
  status?: string;
  result?: string;
  result_by?: ReportsTo | null;
  result_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Payment
export interface Payment {
  uid?: string;
  lead?: Lead;
  purpose?: string;
  amount?: string | number;
  currency?: string;
  method?: string;
  status?: string;
  gateway?: string;
  gateway_order_id?: string | null;
  gateway_payment_id?: string | null;
  failure_reason?: string | null;
  payment_mode?: string | null;
  transaction_id?: string | null;
  payment_date?: string | null;
  proof_url?: string | null;
  notes?: string;
  created_by?: ReportsTo | null;
  created_at?: string;
  paid_at?: string | null;
  verified_by?: ReportsTo | null;
  verified_at?: string | null;
}

// Letter
export interface Letter {
  uid?: string;
  letter_type?: string;
  label?: string;
  letter_number?: string;
  is_current?: boolean;
  generated_by?: ReportsTo | null;
  generated_at?: string;
  download_url?: string;
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
