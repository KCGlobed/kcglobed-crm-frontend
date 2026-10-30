export type ModuleKey =
  | 'dashboard'
  | 'leads'
  | 'tasks'
  | 'round_robin'
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
  | 'attendance'
  | 'targets'

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
  /** Smartflo agent id (050…) / registered mobile the dialer rings for click-to-call; blank = the user's mobile */
  telephonyAgentId?: string | null
  telephonyAgentNumber?: string | null
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
    referrer?: string
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
  /** Lead Score weights (percent, total 100): profile completion vs counsellor discussion */
  scoreWeights?: { profile: number; discussion: number }
  optedOut?: { sms: boolean; email: boolean }
  isOverdue?: boolean
  ownerActive?: boolean | null
  /** calls logged on the lead (manual + dialer), for the list's "No. of Call Attempts" column */
  callsCount?: number
  profileValues?: Record<string, unknown>
  discussionValues?: Record<string, unknown>
}

export type TaskType =
  | 'call_back'
  | 'follow_up_call'
  | 'counselling_session'
  | 'expert_one_on_one'
  | 'document_collection'
  | 'parents_discussion'
  | 'in_person_meeting'
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
  reminderMinutes: 5 | 15 | 30 | 60 | 120
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

/** A browser/device registered for push notifications. */
export interface PushDevice {
  _id: string
  platform: 'web' | 'android' | 'ios'
  isActive: boolean
  lastSeenAt?: string
  createdAt: string
}

export interface PushStatus {
  /** console (recorded only) or fcm */
  provider: string
  /** notification types that are pushed to devices */
  types: string[]
  devices: PushDevice[]
  /** email copies of the alerts, sent to the user's own address at the same moment as the push */
  email?: {
    /** on for this user: the feature is enabled, the user is active and has an email address */
    enabled: boolean
    /** notification types that are also emailed */
    types: string[]
    address?: string | null
  }
}

export interface Notification {
  _id: string
  type: string
  title: string
  body?: string
  data?: {
    leadId?: string
    taskId?: string
    /** incoming_call / missed_call: the dialer call row */
    callId?: string
    exportId?: string
    /** whatsapp_template: Meta's verdict on this template */
    templateId?: string
    url?: string
    smart?: string
    errorFile?: string
    /** one alert for several leads (bulk assign / upload): how many, the first of them, who did it */
    bulk?: boolean
    count?: number
    leadIds?: string[]
    by?: string
  }
  readAt?: string | null
  createdAt: string
}

/** One row of the Activity Log's Notifications tab: an alert with its recipient and how its push went. */
export interface NotificationLogRow extends Notification {
  user: { _id: string; name: string; email?: string }
  push?: {
    attempts: number
    sent: number
    failed: number
    provider: string
    status: string
    error?: string
    lastAt: string
  } | null
}

export interface AuditLogEntry {
  _id: string
  actor?: (Ref & { email?: string }) | null
  actorName: string
  action: string
  module: string
  entityType?: string
  entityId?: string
  /** one readable line ("SMS · Registration → Asha Rao (GCCSCH-…, 9876543210) · delivered"); communications entries carry it */
  summary?: string
  before?: unknown
  after?: unknown
  ip?: string
  userAgent?: string
  createdAt: string
}

/** The lead a message went to, as the Activity Log keeps it (the entry outlives the lead). */
export interface AuditLeadRef {
  _id: string
  leadNo: string
  name: string
  mobile?: string
  email?: string
  /** the lead's counsellor at the time */
  owner?: string
}

export interface AuditTemplateRef {
  _id: string
  name: string
  channel: string
  dltTemplateId?: string
  senderId?: string
  dltType?: string
  waTemplateName?: string
  waLanguage?: string
  waCategory?: string
}

/** `after` of a message_send / message_sent / message_delivered / message_failed / message_received entry. */
export interface MessageAuditSnapshot {
  messageId: string
  channel: string
  channelLabel?: string
  direction?: 'in' | 'out'
  status: string
  error?: string
  to?: string
  subject?: string
  body?: string
  /** the {#var#} / {{n}} values as typed or picked for this send */
  variables?: string[]
  lead?: AuditLeadRef
  template?: AuditTemplateRef | null
  campaign?: { _id: string; name: string } | null
  trigger?: string
  sentBy?: string
  provider?: string
  providerMessageId?: string
  sentAt?: string
  deliveredAt?: string
  createdAt?: string
  /** on a delivery-report entry: what the provider reported */
  reportedStatus?: string
  reportedError?: string
}

/** `after` of a bulk_send / bulk_send_done / bulk_send_cancel entry. */
export interface CampaignAuditSnapshot {
  campaignId: string
  name: string
  channel: string
  channelLabel?: string
  template?: AuditTemplateRef | null
  status: string
  scheduledAt?: string
  startedAt?: string
  finishedAt?: string
  recipients?: number
  selected?: number
  excluded?: { optedOut: number; invalid: number; duplicate: number }
  variables?: string[]
  filters?: Record<string, unknown>
  createdBy?: string
  report?: CampaignRow['report']
  sent?: number
  failed?: number
}

export interface AuditMessageHistoryItem {
  _id: string
  action: string
  actorName: string
  createdAt: string
  status?: string
  error?: string
}

/** What an Activity Log entry points at today (GET /audit-logs/:id). */
export type AuditLogDetails =
  | {
      kind: 'message'
      message: LeadMessage & { lead?: AuditLeadRef; templateDetail?: AuditTemplateRef | null; campaign?: { _id: string; name: string } | null; readAt?: string }
      history: AuditMessageHistoryItem[]
    }
  | { kind: 'campaign'; campaign: CampaignRow }

export interface AuditLogDetail extends AuditLogEntry {
  details?: AuditLogDetails | null
}

