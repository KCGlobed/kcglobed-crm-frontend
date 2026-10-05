import { api } from './api'
import type { ApiResponse, DashboardSummary, Notification, Pagination } from '../types/models'

interface NotificationList {
  items: Notification[]
  unreadCount: number
}

export const miscApi = api.injectEndpoints({
  endpoints: (build) => ({
    dashboardSummary: build.query<ApiResponse<DashboardSummary>, void>({
      query: () => '/dashboard/summary',
      providesTags: ['Dashboard'],
    }),
    listNotifications: build.query<
      ApiResponse<NotificationList> & { pagination: Pagination },
      { page?: number; unread?: boolean }
    >({
      query: ({ page = 1, unread }) => ({
        url: '/notifications',
        params: { page, page_size: 15, ...(unread ? { unread: 'true' } : {}) },
        // the bell's poll is not user activity — it must not keep an idle session alive (GL-05)
        headers: { 'X-Background': '1' },
      }),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: build.mutation<ApiResponse<Notification>, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: build.mutation<ApiResponse<null>, void>({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
  }),
})

export const {
  useDashboardSummaryQuery,
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = miscApi
