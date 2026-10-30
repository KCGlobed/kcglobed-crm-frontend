import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  DashboardSummary,
  Notification,
  NotificationLogRow,
  Pagination,
  PushDevice,
  PushStatus,
} from '../types/models'

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
      { page?: number; unread?: boolean; hideCleared?: boolean }
    >({
      // hideCleared: the bell, which leaves out what Clear All removed; View All shows everything
      query: ({ page = 1, unread, hideCleared }) => ({
        url: '/notifications',
        params: { page, page_size: 15, ...(unread ? { unread: 'true' } : {}), ...(hideCleared ? { cleared: 'false' } : {}) },
        // the bell's poll is not user activity — it must not keep an idle session alive (GL-05)
        headers: { 'X-Background': '1' },
      }),
      providesTags: ['Notifications'],
    }),
    /** Activity Log → Notifications: every alert the CRM raised, who got it, read or not, and its push outcome (admins). */
    notificationLog: build.query<ApiListResponse<NotificationLogRow>, Record<string, unknown>>({
      query: (params) => ({
        url: '/notifications/log',
        params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')),
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
    /** Clear All: empties the user's bell only; the Notifications page (View All) and the Activity Log keep the rows. */
    clearAllNotifications: build.mutation<ApiResponse<{ cleared: number }>, void>({
      query: () => ({ url: '/notifications', method: 'DELETE' }),
      invalidatesTags: ['Notifications'],
    }),
    /** Super Admin, Activity Log → Notifications: Clear All empties that log; nobody's bell or View All changes. */
    clearNotificationLog: build.mutation<ApiResponse<{ cleared: number }>, void>({
      query: () => ({ url: '/notifications/log', method: 'DELETE' }),
      invalidatesTags: ['Notifications'],
    }),
    // browser push (Firebase Cloud Messaging): this device's registration with the backend
    pushStatus: build.query<ApiResponse<PushStatus>, void>({
      query: () => '/notifications/push/status',
      providesTags: ['PushDevices'],
    }),
    subscribePush: build.mutation<ApiResponse<PushDevice>, { token: string; platform?: 'web' | 'android' | 'ios' }>({
      query: (body) => ({ url: '/notifications/push/subscriptions', method: 'POST', body }),
      invalidatesTags: ['PushDevices'],
    }),
    unsubscribePush: build.mutation<ApiResponse<{ removed: boolean }>, { token: string }>({
      query: (body) => ({ url: '/notifications/push/subscriptions', method: 'DELETE', body }),
      invalidatesTags: ['PushDevices'],
    }),
  }),
})

export const {
  useDashboardSummaryQuery,
  useListNotificationsQuery,
  useNotificationLogQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useClearAllNotificationsMutation,
  useClearNotificationLogMutation,
  usePushStatusQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
} = miscApi
