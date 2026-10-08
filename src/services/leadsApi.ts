import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  BulkAssignResult,
  CallLog,
  DiscussionData,
  DispositionStage,
  DocumentSlot,
  DuplicateCheck,
  ExportJob,
  FieldChangeEntry,
  FilterFieldsMeta,
  ImportPreview,
  ImportResult,
  Lead,
  LeadActivity,
  LeadDocumentFile,
  LeadProfile,
  MyDay,
  ProfileStepKey,
  Note,
  RoundRobinSettings,
  RoundRobinStatus,
  SavedFilter,
} from '../types/models'

export interface LeadListParams {
  page?: number
  page_size?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  stage?: string
  sub_stage?: string
  source?: string
  owner?: string
  program?: string
  cohort?: string
  tag?: string
  status?: string
  track?: string
  created_from?: string
  created_to?: string
  unassigned?: string
  smart?: string
  /** JSON list of {field, op, value} (GL-34) */
  filters?: string
  [key: string]: unknown
}

/** The list response carries a notice when a search hits someone else's lead (GL-07). */
export type LeadListResponse = ApiListResponse<Lead> & { notice?: string }

export interface GlobalSearchResult {
  items: { _id: string; leadNo: string; name: string; mobile?: string; email?: string; stage?: string; owner?: string }[]
  total: number
  notice: string | null
}

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
}

/** Everything a change on one lead can affect. */
const leadChanged = (id: string) => [
  { type: 'Lead' as const, id },
  { type: 'Leads' as const, id: 'LIST' },
  { type: 'LeadTimeline' as const, id },
  { type: 'LeadHistory' as const, id },
  'Tasks' as const,
  'Dashboard' as const,
]