/** One recipient of a bulk send with the live status (GET /messaging/campaigns/:id/recipients). */
export interface CampaignRecipient {
  _id: string
  lead: AuditLeadRef
  to?: string
  status: string
  error?: string
  subject?: string
  body: string
  provider?: string
  providerMessageId?: string
  sentAt?: string
  deliveredAt?: string
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
  /** free text when relationship is "Other" */
  relationshipOther?: string
  mobile: string
  email?: string
}

export interface ProfileSchooling {
  yearOfPassing: number
  gradeType: string
  score: number
  medium: string
  /** free text when medium is "Other" */
  mediumOther?: string
}

export interface ProfileAcademic {
  class10: ProfileSchooling
  class12: ProfileSchooling
  ug: {
    qualification: string
    /** free text when qualification is "Other" */
    qualificationOther?: string
    status: string
    institution: string
    gradeType?: string
    score?: number
    yearOfPassing: number
    medium: string
    mediumOther?: string
  }
  higherQualification: { has: boolean; qualification?: string; details?: string; institution?: string }
}

export interface ProfileExperience {
  organization: string
  designation: string
  functionalArea?: string
  /** YYYY-MM-DD; toDate empty means the current organisation */
  fromDate?: string
  toDate?: string
  /** legacy duration fields from older records */
  experienceYears?: number
  experienceMonths?: number
}

export interface ProfileWork {
  employmentStatus: string
  /** multiple organisations/roles; the flat fields below are the legacy single entry */
  experiences?: ProfileExperience[]
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
  /** duplicates imported as re-enquiries (duplicates mode: reenquire / reenquire_replace) */
  reEnquired?: number
  skipped: number
  failed: number
  fileName: string
  errorFile: string | null
  /** full report: every row with its result (lead number or reason) */
  resultFile?: string | null
  errors: { row: number; reason: string }[]
  perCounsellor: { _id: string; name: string; count: number }[]
  mappedColumns?: number
  skippedColumns?: number
  notesAdded?: number
}

/** Full-file dry run before the import: would-be counts + a downloadable row-wise report. */
export interface ImportValidation {
  total: number
  willCreate: number
  willUpdate: number
  willReEnquire?: number
  duplicates: number
  failed: number
  reportFile: string
  reasons: { row: number; reason: string }[]
}

export type ImportColumnStatus = 'mapped' | 'unmapped' | 'skipped'
/** CRM lists a lookup column's values must match */
export type ImportLookup = 'program' | 'cohort' | 'track' | 'source' | 'stage' | 'owner'

export interface ImportChoice {
  value: string
  label: string
  /** stage choices are grouped by stage (stage, then its dispositions) */
  group?: string
}

/** something an Excel column can be imported as: a standard lead field or a custom field (`custom.<key>`) */
export interface ImportField {
  key: string
  label: string
  required: boolean
  kind: 'standard' | 'custom'
  /** custom fields: the field type and, for dropdowns, its options */
  type?: CustomFieldDef['type']
  options?: string[]
  /** standard lookup fields: which CRM list the values must match, and its choices */
  lookup?: ImportLookup | null
  choices?: ImportChoice[]
  /** several columns may map to this field (notes) */
  multi?: boolean
  hint?: string
}

/** one column of the uploaded file with its mapping decision and a profile of its values */
export interface ImportColumn {
  header: string
  /** ImportField key it is mapped to */
  field: string | null
  status: ImportColumnStatus
  /** rows with a value */
  filled: number
  distinct: number
  /** distinct values (first 50) — dropdown options for a new custom field */
  values: string[]
  suggestedType: CustomFieldDef['type']
}

/** one distinct text of a lookup column and the CRM record it resolves to */
export interface ImportValue {
  value: string
  count: number
  /** ImportChoice value; null = leave the field empty */
  target: string | null
  how: 'explicit' | 'auto' | 'missing'
}

/** ImportField key → Excel column (a list for multi fields such as notes) */
export type ImportMapping = Record<string, string | string[]>

export interface ImportPreview {
  headers: string[]
  mapping: ImportMapping
  /** Excel columns explicitly left out */
  skipped: string[]
  columns: ImportColumn[]
  /** Excel columns that are neither mapped nor skipped */
  unmapped: string[]
  /** per mapped lookup field: every distinct text in the file with its resolution */
  values: Record<string, ImportValue[]>
  /** per mapped lookup field: how many distinct texts are unmatched */
  unresolved: Record<string, number>
  totalRows: number
  rows: { row: number; values: Record<string, string>; error: string | null; duplicateOf: string | null }[]
  fields: ImportField[]
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
  /** the picker offers an (optional) next follow-up for this stage */
  allowsFollowUp?: boolean
  /** false everywhere since the follow-up became optional (kept for older servers) */
  requiresFollowUp: boolean
  requiresReason: boolean
  subStages: { _id: string; name: string; counsellorAction?: string | null }[]
}

export interface CallLog {
  _id: string
  user?: Ref | null
  direction: 'outbound' | 'inbound'
  /** answered | not_answered | busy | failed; a dialer call is also initiated | ringing | in_progress while live */
  status: string
  startedAt?: string
  answeredAt?: string | null
  endedAt?: string | null
  durationSeconds?: number | null
  stage?: string
  subStage?: string
  note?: string
  /** manual (Log Call drawer) or dialer (Smartflo) */
  source: string
  /** dialer rows: the outcome popup is still due */
  needsDisposition?: boolean
  providerStatus?: string | null
  hangupCause?: string | null
  /** the provider's own recording link — only sent to admin-like users, as a fallback until the file is downloaded */
  recordingUrl?: string | null
  /** the dialer has a recording the CRM has not copied yet: the player copies it when pressed */
  recordingPending?: boolean
  /** false: the call just ended and its outcome and talk time are on their way from the dialer — show neither yet */
  settled?: boolean
  customerNumber?: string | null
  agentNumber?: string | null
  dialerRefId?: string | null
  dialerCallId?: string | null
  dialerMeta?: Record<string, unknown>
  /** proof of the call: the screenshot of the call time (required since call proofs), the recording (optional) */
  screenshot?: CallProofFile | null
  /** every screenshot, in upload order (`screenshot` is the first): one per call now; calls logged earlier may carry several */
  screenshots?: CallProofFile[]
  recording?: CallProofFile | null
  createdAt: string
}

