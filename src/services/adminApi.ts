import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  AuditLogEntry,
  PermissionTemplate,
  Team,
  TeamOption,
  TeamStats,
  TeamTreeNode,
  User,
} from '../types/models'

interface ListParams {
  page?: number
  page_size?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  [key: string]: unknown
}

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
}

export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    userOptions: build.query<ApiResponse<Pick<User, '_id' | 'name' | 'email' | 'receivesLeads' | 'designation' | 'team'>[]>, void>({
      query: () => '/users/options',
      providesTags: [{ type: 'Users', id: 'OPTIONS' }],
    }),
    listUsers: build.query<ApiListResponse<User>, ListParams>({
      query: (params) => ({ url: '/users', params: cleanParams(params) }),
      providesTags: [{ type: 'Users', id: 'LIST' }],
    }),
    createUser: build.mutation<ApiResponse<User>, Record<string, unknown>>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['Teams', { type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }],
    }),
    updateUser: build.mutation<ApiResponse<User>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Teams', { type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }, 'Me'],
    }),
    setUserPermissions: build.mutation<ApiResponse<User>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/users/${id}/permissions`, method: 'POST', body }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }, 'Me'],
    }),
    deactivateUser: build.mutation<ApiResponse<User>, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Teams', { type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }],
    }),

    reactivateUser: build.mutation<ApiResponse<User>, string>({
      query: (id) => ({ url: `/users/${id}/reactivate`, method: 'POST' }),
      invalidatesTags: ['Teams', { type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }],
    }),
    resendCredentials: build.mutation<ApiResponse<User>, string>({
      query: (id) => ({ url: `/users/${id}/resend-credentials`, method: 'POST' }),
      invalidatesTags: [{ type: 'Users', id: 'LIST' }],
    }),

    listTeams: build.query<ApiListResponse<Team>, ListParams>({
      query: (params) => ({ url: '/teams', params: cleanParams(params) }),
      providesTags: [{ type: 'Teams', id: 'LIST' }],
    }),
    teamOptions: build.query<ApiResponse<TeamOption[]>, void>({
      query: () => '/teams/options',
      providesTags: [{ type: 'Teams', id: 'LIST' }],
    }),
    teamTree: build.query<ApiResponse<TeamTreeNode[]>, { include_inactive?: boolean }>({
      query: (params) => ({ url: '/teams/tree', params: cleanParams(params) }),
      providesTags: [{ type: 'Teams', id: 'LIST' }],
    }),
    getTeam: build.query<ApiResponse<Team>, string>({
      query: (id) => `/teams/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Teams', id }],
    }),
    teamStats: build.query<ApiResponse<TeamStats>, { id: string; include_sub_teams?: boolean }>({
      query: ({ id, ...params }) => ({ url: `/teams/${id}/stats`, params: cleanParams(params) }),
      providesTags: (_r, _e, { id }) => [{ type: 'Teams', id }],
    }),
    createTeam: build.mutation<ApiResponse<Team>, Record<string, unknown>>({
      query: (body) => ({ url: '/teams', method: 'POST', body }),
      invalidatesTags: [{ type: 'Teams', id: 'LIST' }],
    }),
    // Any team edit can change names, parents or counts shown on other teams' pages,
    // so team mutations refresh every cached team query.
    updateTeam: build.mutation<ApiResponse<Team>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/teams/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Teams'],
    }),
    deleteTeam: build.mutation<ApiResponse<Team>, string>({
      query: (id) => ({ url: `/teams/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Teams'],
    }),
    addTeamMembers: build.mutation<
      ApiResponse<{ added: number; alreadyMembers: number }>,
      { id: string; userIds: string[]; setReportingManager?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `/teams/${id}/members`, method: 'POST', body }),
      invalidatesTags: ['Teams', { type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }],
    }),
    removeTeamMember: build.mutation<ApiResponse<null>, { id: string; userId: string }>({
      query: ({ id, userId }) => ({ url: `/teams/${id}/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Teams', { type: 'Users', id: 'LIST' }, { type: 'Users', id: 'OPTIONS' }],
    }),

    listTemplates: build.query<ApiResponse<PermissionTemplate[]>, void>({
      query: () => '/permission-templates',
      providesTags: [{ type: 'Templates', id: 'LIST' }],
    }),
    createTemplate: build.mutation<ApiResponse<PermissionTemplate>, Record<string, unknown>>({
      query: (body) => ({ url: '/permission-templates', method: 'POST', body }),
      invalidatesTags: [{ type: 'Templates', id: 'LIST' }],
    }),
    updateTemplate: build.mutation<ApiResponse<PermissionTemplate>, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/permission-templates/${id}`, method: 'PUT', body }),
      invalidatesTags: [{ type: 'Templates', id: 'LIST' }],
    }),
    deleteTemplate: build.mutation<ApiResponse<null>, string>({
      query: (id) => ({ url: `/permission-templates/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Templates', id: 'LIST' }],
    }),

    listAuditLogs: build.query<ApiListResponse<AuditLogEntry>, ListParams>({
      query: (params) => ({ url: '/audit-logs', params: cleanParams(params) }),
      providesTags: [{ type: 'AuditLogs', id: 'LIST' }],
    }),
  }),
})

export const {
  useUserOptionsQuery,
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useSetUserPermissionsMutation,
  useDeactivateUserMutation,
  useReactivateUserMutation,
  useResendCredentialsMutation,
  useListTeamsQuery,
  useTeamOptionsQuery,
  useTeamTreeQuery,
  useGetTeamQuery,
  useTeamStatsQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useAddTeamMembersMutation,
  useRemoveTeamMemberMutation,
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  useListAuditLogsQuery,
} = adminApi
