import { api } from './api'
import type { ApiResponse } from '../types/models'

/** Analytics → Sales & Counsellor (backend apps/analytics). Shapes mirror apps/analytics/metrics.py. */
export type AnalyticsParams = Record<string, string>

export interface Part {
  key: string
  label: string
  value: number
}
export interface SourceRow {
  key: string
  label: string
  total: number
  open: number
  lost: number
  converted: number
  conversion: number
}
export interface StageRow extends Part {
  class: 'open' | 'lost' | 'converted'
  color?: string | null
}
export interface FunnelRow extends Part {
  color?: string | null
  fromPrevious: number | null
}
export interface CounsellorRow {
  key: string
  label: string
  assigned: number
  contactRate: number
  enrolled: number
  lost: number
  contacted: number
  notConnected: number
  notCalled: number
}
export interface FirstCallRow {
  key: string
  label: string
  avgMinutes: number | null
  called: number
  withinTarget: number
  late: number
  pending: number
}
export interface DisciplineRow {
  key: string
  label: string
  passed: number
  onTime: number
  missed: number
  pct: number
}
export interface DayFollowups {
  key: string
  label: string
  onTime: number
  missed: number
  upcoming: number
}
export interface OverdueRow {
  taskId: string
  leadId: string
  leadNo: string
  name: string
  type: string
  dueAt: string
  assignee: string | null
  overdueHours: number
  overdueSeconds: number
}
export interface Option {
  value: string
  label: string
}

export interface Card {
  key: 'total' | 'open' | 'lost' | 'notConnected' | 'converted'
  label: string
  value: number
  inPeriod?: number
  previous: number | null
  change: number | null
  series: number[]
}
export interface CounsellorActionRow {
  key: string
  label: string
  assigned: number
  acted: number
  notActed: number
  pct: number
}
export interface MatrixColumn {
  key: string
  label: string
  class?: 'open' | 'lost' | 'converted'
  color?: string | null
}
export interface MatrixRow {
  key: string
  label: string
  cells: Record<string, number>
  total: number
}
export interface Matrix {
  columns: MatrixColumn[]
  rows: MatrixRow[]
  totals: Record<string, number>
  total: number
}
export interface StageMatrix extends Matrix {
  /** stage id → its sub-stages, each with counts per counsellor id */
  subStages: Record<string, { key: string; label: string; cells: Record<string, number> }[]>
}
export interface ScoreRow {
  key: string
  label: string
  leads: number
  acted: number
  notActed: number
  actedPct: number
  calls: number
  connected: number
  connectRate: number
  avgFirstCall: number | null
  overdue: number
  enrolled: number
  conversion: number
}
export interface CounsellorFollowupRow {
  key: string
  label: string
  dueToday: number
  onTime: number
  missed: number
  overdue: number
  upcoming: number
}

export interface CallRow {
  key: string
  label: string
  calls: number
  connected: number
  notConnected: number
  notAnswered: number
  busy: number
  failed: number
  inbound: number
  connectRate: number
  positive: number
  conversion: number
  enrolled: number
  leads: number
  leadsConnected: number
  talkMinutes: number
  avgTalkSeconds: number
}
export interface CallBucket {
  key: string
  label: string
  calls: number
  connected: number
  notConnected: number
  positive: number
}
export interface CallsSummary {
  period: 'day' | 'week' | 'month'
  rows: CallRow[]
  totals: { calls: number; connected: number; notConnected: number; positive: number; enrolled: number; leads: number; leadsConnected: number; talkMinutes: number; connectRate: number; conversion: number }
  trend: CallBucket[]
  conversion: Part[]
}

export interface AnalyticsSummary {
  calls: CallsSummary
  cards: { period: number; from?: string; to?: string; cards: Card[] }
  counsellorAction: CounsellorActionRow[]
  counsellorSource: Matrix
  counsellorStage: StageMatrix
  scorecard: ScoreRow[]
  counsellorFollowups: CounsellorFollowupRow[]
  filters: AnalyticsParams
  generatedAt: string
  options: { sources: Option[]; counsellors: Option[] }
  headline: { total: number; open: number; lost: number; notConnected: number; converted: number; conversion: number }
  stageSplit: Part[]
  leadsPerDay: Part[]
  bySource: SourceRow[]
  byStage: StageRow[]
  funnel: FunnelRow[]
  counsellors: CounsellorRow[]
  firstCall: { target: number; rows: FirstCallRow[] }
  discipline: DisciplineRow[]
  todayFollowups: { due: number; parts: Part[] }
  attention: Part[]
  followupsPerDay: DayFollowups[]
  longestOverdue: OverdueRow[]
}

export const analyticsApi = api.injectEndpoints({
  endpoints: (build) => ({
    analyticsSummary: build.query<ApiResponse<AnalyticsSummary>, AnalyticsParams>({
      query: (params) => ({ url: '/analytics/summary', params }),
      providesTags: ['Dashboard'],
    }),
    updateAnalyticsSettings: build.mutation<ApiResponse<{ firstCallTargetMinutes: number }>, { firstCallTargetMinutes: number }>({
      query: (body) => ({ url: '/analytics/settings', method: 'PATCH', body }),
      invalidatesTags: ['Dashboard'],
    }),
  }),
})

export const { useAnalyticsSummaryQuery, useUpdateAnalyticsSettingsMutation } = analyticsApi