/** The lead a dialer call belongs to, as the live-calls feed and the call log carry it (null = unknown caller). */
export interface LiveCallLead {
  _id: string
  name: string
  leadNo: string
  stage?: string | null
  owner?: Ref | null
}

/** A dialer call from GET /telephony/calls/live or /telephony/calls. */
export interface LiveCall extends CallLog {
  lead: LiveCallLead | null
}

export interface LiveCallsPayload {
  /** this user's calls still in progress (plus inbound calls ringing them) */
  active: LiveCall[]
  /** ended calls whose outcome has not been saved or skipped yet */
  pending: LiveCall[]
  serverTime: string
  pollSeconds: number
}

/** One webhook the admin adds in Smartflo (API Connect → Webhook), as the Calling tab lists it. */
export interface TelephonyTemplate {
  n: number
  callType: string
  trigger: string
  outboundType?: string | null
  event: string
  fields: { key: string; value: string }[]
}

export interface TelephonyRouting {
  inboundDidId?: string | null
  destination?: string | null
  departmentId?: string | null
}

/** GET /telephony/status: the basics for everyone; the configuration block for the Super Admin. */
export interface TelephonyStatus {
  provider: 'console' | 'smartflo' | string
  enabled: boolean
  pollSeconds: number
  myAgent?: { agentId?: string | null; agentNumber?: string | null } | null
  configured?: { auth: boolean; callerId: boolean; secret: boolean; roleId: boolean }
  callerId?: string | null
  inboundDid?: string | null
  webhookUrl?: string | null
  templates?: TelephonyTemplate[]
  auth?: { mode: 'token' | 'login' | 'none'; ok: boolean; error?: string | null; daysLeft?: number | null; tokenExpires?: string | null }
  agents?: { mapped: number; total: number }
  counters?: { eventsToday: number; unmatched: number; recordingErrors: number }
  routing?: TelephonyRouting | null
  /** the auto-dialer: this user has a Smartflo agent panel (the Dialer button) */
  myDialer?: { enabled: boolean }
}

/** A counsellor's own Smartflo dialer set-up (Calling tab → Auto-dialer, and the Dialer drawer). */
export interface DialerAgentDoc {
  userId: string
  name: string
  enabled: boolean
  loginId?: string | null
  password?: string | null
  hasPassword: boolean
  listId?: string | null
  listName?: string | null
  campaignId?: string | null
  campaignName?: string | null
  queueId?: string | null
  didId?: string | null
  didNumber?: string | null
  didRouted: boolean
  leads: Record<string, number>
  lastError?: string | null
  updatedAt?: string | null
}

export interface DialerConfig {
  syncEnabled: boolean
  /** a caller to the main number reaches the counsellor they last spoke to (Smartflo sticky agent, 10 days) */
  stickyAgent?: boolean
  /** a counsellor's Smartflo list holds only the leads they queued (Progressive call) — no one else is dialled */
  queuedOnly?: boolean
  stageIds: string[]
  retries: number
  retryAfterMinutes: number
  wrapUpSeconds: number
  ringTimeout: number
  /** progressive call: rounds of calling the unanswered again once every lead was called */
  redialRounds?: number
  traversal: '1' | '2' | '3'
  roleId?: string | null
  dispositionListId?: string | null
  breakListId?: string | null
}

export interface DialerOverview {
  config: DialerConfig
  agents: {
    userId: string
    name: string
    mobile?: string | null
    telephonyAgentId?: string | null
    /** the CRM still links them to a Smartflo user that was deleted in the portal — "Turn on" makes a new one */
    smartfloDeleted?: boolean
    dialer: DialerAgentDoc | null
  }[]
  totals: Record<string, number>
  lastRunAt?: string | null
  fullAt?: string | null
  stages: { _id: string; name: string }[]
  panelUrl: string
  errors: { leadId: string; error?: string | null; status: string }[]
}

export type DialerRingOn = 'laptop' | 'mobile' | 'both'

/** The counsellor's dialer session as the CRM last set / heard it (Smartflo's "Session Call Answered" → ready). */
export interface DialerSession {
  state?: 'calling_you' | 'ready' | 'on_break' | 'stopped' | 'logged_out'
  breakCode?: string | null
  breakName?: string | null
  startedAt?: string | null
  lastError?: string | null
  updatedAt?: string | null
}

export type MyDialer = Partial<DialerAgentDoc> & {
  enabled: boolean
  panelUrl: string
  session?: DialerSession
  breakCodes?: { id: string; name: string }[]
  ringOn?: DialerRingOn
}

/** GET /telephony/dialer/me/phone — the counsellor's own Smartflo softphone extension, registered by the CRM's phone. */
export interface SoftphoneLogin {
  user: string
  password: string
  host: string
  socket: string
  displayName: string
}

export interface DialerQueueResult {
  queued: number
  skipped: { _id: string; leadNo: string; reason: string }[]
  sent: { added?: number; removed?: number; failed?: number; rateLimited?: boolean }
  /** how many of them are the caller's own (their Dialer starts on them) */
  mine?: number
}

export type DialerProgressStatus =
  | 'adding'
  | 'waiting'
  | 'calling'
  | 'connected'
  /** ended; its outcome and talk time are on their way from the call record */
  | 'settling'
  | 'dialled'
  | 'answered'
  | 'not_answered'
  | 'busy'
  | 'failed'
  | 'error'
  | 'skipped'

