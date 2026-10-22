import { api } from './api'
import type { ApiListResponse, ApiResponse, Target, TargetOptions } from '../types/models'

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

export interface TargetBody {
  stage: string
  targetCount: number
  description?: string
  startAt: string
  endAt: string
  assignee: string
}

/** Target Manager: progress is counted on the server on every fetch, so the list is always refetched on open. */
export const targetsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listTargets: build.query<ApiListResponse<Target>, Record<string, unknown>>({
      query: (params) => ({ url: '/targets', params: cleanParams(params) }),
      providesTags: ['Targets'],
    }),
    targetOptions: build.query<ApiResponse<TargetOptions>, void>({
      query: () => '/targets/options',
      providesTags: ['Targets'],
    }),
    createTarget: build.mutation<ApiResponse<Target>, TargetBody>({
      query: (body) => ({ url: '/targets', method: 'POST', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['Targets']),
    }),
    updateTarget: build.mutation<ApiResponse<Target>, { id: string; body: Partial<TargetBody> }>({
      query: ({ id, body }) => ({ url: `/targets/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, error) => (error ? [] : ['Targets']),
    }),
    cancelTarget: build.mutation<ApiResponse<Target>, string>({
      query: (id) => ({ url: `/targets/${id}/cancel`, method: 'POST' }),
      invalidatesTags: (_r, error) => (error ? [] : ['Targets']),
    }),
  }),
})

export const {
  useListTargetsQuery,
  useTargetOptionsQuery,
  useCreateTargetMutation,
  useUpdateTargetMutation,
  useCancelTargetMutation,
} = targetsApi