export const leadsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listLeads: build.query<LeadListResponse, LeadListParams>({
      query: (params) => ({ url: '/leads', params: cleanParams({ ...params }) }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((l) => ({ type: 'Lead' as const, id: l._id })),
              { type: 'Leads', id: 'LIST' },
            ]
          : [{ type: 'Leads', id: 'LIST' }],
    }),
    getLead: build.query<ApiResponse<Lead>, string>({
      query: (id) => `/leads/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Lead', id }],
    }),
    createLead: build.mutation<ApiResponse<Lead>, Record<string, unknown>>({
      query: (body) => ({ url: '/leads', method: 'POST', body }),
      invalidatesTags: [{ type: 'Leads', id: 'LIST' }, 'Dashboard'],
    }),
    updateLead: build.mutation<ApiResponse<Lead>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/leads/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => leadChanged(id),
    }),
    assignLead: build.mutation<ApiResponse<Lead>, { id: string; owner: string; reason: string }>({
      query: ({ id, owner, reason }) => ({ url: `/leads/${id}/assign`, method: 'POST', body: { owner, reason } }),
      invalidatesTags: (_r, _e, { id }) => leadChanged(id),
    }),
    bulkAssign: build.mutation<
      ApiResponse<BulkAssignResult>,
      { leadIds?: string[]; selectAll?: boolean; filters?: Record<string, unknown>; owners: string[]; reason: string; preview?: boolean }
    >({
      query: (body) => ({ url: '/leads/bulk-assign', method: 'POST', body }),
      invalidatesTags: (_r, error, { preview }) => (error || preview ? [] : ['Lead', { type: 'Leads', id: 'LIST' }, 'Dashboard', 'Tasks']),
    }),
    deleteLead: build.mutation<ApiResponse<null>, string>({
      query: (id) => ({ url: `/leads/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Leads', id: 'LIST' }, 'Dashboard'],
    }),
    checkDuplicate: build.query<ApiResponse<DuplicateCheck>, { mobile?: string; email?: string; exclude?: string }>({
      query: (params) => ({ url: '/leads/check-duplicate', params: cleanParams(params) }),
    }),
    filterFields: build.query<ApiResponse<FilterFieldsMeta>, void>({
      query: () => '/leads/filter-fields',
      providesTags: ['Masters'],
    }),
    savedFilters: build.query<ApiResponse<SavedFilter[]>, void>({
      query: () => '/leads/saved-filters',
      providesTags: ['SavedFilters'],
    }),
    saveFilter: build.mutation<ApiResponse<SavedFilter>, { name: string; params: Record<string, string> }>({
      query: (body) => ({ url: '/leads/saved-filters', method: 'POST', body }),
      invalidatesTags: ['SavedFilters'],
    }),
    deleteSavedFilter: build.mutation<ApiResponse<null>, string>({
      query: (id) => ({ url: `/leads/saved-filters/${id}`, method: 'DELETE' }),
      invalidatesTags: ['SavedFilters'],
    }),
    globalSearch: build.query<ApiResponse<GlobalSearchResult>, string>({
      query: (q) => ({ url: '/leads/search', params: { q } }),
    }),
    myDay: build.query<ApiResponse<MyDay>, void>({
      query: () => '/leads/my-day',
      providesTags: ['Dashboard'],
    }),
    dispositionOptions: build.query<
      ApiResponse<{ stages: DispositionStage[]; followUpTypes: { value: string; label: string }[] }>,
      void
    >({
      query: () => '/leads/disposition-options',
      providesTags: ['Masters'],
    }),
    saveDisposition: build.mutation<ApiResponse<{ callId: string | null; followUpId: string | null; lead: Lead }>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/leads/${id}/disposition`, method: 'POST', body }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : [...leadChanged(id), { type: 'LeadCalls', id }, { type: 'LeadNotes', id }, 'LeadMessages']),
    }),
    leadCalls: build.query<ApiResponse<CallLog[]>, string>({
      query: (id) => `/leads/${id}/calls`,
      providesTags: (_r, _e, id) => [{ type: 'LeadCalls', id }],
    }),
    leadNotes: build.query<ApiResponse<Note[]>, string>({
      query: (id) => `/leads/${id}/notes`,
      providesTags: (_r, _e, id) => [{ type: 'LeadNotes', id }],
    }),
    addLeadNote: build.mutation<ApiResponse<Note>, { id: string; body: string; category?: string }>({
      query: ({ id, ...body }) => ({ url: `/leads/${id}/notes`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'LeadNotes', id },
        { type: 'LeadTimeline', id },
      ],
    }),
    editLeadNote: build.mutation<ApiResponse<Note>, { id: string; noteId: string; body: string }>({
      query: ({ id, noteId, body }) => ({ url: `/leads/${id}/notes/${noteId}`, method: 'PUT', body: { body } }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'LeadNotes', id },
        { type: 'LeadTimeline', id },
      ],
    }),
    leadTimeline: build.query<ApiListResponse<LeadActivity>, { id: string; page?: number; type?: string }>({
      query: ({ id, page = 1, type }) => ({
        url: `/leads/${id}/timeline`,
        params: { page, page_size: 25, ...(type ? { type } : {}) },
      }),
      providesTags: (_r, _e, { id }) => [{ type: 'LeadTimeline', id }],
    }),
    leadHistory: build.query<ApiListResponse<FieldChangeEntry>, { id: string; page?: number }>({
      query: ({ id, page = 1 }) => ({ url: `/leads/${id}/history`, params: { page, page_size: 50 } }),
      providesTags: (_r, _e, { id }) => [{ type: 'LeadHistory', id }],
    }),
    leadDiscussion: build.query<ApiResponse<DiscussionData>, string>({
      query: (id) => `/leads/${id}/discussion`,
      providesTags: (_r, _e, id) => [{ type: 'LeadDiscussion', id }],
    }),
    saveLeadDiscussion: build.mutation<ApiResponse<DiscussionData>, { id: string; changes: Record<string, unknown> }>({
      query: ({ id, changes }) => ({ url: `/leads/${id}/discussion`, method: 'PUT', body: changes }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        // autosave: write the server's answer straight into the cache (no refetch flicker)
        try {
          const { data } = await queryFulfilled
          dispatch(leadsApi.util.updateQueryData('leadDiscussion', id, (draft) => {
            draft.data = data.data
          }))
        } catch {
          // the form shows the error
        }
      },
      invalidatesTags: (_r, error, { id }) =>
        error ? [] : [{ type: 'LeadTimeline', id }, { type: 'LeadHistory', id }, { type: 'LeadProfile', id }, 'Tasks', { type: 'Lead', id }],
    }),
    leadDocuments: build.query<ApiResponse<{ documents: DocumentSlot[]; complete: boolean }>, string>({
      query: (id) => `/leads/${id}/documents`,
      providesTags: (_r, _e, id) => [{ type: 'LeadDocuments', id }],
    }),
    uploadLeadDocument: build.mutation<ApiResponse<LeadDocumentFile>, { id: string; body: FormData }>({
      query: ({ id, body }) => ({ url: `/leads/${id}/documents`, method: 'POST', body }),
      invalidatesTags: (_r, error, { id }) =>
        error ? [] : [{ type: 'LeadDocuments', id }, { type: 'LeadProfile', id }, { type: 'LeadTimeline', id }],
    }),
    profileOptions: build.query<ApiResponse<{ states: string[]; citiesByState: Record<string, string[]> }>, void>({
      query: () => '/leads/profile-options',
    }),
    importPreview: build.mutation<ApiResponse<ImportPreview>, FormData>({
      query: (body) => ({ url: '/leads/import/preview', method: 'POST', body }),
    }),
    bulkUploadLeads: build.mutation<ApiResponse<ImportResult>, FormData>({
      query: (body) => ({ url: '/leads/bulk-upload', method: 'POST', body }),
      invalidatesTags: [{ type: 'Leads', id: 'LIST' }, 'Dashboard', 'Notifications'],
    }),
    exportJob: build.query<ApiResponse<ExportJob>, string>({
      query: (id) => `/leads/exports/${id}`,
    }),
    leadProfile: build.query<ApiResponse<LeadProfile>, string>({
      query: (id) => `/leads/${id}/profile`,
      providesTags: (_r, _e, id) => [{ type: 'LeadProfile', id }],
    }),
    saveLeadProfileStep: build.mutation<
      ApiResponse<LeadProfile>,
      { id: string; step: ProfileStepKey; body: Record<string, unknown> }
    >({
      query: ({ id, step, body }) => ({ url: `/leads/${id}/profile/${step}`, method: 'PUT', body }),
      invalidatesTags: (_r, error, { id }) =>
        error ? [] : [{ type: 'LeadProfile', id }, { type: 'Lead', id }, { type: 'LeadDiscussion', id }, { type: 'LeadHistory', id }],
    }),
    unlockLeadProfile: build.mutation<ApiResponse<LeadProfile>, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/leads/${id}/profile/unlock`, method: 'POST', body: { reason } }),
      invalidatesTags: (_r, error, { id }) => (error ? [] : [{ type: 'LeadProfile', id }]),
    }),
    acceptLeadProfileDeclaration: build.mutation<ApiResponse<LeadProfile>, string>({
      query: (id) => ({ url: `/leads/${id}/profile/declaration`, method: 'POST', body: { accepted: true } }),
      invalidatesTags: (_r, error, id) => (error ? [] : [{ type: 'LeadProfile', id }]),
    }),
    // Round-robin screen. Both mutations answer with the fresh status, which is
    // written straight into the status cache (no refetch flicker).
    roundRobinStatus: build.query<ApiResponse<RoundRobinStatus>, void>({
      query: () => '/leads/round-robin',
      providesTags: ['RoundRobin'],
    }),
    updateRoundRobinSettings: build.mutation<ApiResponse<RoundRobinStatus>, Partial<RoundRobinSettings>>({
      query: (body) => ({ url: '/leads/round-robin', method: 'PUT', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(leadsApi.util.updateQueryData('roundRobinStatus', undefined, (draft) => {
            draft.data = data.data
          }))
        } catch {
          // the form shows the error
        }
      },
      // turning RR on / opening the window hands out pooled leads at once
      invalidatesTags: (_r, error) => (error ? [] : [{ type: 'Leads', id: 'LIST' }, 'Dashboard']),
    }),
    setRoundRobinUser: build.mutation<ApiResponse<RoundRobinStatus>, { userId: string; receivesLeads: boolean }>({
      query: ({ userId, receivesLeads }) => ({ url: `/leads/round-robin/users/${userId}`, method: 'PATCH', body: { receivesLeads } }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(leadsApi.util.updateQueryData('roundRobinStatus', undefined, (draft) => {
            draft.data = data.data
          }))
        } catch {
          // the row shows the error
        }
      },
      invalidatesTags: (_r, error) => (error ? [] : [{ type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }]),
    }),
  }),
})

