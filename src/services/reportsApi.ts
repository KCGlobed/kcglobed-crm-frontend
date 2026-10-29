import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  ReportDefinition,
  ReportFrequency,
  ReportPeriodKey,
  ReportResult,
  ReportRun,
  ReportSchedule,
} from '../types/models'

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

export interface ReportScheduleBody {
  name: string
  reportKey: string
  period: ReportPeriodKey
  frequency: ReportFrequency
  sendTime: string
  weekdays: number[]
  monthDay: number | null
  recipients: string[]
  cc: string[]
  isActive: boolean
}

/** Reports section: on-screen reports, scheduled emails and their send history. Files download via lib/download. */
export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    reportCatalog: build.query<ApiResponse<ReportDefinition[]>, void>({
      query: () => '/reports',
      providesTags: ['Reports'],
    }),
    reportData: build.query<ApiResponse<ReportResult>, { key: string; dateFrom: string; dateTo?: string }>({
      query: ({ key, ...params }) => ({ url: `/reports/${key}/data`, params: cleanParams(params) }),
      providesTags: ['Reports'],
      keepUnusedDataFor: 30,
    }),
    listReportSchedules: build.query<ApiResponse<ReportSchedule[]>, void>({
      query: () => '/reports/schedules',
      providesTags: ['ReportSchedules'],
    }),
    createReportSchedule: build.mutation<ApiResponse<ReportSchedule>, ReportScheduleBody>({
      query: (body) => ({ url: '/reports/schedules', method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['ReportSchedules']),
    }),
    updateReportSchedule: build.mutation<ApiResponse<ReportSchedule>, { id: string; body: Partial<ReportScheduleBody> }>({
      query: ({ id, body }) => ({ url: `/reports/schedules/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['ReportSchedules']),
    }),
    deleteReportSchedule: build.mutation<ApiResponse<{ _id: string }>, string>({
      query: (id) => ({ url: `/reports/schedules/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : ['ReportSchedules', 'ReportRuns']),
    }),
    // sends at once (the request waits for the email), so the run comes back sent or failed
    runReportSchedule: build.mutation<ApiResponse<ReportRun>, string>({
      query: (id) => ({ url: `/reports/schedules/${id}/run`, method: 'POST' }),
      invalidatesTags: ['ReportSchedules', 'ReportRuns'],
    }),
    listReportRuns: build.query<ApiListResponse<ReportRun>, Record<string, unknown>>({
      query: (params) => ({ url: '/reports/runs', params: cleanParams(params) }),
      providesTags: ['ReportRuns'],
    }),
    resendReportRun: build.mutation<ApiResponse<ReportRun>, string>({
      query: (id) => ({ url: `/reports/runs/${id}/resend`, method: 'POST' }),
      invalidatesTags: ['ReportSchedules', 'ReportRuns'],
    }),
  }),
})

export const {
  useReportCatalogQuery,
  useReportDataQuery,
  useListReportSchedulesQuery,
  useCreateReportScheduleMutation,
  useUpdateReportScheduleMutation,
  useDeleteReportScheduleMutation,
  useRunReportScheduleMutation,
  useListReportRunsQuery,
  useResendReportRunMutation,
} = reportsApi
