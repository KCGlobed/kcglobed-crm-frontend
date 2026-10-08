export type ModuleKey =
  | 'dashboard'
  | 'leads'
  | 'tasks'
  | 'applications'
  | 'documents'
  | 'exams'
  | 'interviews'
  | 'offers'
  | 'payments'
  | 'loans'
  | 'communications'
  | 'automation'
  | 'reports'
  | 'users'
  | 'teams'
  | 'masters'
  | 'audit'

export type ActionKey =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'import'
  | 'reassign'
  | 'approve'

export type DataScope = 'own' | 'team' | 'location' | 'program' | 'cohort' | 'all'
export type FieldRuleMode = 'hidden' | 'readonly' | 'masked'

export interface ModulePermission {
  module: ModuleKey
  actions: ActionKey[]
}

export interface FieldRule {
  field: string
  mode: FieldRuleMode
}

export interface Ref {
  _id: string
  name: string
}

export type RoleKey = 'super_admin' | 'admin' | 'counsellor' | 'other'

export interface User {
  _id: string
  name: string
  email: string
  mobile?: string
  designation?: string
  isSuperAdmin: boolean
  /** Go-live role (§2) and its label */
  role?: RoleKey
  roleLabel?: string
  /** a temporary password must be replaced before anything else (GL-02) */
  mustChangePassword?: boolean
  createdBy?: Ref | null
  isActive: boolean
  receivesLeads: boolean
  team?: Ref | string | null
  reportingManager?: Ref | string | null
  permissions: ModulePermission[]
  dataScope: DataScope
  fieldRules: FieldRule[]
  templateKey?: string
  lastLoginAt?: string
  createdAt: string
}

export type TeamType = 'department' | 'team' | 'counsellor_group'

export interface TeamRef extends Ref {
  code?: string
  type?: TeamType
}

export type TeamMember = Pick<
  User,
  '_id' | 'name' | 'email' | 'mobile' | 'designation' | 'isActive' | 'receivesLeads' | 'lastLoginAt'
> & { reportingManager?: Ref | null }

export interface Team {
  _id: string
  name: string
  code?: string
  type: TeamType
  description?: string
  manager?: (Ref & { email?: string; designation?: string; mobile?: string }) | null
  parent?: TeamRef | null
  location?: string
  programs?: (Ref & { code?: string })[]
  receivesLeads: boolean
  isActive: boolean
  createdBy?: Ref | null
  createdAt?: string
  updatedAt?: string
  memberCount?: number
  subTeamCount?: number
  /** detail only */
  ancestors?: TeamRef[]
  children?: (Pick<Team, '_id' | 'name' | 'code' | 'type' | 'isActive' | 'location' | 'manager' | 'receivesLeads'> & {
    memberCount: number
  })[]
  members?: TeamMember[]
}

export interface TeamOption {
  _id: string
  name: string
  code?: string
  type?: TeamType
  parent?: string | null
}

export interface TeamTreeNode {
  _id: string
  name: string
  code?: string
  type?: TeamType
  location?: string
  isActive: boolean
  receivesLeads?: boolean
  manager?: Ref | null
  memberCount: number
  totalMembers: number
  children: TeamTreeNode[]
}

export interface LeadWorkload {
  total: number
  active: number
  converted: number
  lost: number
  assignedThisWeek: number
}

export interface TeamStats {
  includeSubTeams: boolean
  teamCount: number
  totals: LeadWorkload & { members: number; receivingLeads: number; conversionRate: number | null }
  byMember: (LeadWorkload & {
    user: Pick<User, '_id' | 'name' | 'designation' | 'isActive' | 'receivesLeads'> & { team?: Ref | null }
  })[]
}

export interface PermissionTemplate {
  _id: string
  key: string
  name: string
  description?: string
  permissions: ModulePermission[]
  dataScope: DataScope
  fieldRules: FieldRule[]
  isSystem: boolean
  /** users currently following this template */
  userCount?: number
  /** set when the template drives a go-live role (Admin / Admission Counsellor) */
  role?: RoleKey
  roleLabel?: string
}

export interface Source {
  _id: string
  name: string
  channel: string
  isActive: boolean
}

export interface Program {
  _id: string
  name: string
  code: string
  track?: string
  durationMonths?: number
  isActive: boolean
}

export interface Cohort {
  _id: string
  name: string
  program: (Ref & { code?: string }) | string
  startDate?: string
  endDate?: string
  capacity?: number
  status: 'planned' | 'open' | 'closed' | 'completed'
}

export interface SubStage {
  _id: string
  name: string
  counsellorAction?: string
  isActive: boolean
}