export const {
  useListLeadsQuery,
  useGetLeadQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useAssignLeadMutation,
  useBulkAssignMutation,
  useDeleteLeadMutation,
  useLazyCheckDuplicateQuery,
  useFilterFieldsQuery,
  useSavedFiltersQuery,
  useSaveFilterMutation,
  useDeleteSavedFilterMutation,
  useGlobalSearchQuery,
  useMyDayQuery,
  useDispositionOptionsQuery,
  useSaveDispositionMutation,
  useLeadCallsQuery,
  useLeadNotesQuery,
  useAddLeadNoteMutation,
  useEditLeadNoteMutation,
  useLeadTimelineQuery,
  useLeadHistoryQuery,
  useLeadDiscussionQuery,
  useSaveLeadDiscussionMutation,
  useLeadDocumentsQuery,
  useUploadLeadDocumentMutation,
  useProfileOptionsQuery,
  useImportPreviewMutation,
  useBulkUploadLeadsMutation,
  useLazyExportJobQuery,
  useLeadProfileQuery,
  useSaveLeadProfileStepMutation,
  useAcceptLeadProfileDeclarationMutation,
  useUnlockLeadProfileMutation,
  useRoundRobinStatusQuery,
  useUpdateRoundRobinSettingsMutation,
  useSetRoundRobinUserMutation,
} = leadsApi
