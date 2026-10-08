import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import { Mutex } from 'async-mutex'
import { setCredentials, setUser, signedOut } from '../features/auth/authSlice'
import type { User } from '../types/models'
import { API_BASE_URL } from '../constants/config'

interface RootStateShape {
  auth: { accessToken: string | null; user: User | null }
}

// A mutex ensures only one refresh runs when several requests 401 together.
const mutex = new Mutex()

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootStateShape).auth.accessToken
    if (token) headers.set('authorization', `Bearer ${token}`)
    return headers
  },
})

/**
 * Base query with automatic token refresh (SOW §8): on 401, one refresh call
 * runs, the token rotates, and the original request retries. If the refresh
 * fails, the session is cleared and route guards redirect to /login.
 */
export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> =
  async (args, api, extraOptions) => {
    await mutex.waitForUnlock()
    let result = await rawBaseQuery(args, api, extraOptions)

    const isAuthRoute =
      typeof args !== 'string' && typeof args.url === 'string' && args.url.startsWith('/auth/')
    if (result.error?.status === 401 && !isAuthRoute) {
      if (!mutex.isLocked()) {
        const release = await mutex.acquire()
        try {
          const refresh = await rawBaseQuery(
            { url: '/auth/refresh', method: 'POST' },
            api,
            extraOptions
          )
          const data = (refresh.data as { data?: { user: User; access_token: string } })?.data
          if (data?.access_token) {
            api.dispatch(setCredentials({ user: data.user, accessToken: data.access_token }))
          } else {
            api.dispatch(signedOut())
          }
        } finally {
          release()
        }
      } else {
        await mutex.waitForUnlock()
      }
      const token = (api.getState() as RootStateShape).auth.accessToken
      if (token) {
        result = await rawBaseQuery(args, api, extraOptions)
      }
    }
    // GL-02: the server refuses everything until a temporary password is replaced
    const body = (result.error?.data ?? null) as { errors?: { code?: string } } | null
    if (result.error?.status === 403 && body?.errors?.code === 'PASSWORD_CHANGE_REQUIRED') {
      const user = (api.getState() as RootStateShape).auth.user
      if (user && !user.mustChangePassword) api.dispatch(setUser({ ...user, mustChangePassword: true }))
    }
    return result
  }

export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Me',
    'Leads',
    'Lead',
    'LeadNotes',
    'LeadTimeline',
    'LeadProfile',
    'Tasks',
    'Users',
    'Teams',
    'Templates',
    'Masters',
    'MasterList',
    'Notifications',
    'Dashboard',
    'AuditLogs',
    'SavedFilters',
    'LeadCalls',
    'LeadHistory',
    'LeadDiscussion',
    'LeadDocuments',
    'LeadMessages',
    'MessageTemplates',
    'Automations',
    'Campaigns',
    'MetaIntegration',
    'RoundRobin',
  ],
  endpoints: () => ({}),
})