export interface Stage {
  _id: string
  name: string
  type: 'open' | 'converted' | 'lost'
  color?: string
  order: number
  isActive: boolean
  /** set only by the CRM (e.g. Untouched for new leads) — not selectable */
  isSystem?: boolean
  subStages?: SubStage[]
}

export interface Disposition {
  _id: string
  name: string
  category?: string
  requiresFollowUp: boolean
  isActive: boolean
}

export interface Tag {
  _id: string
  name: string
  color?: string
  isActive: boolean
}

export interface CustomFieldDef {
  _id: string
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'boolean'
  options: string[]
  required: boolean
  isActive: boolean
}

export interface MasterBootstrap {
  sources: Source[]
  programs: Program[]
  cohorts: Cohort[]
  stages: Stage[]
  dispositions: Disposition[]
  tags: Tag[]
  customFields: CustomFieldDef[]
}

export interface Lead {
  _id: string
  leadNo: string
  firstName: string
  lastName?: string
  email?: string
  mobile?: string
  altMobile?: string
  city?: string
  state?: string
  country?: string
  source?: Source | null
  firstSource?: Source | null
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
    landingPage?: string
  }
  referral?: { code?: string; partnerName?: string; partnerLink?: string }
  track: 'ads' | 'partner' | 'other'
  programInterest?: (Ref & { code?: string }) | null
  cohort?: Ref | null
  stage?: Stage | null
  /** _id of one of stage.subStages */
  subStage?: string | null
  stageChangedAt?: string
  status: 'active' | 'converted' | 'lost'
  lastDisposition?: string
  owner?: (Ref & { email?: string }) | null
  assignedAt?: string
  tags: Tag[]
  score: number
  consent?: { email: boolean; sms: boolean; whatsapp: boolean }
  customFields?: Record<string, unknown>
  lastActivityAt?: string
  /** earliest open follow-up */
  nextFollowUpAt?: string | null
  createdVia: string
  createdBy?: Ref | null
  createdAt: string
  updatedAt: string
  /** Go-live §6.1 system fields (list + detail) */
  createdViaLabel?: string
  reEnquiryCount?: number
  lastEnquiredAt?: string | null
  meta?: {
    campaignId?: string
    campaignName?: string
    adsetId?: string
    adsetName?: string
    adId?: string
    adName?: string
    formId?: string
    formName?: string
    leadId?: string
    createdTime?: string
  } | null
  uploadFileName?: string | null
  profileCompletion?: number
  /** Masters → Custom fields filled % (new backend); the old backend sent the discussion % here */
  customFieldsCompletion?: number
  /** the 27 Counsellor Discussion fields filled % — only sent by the new backend */
  discussionCompletion?: number
  optedOut?: { sms: boolean; email: boolean }
  isOverdue?: boolean
  ownerActive?: boolean | null
  profileValues?: Record<string, unknown>
  discussionValues?: Record<string, unknown>
}

export type TaskType =
  | 'call_back'
  | 'follow_up_call'
  | 'counselling_session'
  | 'expert_one_on_one'
  | 'document_collection'
  | 'other'

/** Follow-up on a lead (Deep Dive §10.2). */
export interface Task {
  _id: string
  lead: { _id: string; leadNo: string; firstName: string; lastName?: string }
  type: TaskType
  typeLabel: string
  dueAt: string
  assignee: Ref
  priority: 'high' | 'normal'
  reminderMinutes: 5 | 15 | 30 | 60
  notes?: string
  status: 'open' | 'done' | 'cancelled'
  isOverdue: boolean
  outcome?: string
  completedAt?: string
  completedBy?: Ref
  createdBy?: Ref
  createdAt: string
  updatedAt: string
}

export type TaskView = 'today' | 'overdue' | 'upcoming' | 'completed'

export interface TaskSummary {
  counts: Record<TaskView, number>
  types: { value: TaskType; label: string }[]
}

export interface LeadActivity {
  _id: string
  lead: string
  type: string
  title: string
  description?: string
  data?: Record<string, unknown>
  actor?: Ref | null
  actorType: 'user' | 'system' | 'student'
  actorName?: string
  createdAt: string
}

export interface Note {
  _id: string
  lead: string
  body: string
  category?: string
  createdBy: Ref
  createdAt: string
  updatedAt?: string
  edited?: boolean
  /** the author may edit within 15 minutes (GL-35) */
  editable?: boolean
}

export interface Notification {
  _id: string
  type: string
  title: string
  body?: string
  data?: { leadId?: string; taskId?: string; exportId?: string; url?: string; smart?: string; errorFile?: string }
  readAt?: string | null
  createdAt: string
}

export interface AuditLogEntry {
  _id: string
  actor?: (Ref & { email?: string }) | null
  actorName: string
  action: string
  module: string
  entityType?: string
  entityId?: string
  before?: unknown
  after?: unknown
  ip?: string
  createdAt: string
}

