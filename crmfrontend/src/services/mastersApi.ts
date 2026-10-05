import { api } from './api'
import type { ApiListResponse, ApiResponse, MasterBootstrap } from '../types/models'

export type MasterType =
  | 'sources'
  | 'programs'
  | 'cohorts'
  | 'stages'
  | 'dispositions'
  | 'tags'
  | 'custom-fields'

interface MasterListParams {
  type: MasterType
  page?: number
  page_size?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  is_active?: string
  [key: string]: unknown
}

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
}

export const mastersApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** All active masters in one call — cached and shared by every dropdown. */
    masterBootstrap: build.query<ApiResponse<MasterBootstrap>, void>({
      query: () => '/masters/bootstrap',
      providesTags: ['Masters'],
    }),
    listMaster: build.query<ApiListResponse<Record<string, unknown>>, MasterListParams>({
      query: ({ type, ...params }) => ({ url: `/masters/${type}`, params: cleanParams(params) }),
      providesTags: (_r, _e, { type }) => [{ type: 'MasterList', id: type }],
    }),
    createMaster: build.mutation<ApiResponse<unknown>, { type: MasterType; body: Record<string, unknown> }>({
      query: ({ type, body }) => ({ url: `/masters/${type}`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { type }) => [{ type: 'MasterList', id: type }, 'Masters'],
    }),
    updateMaster: build.mutation<
      ApiResponse<unknown>,
      { type: MasterType; id: string; body: Record<string, unknown> }
    >({
      query: ({ type, id, body }) => ({ url: `/masters/${type}/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { type }) => [{ type: 'MasterList', id: type }, 'Masters'],
    }),
    deleteMaster: build.mutation<ApiResponse<unknown>, { type: MasterType; id: string }>({
      query: ({ type, id }) => ({ url: `/masters/${type}/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { type }) => [{ type: 'MasterList', id: type }, 'Masters'],
    }),
  }),
})

export const {
  useMasterBootstrapQuery,
  useListMasterQuery,
  useCreateMasterMutation,
  useUpdateMasterMutation,
  useDeleteMasterMutation,
} = mastersApi