/** GET /telephony/dialer/me/progress — the counsellor's last "Auto-dial first", lead by lead. */
export interface DialerProgress {
  run: {
    at: string
    total: number
    counts: Partial<Record<DialerProgressStatus, number>>
    done: boolean
    leads: {
      _id: string
      name: string
      leadNo: string
      status: DialerProgressStatus
      label: string
      durationSeconds?: number | null
      attempts?: number | null
      callId?: string | null
      error?: string | null
      /** 2 and up: called again because the earlier round went unanswered */
      round?: number
      /** on the call now: when they picked up (the live timer runs from it) */
      answeredAt?: string | null
      /** its outcome was saved: the next call need not wait out the gap */
      disposed?: boolean
      outcome?: string | null
      /** an outcome other than Not Connected, or a follow-up set: not called again in this run */
      final?: boolean
    }[]
    round?: number
    rounds?: number
    /** the wrap-up time between calls (admin setting) */
    wrapUpSeconds?: number
    /** the lead the CRM calls next (the first not called yet in this round) */
    next?: string | null
    /** false: queued for this counsellor by someone else — it starts on their Start */
    auto?: boolean
    /** Smartflo's dialer state for the counsellor: wrap-up holds the next call */
    agent?: { onDisposition: boolean; onCall: boolean; lineUp: boolean; status?: string | null; wrapUpEndsAt?: string | null } | null
  } | null
}

export interface TelephonyEventRow {
  _id: string
  event: string
  direction?: string | null
  refId?: string | null
  callId?: string | null
  uuid?: string | null
  status: string
  attempts: number
  lastError?: string | null
  createdAt: string
  processedAt?: string | null
  call?: { _id: string; lead?: { _id: string; name: string; leadNo: string } | null } | null
  payload: Record<string, unknown>
}

export interface TelephonyAgentRow {
  _id: string
  name: string
  email?: string
  mobile?: string | null
  telephonyAgentId?: string | null
  telephonyAgentNumber?: string | null
  smartflo?: { agentId: string; status: number; statusLabel: string; followMeNumber?: string | null } | null
}

export interface TelephonyNumberRow {
  id: string
  did: string
  name?: string | null
  destination?: string | null
  destinationName?: string | null
  isCallerId: boolean
  isInbound: boolean
}

/** A call screenshot or recording (POST /calls/proofs, then sent with the call; GET /calls/:id/proofs/:proofId). */
export interface CallProofFile {
  _id: string
  kind: 'screenshot' | 'recording'
  fileName: string
  contentType: string
  size: number
}

/** Attendance → Call Proofs: one logged call with its proofs. */
export interface AttendanceCallRow {
  _id: string
  createdAt: string
  /** null for a dialer call that no CRM user answered */
  user: { _id: string; name: string } | null
  /** null for an inbound dialer call from a number no lead has */
  lead: { _id: string; name: string; leadNo: string } | null
  durationSeconds?: number | null
  status: string
  direction?: 'outbound' | 'inbound'
  /** manual (Log Call drawer) or dialer */
  source?: string
  customerNumber?: string | null
  stage?: string | null
  subStage?: string | null
  screenshot: CallProofFile | null
  /** every screenshot, in upload order (`screenshot` is the first) */
  screenshots?: CallProofFile[]
  recording: CallProofFile | null
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
  /** deleted from the profile: kept in the history, the file is still there */
  deletedAt?: string | null
  deletedBy?: string | null
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
  /** SMS only: the DLT template type. Explicit (promotional category) goes on the gateway's promotional channel, 10 am – 9 pm */
  dltType?: 'implicit' | 'explicit'
  /** WhatsApp only: the template as approved in WhatsApp Manager (name + language), its review status and category */
  waTemplateName?: string
  waLanguage?: string
  waCategory?: string
  /** Meta's review status (PENDING, APPROVED, REJECTED, PAUSED …) or DRAFT: built in the CRM, not submitted yet */
  waStatus?: string
  /** WhatsApp builder (Communication → Templates → WhatsApp): Meta's id once submitted, the content, Meta's verdict */
  waTemplateId?: string
  waSpec?: WhatsAppTemplateSpec
  waRejectedReason?: string
  /** Meta's quality rating: GREEN, YELLOW, RED or UNKNOWN */
  waQuality?: string
  waSubmittedAt?: string
  /** crm = built in the builder; meta = pulled from WhatsApp Manager by the sync */
  waSource?: 'crm' | 'meta'
  /** the header's sample image / PDF, also the header of every message sent */
  waHeaderAsset?: MessageAsset
  /** the answer to a save: the changes went to Meta for review again */
  resubmitted?: boolean
  isActive: boolean
  placeholders: string[]
  /** SMS / WhatsApp: how many values are typed or picked when sending ({#var#} markers or {{n}} parameters) */
  variableCount?: number
  /** email: the files attached to every send of this template */
  attachments?: MessageAsset[]
  createdAt: string
  updatedAt: string
}

export type WhatsAppHeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'LOCATION'
/** The builder's buttons; a template synced from WhatsApp Manager can carry other types (FLOW, COPY_CODE …) */
export type WhatsAppButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'

export interface WhatsAppTemplateButton {
  type: WhatsAppButtonType
  text: string
  url?: string
  phone?: string
}

/** A WhatsApp template's content as the builder edits it (the backend's wa_templates.py checks it against Meta's rules). */
export interface WhatsAppTemplateSpec {
  /** IMAGE / DOCUMENT: `assetId` is the uploaded sample (a message asset) */
  header: { format: WhatsAppHeaderFormat; text?: string; assetId?: string }
  body: string
  /** one sample value per {{n}}: Meta reviews the template with them */
  examples: string[]
  footer?: string | null
  buttons: WhatsAppTemplateButton[]
  /** Authentication only: Meta's fixed passcode format */
  auth?: { securityRecommendation: boolean; codeExpirationMinutes?: number | null; copyCodeText: string }
}