export interface Pagination {
  total_results: number
  total_pages: number
  current_page: number
  page_size: number
  next_page: number | null
  previous_page: number | null
}

export interface ApiListResponse<T> {
  success: boolean
  message: string
  status: number
  data: T[]
  pagination: Pagination
}

/** Candidate profile (User Profile Form Fields doc) — one per lead. */
export interface ProfilePersonal {
  firstName: string
  lastName: string
  email: string
  mobile: string
  dob: string
  gender: string
  state: string
  city: string
  pinCode: string
  address?: string
}

export interface ProfileGuardian {
  name: string
  relationship: string
  mobile: string
  email?: string
}

export interface ProfileSchooling {
  yearOfPassing: number
  gradeType: string
  score: number
  medium: string
}

export interface ProfileAcademic {
  class10: ProfileSchooling
  class12: ProfileSchooling
  ug: {
    qualification: string
    status: string
    institution: string
    gradeType?: string
    score?: number
    yearOfPassing: number
    medium: string
  }
  higherQualification: { has: boolean; details?: string }
}

export interface ProfileWork {
  employmentStatus: string
  organization?: string
  designation?: string
  functionalArea?: string
  experienceYears?: number
  experienceMonths?: number
}

export type ProfileStepKey = 'personal' | 'academic' | 'work'

export interface LeadProfile {
  lead: string
  exists: boolean
  personal: Partial<ProfilePersonal> | null
  guardian: Partial<ProfileGuardian> | null
  academic: ProfileAcademic | null
  work: ProfileWork | null
  declaration: { accepted: boolean; acceptedAt?: string; textVersion?: string }
  declarationText: string
  /** after the declaration (Deep Dive LM-17); only an admin can unlock */
  locked: boolean
  steps: Record<ProfileStepKey | 'documents', boolean>
  completionPercent: number
  updatedAt: string | null
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  status: number
  data: T
}

export interface ApiErrorBody {
  success: false
  message: string
  status: number
  errors: Record<string, string>
}

export interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  fileName: string
  errorFile: string | null
  errors: { row: number; reason: string }[]
  perCounsellor: { _id: string; name: string; count: number }[]
}

export interface ImportPreview {
  headers: string[]
  mapping: Record<string, string>
  totalRows: number
  rows: { row: number; values: Record<string, string>; error: string | null; duplicateOf: string | null }[]
  fields: { key: string; label: string; required: boolean }[]
}

export interface FilterFieldOption {
  value: string
  label: string
}

export interface FilterField {
  key: string
  label: string
  type: 'fk' | 'choice' | 'text' | 'date' | 'number' | 'bool' | 'optout'
  group: string
  ops: string[]
  options?: FilterFieldOption[] | null
}

export interface FilterCondition {
  field: string
  op: string
  value?: string | string[]
}

export interface FilterFieldsMeta {
  fields: FilterField[]
  smartFilters: { key: string; label: string }[]
  operators: string[]
  exportColumns: { key: string; label: string; group: string }[]
  assignReasons: string[]
}

export interface SavedFilter {
  _id: string
  name: string
  params: Record<string, string>
  createdAt: string
}

export interface DuplicateCheck {
  exists: boolean
  field?: 'mobile' | 'email'
  message?: string
  leadId?: string
  leadNo?: string
  owner?: string
  stage?: string
  visible?: boolean
}

export interface DispositionStage {
  _id: string
  name: string
  type: 'open' | 'converted' | 'lost'
  color?: string
  locked: boolean
  requiresFollowUp: boolean
  requiresReason: boolean
  subStages: { _id: string; name: string; counsellorAction?: string | null }[]
}

export interface CallLog {
  _id: string
  user?: Ref | null
  direction: 'outbound' | 'inbound'
  status: string
  startedAt?: string
  durationSeconds?: number | null
  stage?: string
  subStage?: string
  note?: string
  source: string
  createdAt: string
}

export interface FieldChangeEntry {
  _id: string
  section: string
  field: string
  label: string
  oldValue: string | null
  newValue: string | null
  changedBy: { _id: string | null; name: string }
  createdAt: string
}

export interface DiscussionFieldMeta {
  key: string
  no: number
  label: string
  type: 'choice' | 'text' | 'textarea' | 'number' | 'name_relation'
  options?: string[] | null
  max?: number | null
  min?: number | null
  integer: boolean
  showIf: { field: string; value: string } | null
  requiredIfShown: boolean
  sharedWithProfile: boolean
}

export interface DiscussionData {
  lead: string
  fields: DiscussionFieldMeta[]
  data: Record<string, unknown>
  completionPercent: number
  missing: string[]
  updatedAt: string | null
  changed?: string[]
}

