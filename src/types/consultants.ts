/** Channel Partners (backend apps.consultants, /api/v1/consultants): consultant leads, apart from the student leads. */

export type CpStageType = 'open' | 'won' | 'closed'
export type CpFollowUpView = 'today' | 'overdue' | 'upcoming' | 'completed'

export interface CpPerson {
  _id: string
  name: string
}

export interface CpSubStage {
  _id: string
  name: string
  isActive: boolean
  requiresRemark: boolean
  /** a document type key (CpMeta / documents types) that must be on the lead first */
  requiredDocument: string | null
  /** only users with Approve on Channel Partners › Leads may record it */
  needsApproval: boolean
  /** Is a student, not a consultant — the move to student Leads comes in phase 2 */
  movesToStudent: boolean
  /** Lead Stages list only: recorded on some lead (can be deactivated, not deleted) */
  used?: boolean
}

export interface CpStage {
  _id: string
  name: string
  type: CpStageType
  color: string | null
  order: number
  isActive: boolean
  /** a call logged here did not connect (Not Connected); enough in a row → Dropped */
  countsAsAttempt: boolean
  /** the stage opens only once this sub-stage was recorded (Documentation ← Countersigned by GCC School) */
  entrySubStage: string | null
  subStages: CpSubStage[]
  /** Lead Stages list only */
  leadCount?: number
  used?: boolean
}

export interface CpStageRef {
  _id: string
  name: string
  type: CpStageType
  color: string | null
}

export interface CpSource {
  _id: string
  name: string
  isActive: boolean
}

export interface CpSettings {
  maxAttempts: number
  /** the sub-stage a lead goes to when the attempts run out */
  dropSubStage: string | null
}

export interface CpMeta {
  /** active stages with their active sub-stages, in order */
  stages: CpStage[]
  sources: CpSource[]
  /** the partnership team in the caller's scope: who leads can be assigned to */
  owners: CpPerson[]
  businessTypes: string[]
  followUpTypes: { value: string; label: string }[]
  settings: CpSettings
  canApprove: boolean
}

export interface CpLead {
  _id: string
  leadNo: string
  name: string
  firmName: string | null
  mobile: string
  altMobile: string | null
  email: string | null
  city: string | null
  state: string | null
  businessType: string | null
  teamSize: number | null
  studentsPerYear: number | null
  website: string | null
  source: CpSource | null
  stage: CpStageRef
  subStage: { _id: string; name: string } | null
  stageChangedAt: string | null
  status: CpStageType
  /** Onboarded: no more stage changes */
  locked: boolean
  nextFollowUpAt: string | null
  /** calls in a row that did not connect */
  attempts: number
  owner: CpPerson | null
  assignedAt: string | null
  lastActivityAt: string | null
  createdVia: 'manual' | 'import'
  createdBy: CpPerson | null
  createdAt: string
  updatedAt: string
}

export interface CpCall {
  _id: string
  connected: boolean
  remark: string | null
  calledAt: string
  calledBy: CpPerson | null
  stage: string | null
  subStage: string | null
}

export interface CpLeadDetail extends CpLead {
  recentCalls: CpCall[]
  callCount: number
  /** the same mobile / email is on a student lead: flagged, never merged */
  studentDuplicate: { leadNo: string } | null
}

export interface CpLeadListParams {
  page?: number
  page_size?: number
  search?: string
  stage?: string
  subStage?: string
  source?: string
  status?: string
  /** 'me' | 'unassigned' | user id */
  owner?: string
  followUp?: 'overdue' | 'today' | 'none'
  createdFrom?: string
  createdTo?: string
  sort_by?: 'createdAt' | 'nextFollowUpAt' | 'lastActivityAt' | 'name' | 'leadNo'
  sort_order?: 'asc' | 'desc'
}

export interface CpStageCounts {
  byStage: Record<string, number>
  total: number
}

export interface CpDuplicateCheck {
  consultant: { _id: string; leadNo: string; name: string; stage: string; owner?: string } | null
  student: { leadNo: string } | null
}

export interface CpLogBody {
  /** false: a stage update without a call (default true) */
  call?: boolean
  stage: string
  subStage?: string | null
  remark?: string
  /** ISO; required for an Open stage, in the future */
  nextFollowUpAt?: string | null
  followUpType?: string
  followUpNotes?: string
}

export interface CpFollowUp {
  _id: string
  type: string
  typeLabel: string
  dueAt: string
  status: 'open' | 'done' | 'cancelled'
  isOverdue: boolean
  notes: string | null
  outcome: string | null
  assignee: CpPerson
  completedAt: string | null
  completedBy: CpPerson | null
  createdBy: CpPerson | null
  createdAt: string
  lead: { _id: string; leadNo: string; name: string; firmName: string | null; mobile: string; stage: CpStageRef; subStage: string | null }
}

export type CpFollowUpSummary = Record<CpFollowUpView, number>

export interface CpNote {
  _id: string
  body: string
  createdBy: CpPerson | null
  createdAt: string
}

export interface CpDocument {
  _id: string
  type: string
  typeLabel: string
  fileName: string
  contentType: string
  size: number
  uploadedBy?: string
  uploadedAt: string
  deletedAt?: string
  deletedBy?: string
}

export interface CpDocuments {
  documents: CpDocument[]
  types: { type: string; label: string }[]
  accept: string[]
  maxMb: number
}

export interface CpActivity {
  _id: string
  type: string
  title: string
  description: string | null
  data: Record<string, unknown> | null
  actorName: string | null
  createdAt: string
}

export interface CpFieldChange {
  _id: string
  field: string
  label: string
  oldValue: string | null
  newValue: string | null
  changedBy: string | null
  changedAt: string
}

export interface CpImportResult {
  total: number
  created: number
  duplicates: { row: number; mobile: string; reason: string }[]
  invalid: { row: number; errors: string[] }[]
  /** added, and flagged: the same mobile / email is on a student lead */
  alsoInStudentLeads: number
  owner: string | null
}

export interface CpStageList {
  stages: CpStage[]
  settings: CpSettings
  documentTypes: Record<string, string>
}

export interface CpStageLogEntry {
  _id: string
  at: string
  actor: string
  action: string
  summary: string | null
  before: unknown
  after: unknown
}
