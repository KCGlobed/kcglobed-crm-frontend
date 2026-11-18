import { api } from './api'
import type { ApiListResponse, ApiResponse } from '../types/models'
import type {
  CpDocument, CpDocuments, CpDuplicateCheck, CpFieldChange, CpActivity, CpFollowUp, CpFollowUpSummary, CpFollowUpView,
  CpImportResult, CpLeadDetail, CpLead, CpLeadListParams, CpLogBody, CpMeta, CpNote, CpSettings, CpSource, CpStage,
  CpStageCounts, CpStageList, CpStageLogEntry,
} from '../types/consultants'

/** Channel Partners: /api/v1/consultants. Its own tags, so nothing here refreshes the student screens or the reverse. */
const BASE = '/consultants'

/** File paths for authorizedDownload (lib/download). */
export const cpExportPath = (params: Record<string, string>) => `${BASE}/leads/export?${new URLSearchParams(params)}`
export const cpTemplatePath = `${BASE}/leads/import`
export const cpDocumentPath = (leadId: string, documentId: string) => `${BASE}/leads/${leadId}/documents/${documentId}/download`

function cleanParams(params: object) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

/** A change on a lead: the lead, the list, its timeline and history, and the follow-ups it may have closed or set. */
const leadChanged = (id: string) => [
  { type: 'CpLead' as const, id },
  { type: 'CpLeads' as const, id: 'LIST' },
  { type: 'CpTimeline' as const, id },
  { type: 'CpHistory' as const, id },
  'CpFollowUps' as const,
]