/** An image uploaded for emailers (Communication → email designer); `url` is public, for mail clients. */
export interface MessageAsset {
  _id: string
  name: string
  url: string
  contentType: string
  size: number
  /** image = placed in the email; file = an attachment */
  kind?: 'image' | 'file'
  uploadedBy?: string
  createdAt: string
}

/** A saved value a template variable can be filled with (Communication → Texts: a short link, a date, a venue); sent as typed. */
export interface SavedText {
  _id: string
  name: string
  text: string
  isActive: boolean
  createdBy?: string
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
  /** console-sms / console-email only log the message, so their sent/delivered status is a stand-in */
  provider?: string
  /** the gateway's id for the message (e.g. Webinfosys MessageId), for delivery reports */
  providerMessageId?: string
  trigger?: string
  sentBy?: string
  sentAt?: string
  deliveredAt?: string
  createdAt: string
  /** out = sent by the CRM (default); in = a WhatsApp reply from the lead */
  direction?: 'in' | 'out'
  /** a single send scheduled for later (status scheduled until then; kept after it goes out) */
  scheduledAt?: string
  /** the {#var#} / {{n}} values it is rendered with */
  variables?: string[]
  /** email: the files that went with it (public url, for the history pane) */
  attachments?: MessageAsset[]
}

/** One row of the Activity Log's Scheduled tab: a bulk send or a single message waiting for its time. */
export interface ScheduledSend {
  kind: 'bulk' | 'single'
  _id: string
  channel: string
  template?: string
  scheduledAt: string
  status: string
  scheduledBy?: string
  scheduledById?: string
  createdAt: string
  variables?: string[]
  /** bulk */
  name?: string
  recipients?: number
  excluded?: { optedOut: number; invalid: number; duplicate: number }
  startedAt?: string
  /** single */
  lead?: AuditLeadRef
  to?: string
  subject?: string
  body?: string
  error?: string
}

/** One bubble of the lead's WhatsApp thread. */
export interface WhatsAppChatMessage {
  _id: string
  direction: 'in' | 'out'
  body: string
  /** out: queued | sent | delivered | failed · in: received */
  status: string
  error?: string
  template?: string
  /** out: the user (or "Automation"); in: the lead's WhatsApp profile name */
  sentBy?: string
  sentAt: string
  deliveredAt?: string
  createdAt: string
  providerMessageId?: string
}

export interface WhatsAppChat {
  to: string | null
  optedOut: boolean
  /** until when Meta accepts a typed reply (24 h after the lead's last message); null = templates only */
  windowOpenUntil?: string | null
  canSendText: boolean
  /** replies that were unread before this fetch (they are marked read by it) */
  unread: number
  messages: WhatsAppChatMessage[]
}

/** A lead's WhatsApp chat on the leads list (the WhatsApp quick filter): unread replies and the last message. */
export interface MessagePreview {
  channel: 'sms' | 'email'
  template: MessageTemplate
  to: string | null
  subject?: string | null
  /** lead placeholders filled; {#var#} markers stay until their values are sent along */
  body: string
  variableCount?: number
  /** SMS: what a lead-field variable ("{first_name}") carries for this lead, for the live preview */
  leadValues?: Record<string, string | null> | null
  optedOut: boolean
  warning?: string
}

export type AutomationTriggerType = 'event' | 'schedule'
export type AutomationRecurrence = 'once' | 'daily' | 'weekly' | 'monthly'

/**
 * Communication → Automation: one rule that sends a template on a channel when a lead event happens
 * (optionally after a wait) or on a schedule, to the leads matching its conditions (the lead list's filters).
 */
