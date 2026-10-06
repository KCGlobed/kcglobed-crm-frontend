import { api } from './api'
import type { ApiResponse, User } from '../types/models'

interface AuthPayload {
  user: User
  access_token: string
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<ApiResponse<AuthPayload>, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    refreshSession: build.mutation<ApiResponse<AuthPayload>, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
    }),
    logout: build.mutation<ApiResponse<null>, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    me: build.query<ApiResponse<{ user: User }>, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
    forgotPassword: build.mutation<ApiResponse<null>, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: build.mutation<ApiResponse<null>, { token: string; password: string }>({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),
    changePassword: build.mutation<ApiResponse<null>, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
    }),
  }),
})

export const {
  useLoginMutation,
  useRefreshSessionMutation,
  useLogoutMutation,
  useMeQuery,
  useLazyMeQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
} = authApi