export const consultantsApi = api.injectEndpoints({
  endpoints: (build) => ({
    cpMeta: build.query<ApiResponse<CpMeta>, void>({
      query: () => `${BASE}/meta`,
      providesTags: ['CpMeta'],
    }),

    // ---------------------------------------------------------------- leads
    cpLeads: build.query<ApiListResponse<CpLead>, CpLeadListParams>({
      query: (params) => ({ url: `${BASE}/leads`, params: cleanParams(params) }),
      providesTags: [{ type: 'CpLeads', id: 'LIST' }],
    }),
    cpStageCounts: build.query<ApiResponse<CpStageCounts>, CpLeadListParams>({
      query: (params) => ({ url: `${BASE}/leads/stage-counts`, params: cleanParams(params) }),
      providesTags: [{ type: 'CpLeads', id: 'LIST' }],
    }),
    cpCheckDuplicate: build.query<ApiResponse<CpDuplicateCheck>, { mobile?: string; email?: string; exclude?: string }>({
      query: (params) => ({ url: `${BASE}/leads/check-duplicate`, params: cleanParams(params) }),
    }),
    cpLead: build.query<ApiResponse<CpLeadDetail>, string>({
      query: (id) => `${BASE}/leads/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'CpLead', id }],
    }),
    cpCreateLead: build.mutation<ApiResponse<CpLeadDetail>, Record<string, unknown>>({
      query: (body) => ({ url: `${BASE}/leads`, method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : [{ type: 'CpLeads', id: 'LIST' }, 'CpFollowUps']),
    }),
    cpUpdateLead: build.mutation<ApiResponse<CpLeadDetail>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `${BASE}/leads/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : leadChanged(id)),
    }),
    cpDeleteLead: build.mutation<ApiResponse<null>, string>({
      query: (id) => ({ url: `${BASE}/leads/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : [{ type: 'CpLeads', id: 'LIST' }, 'CpFollowUps']),
    }),
    cpAssign: build.mutation<ApiResponse<{ updated: number; skipped: number }>, { ids: string[]; owner: string | null }>({
      query: (body) => ({ url: `${BASE}/leads/assign`, method: 'POST', body }),
      invalidatesTags: (_r, error, { ids }) =>
        error ? [] : [{ type: 'CpLeads', id: 'LIST' }, 'CpFollowUps', ...ids.map((id) => ({ type: 'CpLead' as const, id }))],
    }),
    cpImport: build.mutation<ApiResponse<CpImportResult>, FormData>({
      query: (body) => ({ url: `${BASE}/leads/import`, method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : [{ type: 'CpLeads', id: 'LIST' }]),
    }),
    /** Log Call / Update: stage, sub-stage, remark, next follow-up. */
    cpLog: build.mutation<ApiResponse<CpLeadDetail>, { id: string; body: CpLogBody }>({
      query: ({ id, body }) => ({ url: `${BASE}/leads/${id}/log`, method: 'POST', body }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : leadChanged(id)),
    }),
    cpTimeline: build.query<ApiListResponse<CpActivity>, { id: string; page?: number; page_size?: number }>({
      query: ({ id, ...params }) => ({ url: `${BASE}/leads/${id}/timeline`, params: cleanParams(params) }),
      providesTags: (_r, _e, { id }) => [{ type: 'CpTimeline', id }],
    }),
    cpHistory: build.query<ApiResponse<CpFieldChange[]>, string>({
      query: (id) => `${BASE}/leads/${id}/history`,
      providesTags: (_r, _e, id) => [{ type: 'CpHistory', id }],
    }),
    cpNotes: build.query<ApiResponse<CpNote[]>, string>({
      query: (id) => `${BASE}/leads/${id}/notes`,
      providesTags: (_r, _e, id) => [{ type: 'CpNotes', id }],
    }),
    cpAddNote: build.mutation<ApiResponse<CpNote>, { id: string; body: string }>({
      query: ({ id, body }) => ({ url: `${BASE}/leads/${id}/notes`, method: 'POST', body: { body } }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : [{ type: 'CpNotes', id }, { type: 'CpTimeline', id }]),
    }),
    cpDocuments: build.query<ApiResponse<CpDocuments>, string>({
      query: (id) => `${BASE}/leads/${id}/documents`,
      providesTags: (_r, _e, id) => [{ type: 'CpDocuments', id }],
    }),
    cpUploadDocument: build.mutation<ApiResponse<CpDocument>, { id: string; body: FormData }>({
      query: ({ id, body }) => ({ url: `${BASE}/leads/${id}/documents`, method: 'POST', body }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : [{ type: 'CpDocuments', id }, { type: 'CpTimeline', id }]),
    }),
    cpDeleteDocument: build.mutation<ApiResponse<CpDocument>, { id: string; documentId: string }>({
      query: ({ id, documentId }) => ({ url: `${BASE}/leads/${id}/documents/${documentId}`, method: 'DELETE' }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : [{ type: 'CpDocuments', id }, { type: 'CpTimeline', id }]),
    }),
    cpLeadFollowUps: build.query<ApiResponse<CpFollowUp[]>, string>({
      query: (id) => `${BASE}/leads/${id}/follow-ups`,
      providesTags: ['CpFollowUps'],
    }),
    cpCreateFollowUp: build.mutation<ApiResponse<CpFollowUp>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `${BASE}/leads/${id}/follow-ups`, method: 'POST', body }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : leadChanged(id)),
    }),

    // ---------------------------------------------------------------- follow-ups
    cpFollowUps: build.query<
      ApiListResponse<CpFollowUp>,
      { view?: CpFollowUpView | 'open'; assignee?: string; type?: string; search?: string; page?: number; page_size?: number }
    >({
      query: (params) => ({ url: `${BASE}/follow-ups`, params: cleanParams(params) }),
      providesTags: ['CpFollowUps'],
    }),
    cpFollowUpSummary: build.query<ApiResponse<CpFollowUpSummary>, { assignee?: string }>({
      query: (params) => ({ url: `${BASE}/follow-ups/summary`, params: cleanParams(params) }),
      providesTags: ['CpFollowUps'],
    }),
    cpUpdateFollowUp: build.mutation<ApiResponse<CpFollowUp>, { id: string; leadId: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `${BASE}/follow-ups/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, error, { leadId }) => (error ? [] : leadChanged(leadId)),
    }),

    // ---------------------------------------------------------------- Lead Stages
    cpStages: build.query<ApiResponse<CpStageList>, void>({
      query: () => `${BASE}/stages`,
      providesTags: ['CpStages'],
    }),
    cpCreateStage: build.mutation<ApiResponse<CpStage>, Record<string, unknown>>({
      query: (body) => ({ url: `${BASE}/stages`, method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['CpStages', 'CpMeta', 'CpStageLog']),
    }),
    cpUpdateStage: build.mutation<ApiResponse<CpStage>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `${BASE}/stages/${id}`, method: 'PUT', body }),
      // a rename shows on every lead
      invalidatesTags: (_r, error) => (error ? [] : ['CpStages', 'CpMeta', 'CpStageLog', 'CpLead', { type: 'CpLeads', id: 'LIST' }]),
    }),
    cpDeleteStage: build.mutation<ApiResponse<null>, string>({
      query: (id) => ({ url: `${BASE}/stages/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, error) => (error ? [] : ['CpStages', 'CpMeta', 'CpStageLog']),
    }),
    cpReorderStages: build.mutation<ApiResponse<CpStage[]>, string[]>({
      query: (ids) => ({ url: `${BASE}/stages/reorder`, method: 'POST', body: { ids } }),
      invalidatesTags: (_r, error) => (error ? [] : ['CpStages', 'CpMeta', 'CpStageLog']),
    }),
    cpUpdateSettings: build.mutation<ApiResponse<CpSettings>, Partial<CpSettings>>({
      query: (body) => ({ url: `${BASE}/stages/settings`, method: 'PUT', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['CpStages', 'CpMeta', 'CpStageLog']),
    }),
    cpStageLog: build.query<ApiResponse<CpStageLogEntry[]>, void>({
      query: () => `${BASE}/stages/log`,
      providesTags: ['CpStageLog'],
    }),
    cpSources: build.query<ApiResponse<CpSource[]>, void>({
      query: () => `${BASE}/sources`,
      providesTags: ['CpSources'],
    }),
    cpSaveSource: build.mutation<ApiResponse<CpSource>, { id?: string; body: { name?: string; isActive?: boolean } }>({
      query: ({ id, body }) => ({ url: id ? `${BASE}/sources/${id}` : `${BASE}/sources`, method: id ? 'PUT' : 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['CpSources', 'CpMeta', 'CpStageLog']),
    }),
  }),
})

export const {
  useCpMetaQuery,
  useCpLeadsQuery,
  useCpStageCountsQuery,
  useLazyCpCheckDuplicateQuery,
  useCpLeadQuery,
  useCpCreateLeadMutation,
  useCpUpdateLeadMutation,
  useCpDeleteLeadMutation,
  useCpAssignMutation,
  useCpImportMutation,
  useCpLogMutation,
  useCpTimelineQuery,
  useCpHistoryQuery,
  useCpNotesQuery,
  useCpAddNoteMutation,
  useCpDocumentsQuery,
  useCpUploadDocumentMutation,
  useCpDeleteDocumentMutation,
  useCpLeadFollowUpsQuery,
  useCpCreateFollowUpMutation,
  useCpFollowUpsQuery,
  useCpFollowUpSummaryQuery,
  useCpUpdateFollowUpMutation,
  useCpStagesQuery,
  useCpCreateStageMutation,
  useCpUpdateStageMutation,
  useCpDeleteStageMutation,
  useCpReorderStagesMutation,
  useCpUpdateSettingsMutation,
  useCpStageLogQuery,
  useCpSourcesQuery,
  useCpSaveSourceMutation,
} = consultantsApi
