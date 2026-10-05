import { api } from './api'
import type { ApiListResponse, ApiResponse, Task, TaskSummary, TaskView } from '../types/models'

export interface TaskListParams {
  view?: TaskView | 'open'
  assignee?: 'me' | string
  lead?: string
  type?: string
  priority?: string
  page?: number
  page_size?: number
}

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

/** A follow-up change also changes the lead (next follow-up), its timeline and maybe notifications. */
const afterChange = (leadId?: string) => [
  'Tasks' as const,
  { type: 'Leads' as const, id: 'LIST' },
  'Notifications' as const,
  'Dashboard' as const,
  ...(leadId ? [{ type: 'Lead' as const, id: leadId }, { type: 'LeadTimeline' as const, id: leadId }] : []),
]

export const tasksApi = api.injectEndpoints({
  endpoints: (build) => ({
    listTasks: build.query<ApiListResponse<Task>, TaskListParams>({
      query: (params) => ({ url: '/tasks', params: cleanParams({ ...params }) }),
      providesTags: ['Tasks'],
    }),
    taskSummary: build.query<ApiResponse<TaskSummary>, { assignee?: string }>({
      query: (params) => ({ url: '/tasks/summary', params: cleanParams({ ...params }) }),
      providesTags: ['Tasks'],
    }),
    leadTasks: build.query<ApiResponse<Task[]>, string>({
      query: (leadId) => `/leads/${leadId}/tasks`,
      providesTags: ['Tasks'],
    }),
    createTask: build.mutation<ApiResponse<Task>, { leadId: string; body: Record<string, unknown> }>({
      query: ({ leadId, body }) => ({ url: `/leads/${leadId}/tasks`, method: 'POST', body }),
      invalidatesTags: (_r, error, { leadId }) => (error ? [] : afterChange(leadId)),
    }),
    updateTask: build.mutation<ApiResponse<Task>, { id: string; leadId: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/tasks/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, error, { leadId }) => (error ? [] : afterChange(leadId)),
    }),
  }),
})

export const {
  useListTasksQuery,
  useTaskSummaryQuery,
  useLeadTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
} = tasksApi