export interface LeadDocumentFile {
  _id: string
  type: string
  typeLabel: string
  fileName: string
  contentType: string
  size: number
  isCurrent: boolean
  uploadedBy?: string | null
  uploadedAt: string
}

export interface DocumentSlot {
  type: string
  label: string
  mandatory: boolean
  accept: string[]
  maxMb: number
  current: LeadDocumentFile | null
  history: LeadDocumentFile[]
}

export interface MyDay {
  newUntouched: number
  followUpsToday: number
  overdue: number
  interestedNoActivity: number
  links: Record<string, Record<string, unknown>>
}

export interface MessageTemplate {
  _id: string
  name: string
  channel: 'sms' | 'email' | 'whatsapp'
  subject?: string
  body: string
  dltTemplateId?: string
  senderId?: string
  isActive: boolean
  placeholders: string[]
  createdAt: string
  updatedAt: string
}

export interface LeadMessage {
  _id: string
  channel: string
  template?: string
  to: string
  subject?: string
  body: string
  status: string
  error?: string
  trigger?: string
  sentBy?: string
  sentAt?: string
  deliveredAt?: string
  createdAt: string
}

export interface MessagePreview {
  channel: 'sms' | 'email'
  template: MessageTemplate
  to: string | null
  subject?: string | null
  body: string
  optedOut: boolean
  warning?: string
}

export interface AutomationRuleRow {
  _id: string
  trigger: string
  triggerLabel: string
  channel: string
  isActive: boolean
  template: Ref | null
  updatedBy: string | null
  updatedAt: string
}

export interface CampaignRow {
  _id: string
  name: string
  channel: string
  template?: string
  status: string
  scheduledAt?: string
  startedAt?: string
  finishedAt?: string
  counts: { selected?: number; final?: number; excluded?: { optedOut: number; invalid: number; duplicate: number } }
  createdBy?: string
  createdAt: string
  report: Record<'queued' | 'sent' | 'delivered' | 'failed' | 'bounced', number>
  failures?: { lead: string; name: string; to: string; reason: string }[]
}

export interface CampaignPreview {
  selected: number
  excluded: { optedOut: number; invalid: number; duplicate: number }
  final: number
  channel: string
  template: MessageTemplate
  sample: { to: string; subject?: string; body: string } | null
  campaign?: CampaignRow
}

export interface MetaFormMappingRow {
  _id: string
  formId: string
  formName?: string | null
  pageId?: string | null
  mapping: Record<string, string>
  isActive: boolean
  questions: string[]
  updatedAt: string
}

export interface MetaEventRow {
  _id: string
  leadgenId: string
  formId?: string
  status: string
  attempts: number
  nextAttemptAt?: string | null
  lastError?: string | null
  lead?: string | null
  createdAt: string
}

export interface ExportJob {
  _id: string
  status: string
  format: string
  rowCount: number
  expiresAt?: string | null
  downloadUrl?: string | null
}

export interface BulkAssignResult {
  total: number
  perCounsellor: { _id: string; name: string; count: number }[]
  assigned?: number
}

export interface DashboardSummary {
  totals: {
    total: number
    newToday: number
    newThisWeek: number
    unassigned: number
    converted: number
    lost: number
  }
  byStage: { _id: string; name: string; color?: string; count: number }[]
  bySource: { _id: string; name: string; channel?: string; count: number }[]
  byOwner: { _id: string; name: string; count: number }[]
  recentLeads: Lead[]
  myLeadsToday: number
}

/** Round-robin auto-assignment: Meta / Google / Website leads rotate over online counsellors. */
export type RoundRobinChannel = 'meta' | 'google' | 'capture'

export interface RoundRobinSettings {
  enabled: boolean
  channels: RoundRobinChannel[]
  /** "HH:MM" IST; both null = 24×7 */
  windowStart: string | null
  windowEnd: string | null
  /** 0=Mon … 6=Sun; [] = every day */
  days: number[]
}

export interface RoundRobinMember {
  _id: string
  name: string
  email: string
  team?: string | null
  /** admin toggle */
  receivesLeads: boolean
  /** has a live session now */
  online: boolean
  /** team opted out / inactive */
  teamPaused: boolean
  /** all conditions met → in rotation */
  eligible: boolean
  /** order in rotation; null when not eligible */
  position: number | null
}

export interface RoundRobinStatus {
  settings: RoundRobinSettings
  /** rotation allowed to hand out leads right now */
  activeNow: boolean
  rotation: RoundRobinMember[]
  nextUp: Ref | null
  lastAssigned: Ref | null
  /** leads waiting (nobody online / outside window) */
  unassignedPoolCount: number
}