export interface AutomationRow {
  _id: string
  name: string
  channel: 'sms' | 'email' | 'whatsapp'
  channelLabel: string
  triggerType: AutomationTriggerType
  event: string | null
  eventLabel: string | null
  delayMinutes: number
  recurrence: AutomationRecurrence | null
  runAt: string | null
  /** weekly: Monday = 0 */
  weekdays: number[]
  endAt: string | null
  conditions: FilterCondition[]
  /** SMS / WhatsApp: the {#var#} / {{n}} values it sends with (typed text or "{lead_field}") */
  variables: string[]
  isActive: boolean
  /** one line: when it sends ("Every day at 10:30", "Lead assigned · after 30 min") */
  schedule: string
  template: { _id: string; name: string; isActive: boolean; variableCount: number } | null
  nextRunAt: string | null
  lastRunAt: string | null
  runCount: number
  sentCount: number
  /** schedule: the latest run (a bulk send filed under the automation) */
  lastRun: { _id: string; status: string; scheduledAt: string; final: number; sent: number; failed: number } | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

/** What the automation form sends; a PUT with only `isActive` is the on / off switch. */
export interface AutomationBody {
  name?: string
  channel?: 'sms' | 'email' | 'whatsapp'
  template?: string
  variables?: string[]
  triggerType?: AutomationTriggerType
  event?: string | null
  delayMinutes?: number
  recurrence?: AutomationRecurrence | null
  runAt?: string | null
  weekdays?: number[]
  endAt?: string | null
  conditions?: FilterCondition[]
  isActive?: boolean
}

/** The four counsellor alerts the editor special-cases; any other string is a rule key the server lists (?scope=all). */
export type StaffAlertTrigger = 'follow_up_reminder' | 'lead_untouched' | 'lead_assigned' | 'whatsapp_reply' | (string & {})
export type StaffAlertKind = 'builtin' | 'custom' | 'account'
/** What the Notifications tab may do with a row; a field false hides its control. */
export interface StaffAlertCapabilities {
  toggle: boolean
  push: boolean
  email: boolean
  sms: boolean
  /** there is a person it is about (the counsellor, the assignee …) who may be told */
  owner: boolean
  recipients: boolean
  conditions: boolean
  delete: boolean
  test: boolean
}

/**
 * An alert rule (Communication → Notifications; the four counsellor alerts also under Automation → Team alerts):
 * its wording, channels, recipients and — for the untouched-lead alert — windows. The texts use {{Placeholders}}.
 */
export interface StaffAlertRow {
  _id: string
  /** a built-in rule's key; null for an alert added in the CRM (Team alerts → Add alert) */
  trigger: StaffAlertTrigger | null
  label: string
  /** ?scope=all only: what kind of row, where it sits, when it fires, what may be changed */
  kind?: StaffAlertKind
  group?: string
  groupLabel?: string
  description?: string
  capabilities?: StaffAlertCapabilities
  /** always shown in the bell (false for an account email) */
  bell?: boolean
  /** who "notifyOwner" means: "Counsellor", "Previous counsellor", "The person who exported" … */
  subjectLabel?: string
  /** added in the CRM: its name, the lead event it goes out on (straight away) and the lead conditions it needs */
  custom?: boolean
  name?: string | null
  event?: string | null
  eventLabel?: string | null
  conditions?: FilterCondition[]
  /** the notification type it is filed under in the bell / Activity Log */
  notificationType: string
  isActive: boolean
  /** lead_untouched: the main window after assignment, in working minutes */
  offsetMinutes: number
  /** lead_untouched: the earlier nudge, in working minutes; null = off */
  earlyOffsetMinutes: number | null
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  emailSubject: string
  emailBody: string
  smsBody: string
  smsSenderId: string | null
  smsDltTemplateId: string | null
  smsDltType: 'implicit' | 'explicit'
  /** the in-app (bell) and push title / message */
  pushTitle: string
  pushBody: string
  /** the email's button text */
  ctaLabel: string
  /** one line: when it goes out */
  when: string
  /** who gets it: the lead's counsellor (the follow-up's assignee), everyone in these roles, these users — the last
   * two only about leads they can open */
  notifyOwner: boolean
  recipientRoles: string[]
  recipientUsers: string[]
  /** one line: "Counsellor + Support + 2 people" */
  recipientsText: string
  updatedBy: string | null
  updatedAt: string
  createdAt: string
}

/** What the alert form sends; a PUT with only `isActive` is the on / off switch. */
export interface StaffAlertBody {
  isActive?: boolean
  offsetMinutes?: number
  earlyOffsetMinutes?: number | null
  emailEnabled?: boolean
  smsEnabled?: boolean
  pushEnabled?: boolean
  emailSubject?: string
  emailBody?: string
  smsBody?: string
  smsSenderId?: string | null
  smsDltTemplateId?: string | null
  smsDltType?: 'implicit' | 'explicit'
  pushTitle?: string
  pushBody?: string
  ctaLabel?: string
  notifyOwner?: boolean
  recipientRoles?: string[]
  recipientUsers?: string[]
  /** an added alert only */
  name?: string
  event?: string
  conditions?: FilterCondition[]
}

export interface StaffAlertPlaceholder {
  key: string
  label: string
  sample: string
}

export interface StaffAlertsResponse {
  items: StaffAlertRow[]
  /** per built-in trigger, and "custom" for an added alert */
  placeholders: Record<string, StaffAlertPlaceholder[]>
  workingHours: { start: string; end: string; days: number[] }
  /** "webinfosys" needs a DLT sender id + template id before SMS can be switched on; "console" only logs */
  smsProvider: string
  dltTypes: string[]
  reminderOptions: number[]
  offsetRange: [number, number]
  /** who an alert can go to: role keys (role templates + Super Admin / Admin / Counsellor) and active users */
  recipientRoles: { value: string; label: string }[]
  recipientUsers: { value: string; label: string; role: string }[]
  /** Add alert: the lead events it can go out on, and the ready-made wording */
  events?: { value: string; label: string }[]
  customDefaults?: StaffAlertBody
  /** the Notifications tab's sections, in order */
  groups?: { key: string; label: string }[]
}

/** The test send's outcome per channel (only the channels that are on). */
export interface StaffAlertTestResult {
  push?: number
  email?: string
  sms?: { status: string; provider?: string; providerMessageId?: string; error?: string }
  warning?: string
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
  report: Record<'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'cancelled', number>
  /** 'sending' with nothing going out for 10 min: its run died with a server restart — Resume or Stop it. */
  stalled?: boolean
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

/** A bulk upload running in the background (options.background): polled until done (with the result) or failed. */
export interface ImportJob {
  _id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  fileName: string
  error?: string | null
  result?: ImportResult | null
  createdAt: string
  startedAt?: string | null
  finishedAt?: string | null
}

export interface BulkAssignResult {
  total: number
  perCounsellor: { _id: string; name: string; count: number }[]
  assigned?: number
}

/**
 * Total / assigned / unassigned leads for one period. `from`/`to` are the local
 * YYYY-MM-DD bounds (inclusive) the backend used; absent for the all-time figures.
 */
export interface DashboardPeriod {
  from?: string
  to?: string
  total: number
  assigned: number
  unassigned: number
}

/** One "Lead Status" tile: the count of leads on the named stage. */
export interface DashboardStatusTile {
  key: 'interested' | 'notInterested' | 'enrolled'
  name: string
  /** missing when the stage no longer exists in Masters */
  stageId?: string
  count: number
}

/** A row of the dashboard's Recent leads card; opens the lead's page. */
export interface DashboardRecentLead {
  _id: string
  leadNo: string
  firstName: string
  lastName?: string
  mobile?: string
  stage?: { _id: string; name: string; color?: string } | null
  owner?: Ref | null
  source?: Ref | null
  createdAt: string
}

/** The call cards' figures (telephony call_activity): connected = the lead / caller picked up. */
export interface CallActivity {
  dialCalls: number
  dialConnected: number
  dialNotConnected: number
  inbound: number
  inboundAnswered: number
  inboundMissed: number
  calls: number
  connected: number
  connectRate: number
  talktimeSeconds: number
  avgTalkSeconds: number
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
  overall: DashboardPeriod
  thisWeek: DashboardPeriod
  today: DashboardPeriod
  leadStatus: DashboardStatusTile[]
  /** in stage order; `_id` is missing on the "No stage" row */
  byStage: { _id?: string; name: string; color?: string; count: number }[]
  /** every active source, highest first; `_id` is missing on the "No source" row */
  bySource: { _id?: string; name: string; channel?: string; count: number }[]
  byOwner: { _id: string; name: string; count: number }[]
  /** the eight newest leads in scope */
  recentLeads: DashboardRecentLead[]
  /** admins: the calls of everyone they can see, today (the same figures as the Calls page each card opens) */
  teamCallsToday?: CallActivity
  /** the signed-in employee's day: calls they logged, the sum of those calls' durations, and their breaks (a running
   * one up to now) (absent for Super Admin) */
  activityToday?: {
    calls?: number
    talktimeSeconds?: number
    breakSeconds?: number
    /** the part of breakSeconds that was Pause Break (campus visit, training, calibration) */
    pauseSeconds?: number
    /** dialer figures (apps.telephony): connected calls, connect rate %, inbound / outbound counts, average talk time */
    connected?: number
    connectRate?: number
    inbound?: number
    outbound?: number
    inboundAnswered?: number
    inboundMissed?: number
    avgTalkSeconds?: number
    /** the counsellor's Today's Activity: outbound calls (logged or dialer) and how they ended */
    dialCalls?: number
    dialConnected?: number
    dialNotConnected?: number
    /** signed-in time today */
    loggedInSeconds?: number
    /** Active Time: signed-in time off breaks (a running one up to now), pauses and calls */
    activeSeconds?: number
    /** different numbers dialled today, of them reached (a call connected), and dialled more than once */
    uniqueNumbers?: number
    numbersReached?: number
    multipleAttempts?: number
  }
}

/**
 * Round-robin auto-assignment: Meta / Google / Website leads go to the logged-in pool members
 * in a fixed sequence — any active user with "In round-robin lead pool" ticked and View on the
 * Leads module, whatever their role, except a Super Admin. Overnight leads pool and go out in the
 * morning as equal quotas; what is left is split at the checkpoint.
 */
export type RoundRobinChannel = 'meta' | 'google' | 'capture' | 'telephony' | 'chatbot'

export interface RoundRobinSettings {
  enabled: boolean
  channels: RoundRobinChannel[]
  /** "HH:MM" IST, end exclusive; both null = 24×7 */
  windowStart: string | null
  windowEnd: string | null
  /** 0=Mon … 6=Sun; [] = every day */
  days: number[]
  /** "HH:MM" IST: from the window start until then the overnight backlog goes out as quotas, the rest is split at it; null = no morning */
  checkpoint: string | null
}

/** closed: outside the window / days (leads pool) · morning: before the checkpoint · live: in sequence */
export type RoundRobinPhase = 'closed' | 'morning' | 'live'

/** Today's morning backlog */
export interface RoundRobinMorning {
  day: string
  /** pooled leads that arrived before the window opened */
  backlog: number
  /** members with the toggle on that it was divided by */
  members: number
  /** leads per member */
  quota: number
  /** quota leads handed out so far */
  given: number
  /** the checkpoint split ran */
  closedAt: string | null
  /** leads the checkpoint split handed out */
  split: number
}

/**
 * One row of the Round Robin screen: every active non-super-admin user with the pool flag on
 * (any role), plus counsellors who opted out so they can be switched back on.
 */
export interface RoundRobinMember {
  _id: string
  name: string
  email: string
  team?: string | null
  /** "Admin", "Admission Counsellor", "Custom access" … */
  roleLabel?: string
  /** admin toggle ("In round-robin lead pool") */
  receivesLeads: boolean
  /** has a live session now */
  online: boolean
  /** View on the Leads module (role template for Admin / Counsellor, own permissions for custom access) */
  hasLeadsAccess: boolean
  /** team opted out / inactive */
  teamPaused: boolean
  /** punched out on a break right now: skipped by the rotation until the break ends */
  onBreak?: { type: string; label: string; startedAt: string } | null
  /** active + flag + not super admin + leads access + online + team not paused + not on a break → in rotation */
  eligible: boolean
  /** order among the eligible right now; null when not eligible */
  position: number | null
  /** place in the fixed sequence (1 = first), set by the team's manager (HOD) or the Super Admin */
  sequence: number | null
  /** the caller may flip this member's toggle and move them in the sequence */
  canManage: boolean
  /** leads the rotation gave them today, and when it last did */
  assignedToday: number
  lastAssignedAt: string | null
  /** of those, from today's morning quota */
  morningLeads: number
}

export interface RoundRobinStatus {
  settings: RoundRobinSettings
  /** a new lead goes straight to the next member right now (the live phase) */
  activeNow: boolean
  phase: RoundRobinPhase
  morning: RoundRobinMorning | null
  rotation: RoundRobinMember[]
  /** the caller manages at least one listed member */
  canReorder: boolean
  /** leads the rotation handed out today */
  assignedToday: number
  nextUp: Ref | null
  lastAssigned: Ref | null
  /** leads waiting (nobody online / outside window) */
  unassignedPoolCount: number
}

/* ------------------------------------------------------------------ Punch Break & Attendance */

export type BreakType = 'tea' | 'lunch' | 'bio' | 'pause' | 'other'
/** active: running · completed: ended by the employee · incomplete: still open when its day ended, left out of every total */
export type BreakStatus = 'active' | 'completed' | 'incomplete'

export interface BreakEntry {
  _id: string
  type: BreakType
  /** "Lunch Break" */
  label: string
  /** the reason given for a pause (Campus Visit, Training Session or typed) or an "other" break */
  note?: string
  /** IST date the break started on (YYYY-MM-DD) */
  day: string
  startedAt: string
  endedAt?: string
  durationSeconds?: number
  status: BreakStatus
  endedBy?: 'user' | 'system'
  /** running breaks only: seconds since the start, when the server answered */
  elapsedSeconds?: number
  /** the break log only */
  user?: { _id: string; name: string }
}

export interface BreaksToday {
  day: string
  active: BreakEntry | null
  /** today's breaks, newest first */
  breaks: BreakEntry[]
  /** completed seconds per type */
  byType: Record<BreakType, number>
  /** completed breaks only, the pause left out */
  totalSeconds: number
  /** completed pause time (campus visit, training, call calibration): shown apart, never part of totalSeconds */
  pauseSeconds: number
}

/** The top bar for the signed-in employee: today's logged-in time plus the Punch Break state. */
export interface AttendanceToday extends BreaksToday {
  firstLoginAt: string | null
  /** signed-in time today as of the response, minus time on a pause; keeps running while `live` and not pausing */
  loggedInSeconds: number
  live: boolean
}

/** One employee on one IST day of the Attendance report. */
export interface AttendanceRow {
  date: string
  user: { _id: string; name: string; roleLabel: string }
  /** online: signed in right now (today) · absent: a working day without a sign-in */
  status: 'present' | 'absent' | 'online'
  /** first sign-in of the day */
  loginAt?: string
  /** sign-out of the day's last session */
  logoutAt?: string
  /** signed-in time that day: the sessions added up (overlaps counted once) minus time on a pause, the same
   * figure as the employee's logged-in timer; running while online; counted up to the last activity when the
   * logout is missing. null when there was no sign-in */
  loginSeconds: number | null
  /** the day's last session never signed out: flagged, never guessed */
  logoutMissing: boolean
  /** when logoutMissing: the last time that session was used */
  lastSeenAt?: string
  sessions: number
  calls: number
  talktimeSeconds: number
  breaks: Record<BreakType, number>
  /** every type but the pause */
  breakSeconds: number
  /** the pause on its own: neither break time nor part of loginSeconds */
  pauseSeconds: number
  activeBreak: { type: BreakType; label: string; note?: string; startedAt: string } | null
  incompleteBreaks: number
}

// ---------- Target Manager ----------

export type TargetStatus = 'active' | 'completed' | 'cancelled' | 'expired'

/** A lead owner's goal: `targetCount` leads entering `stage` between startAt and endAt. */
export interface Target {
  _id: string
  assignee: { _id: string; name: string }
  stage: { _id: string; name: string }
  targetCount: number
  /** leads that entered the stage in the range while owned by the assignee (live while active, frozen once closed) */
  achieved: number
  /** achieved ÷ targetCount × 100, can exceed 100 */
  percent: number
  description?: string | null
  startAt: string
  endAt: string
  status: TargetStatus
  closedAt?: string | null
  assignedBy?: { _id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface TargetOptions {
  stages: { _id: string; name: string }[]
  /** assignee id → their active target id: they cannot get another until it closes */
  busyAssignees: Record<string, string>
}

// ---------- Reports ----------

export type ReportColumnType = 'text' | 'number' | 'duration' | 'percent'
export type ReportPeriodKey = 'today' | 'yesterday' | 'last_7_days' | 'last_week' | 'this_month' | 'last_month'

export interface ReportColumn {
  key: string
  label: string
  type: ReportColumnType
  /** a duration shown in minutes in the Excel file (on screen every duration is HH:MM:SS) */
  short: boolean
  align: 'left' | 'center' | 'right'
}

/** A report in the registry: its columns (typed, formatted the same on screen, in Excel and CSV) and periods. */
export interface ReportDefinition {
  key: string
  name: string
  category: string
  description: string
  /** a one-day report (the EOD): one date, scheduled for today or yesterday */
  oneDay: boolean
  /** a leading "Sr. No." column */
  numbered: boolean
  defaultPeriod: ReportPeriodKey
  periods: { value: ReportPeriodKey; label: string }[]
  columns: ReportColumn[]
  notes: string[]
}

export type ReportRow = Record<string, string | number | null>

export interface ReportSummaryItem {
  label: string
  value: number
  type: ReportColumnType
}

/** Durations in seconds, percents as 0–100, counts as numbers. */
export interface ReportResult {
  report: ReportDefinition
  dateFrom: string
  dateTo: string
  periodLabel: string
  rows: ReportRow[]
  totals: ReportRow | null
  summary: ReportSummaryItem[]
}

export type ReportFrequency = 'daily' | 'weekly' | 'monthly'
export type ReportRunStatus = 'running' | 'sent' | 'retry' | 'failed'
export type ReportRunTrigger = 'schedule' | 'manual' | 'resend'

/** "Email report X for period P to these people every day / week / month at HH:MM (IST)". */
export interface ReportSchedule {
  _id: string
  name: string
  reportKey: string
  reportName: string
  period: ReportPeriodKey
  periodLabel: string
  params: Record<string, unknown>
  frequency: ReportFrequency
  /** HH:MM, IST */
  sendTime: string
  /** daily: the days it goes out; weekly: [the day] — 0 = Monday */
  weekdays: number[]
  monthDay: number | null
  recipients: string[]
  cc: string[]
  isActive: boolean
  owner: { _id: string; name?: string; email?: string } | null
  nextRunAt: string | null
  lastRunAt: string | null
  lastStatus: ReportRunStatus | null
  createdAt: string
  updatedAt: string
}

/** One generation + email of a report: what went out, to whom, the file, and why it failed. */
export interface ReportRun {
  _id: string
  schedule: string | null
  reportKey: string
  name: string
  trigger: ReportRunTrigger
  scheduledFor: string | null
  params: Record<string, unknown>
  periodLabel: string
  recipients: string[]
  cc: string[]
  status: ReportRunStatus
  attempts: number
  nextAttemptAt: string | null
  error: string | null
  rowCount: number
  summary: ReportSummaryItem[]
  hasFile: boolean
  fileName: string | null
  triggeredBy: { _id: string; name?: string } | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}
