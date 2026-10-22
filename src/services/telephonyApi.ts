import { api } from './api'
import type {
  ApiListResponse,
  ApiResponse,
  LiveCall,
  LiveCallsPayload,
  TelephonyAgentRow,
  TelephonyEventRow,
  TelephonyNumberRow,
  TelephonyRouting,
  TelephonyStatus,
} from '../types/models'

/** Mutations that share one in-flight state across components (the Call buttons and the popover). */
export const START_CALL_KEY = 'telephony:start-call'

function cleanParams(params: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

export interface CallLogParams {
  from?: string
  to?: string
  userId?: string
  direction?: string
  status?: string
  source?: string
  page?: number
  page_size?: number
}

/** Query string for GET /telephony/calls and its export, from the same filters. */
export const callLogQuery = (params: CallLogParams) => new URLSearchParams(cleanParams({ ...params }) as Record<string, string>).toString()

/**
 * Cloud telephony (Tata Smartflo, apps.telephony): click-to-call, the live-calls feed every
 * signed-in user polls, and the Super Admin's Calling tab (agents, routing, webhooks, events).
 */
export const telephonyApi = api.injectEndpoints({
  endpoints: (build) => ({
    telephonyStatus: build.query<ApiResponse<TelephonyStatus>, { reveal?: boolean } | void>({
      query: (arg) => ({ url: '/telephony/status', params: arg && arg.reveal ? { reveal: 1 } : undefined }),
      providesTags: ['Telephony'],
    }),
    // polled by the popover: marked as background so it never keeps an idle session alive
    liveCalls: build.query<ApiResponse<LiveCallsPayload>, void>({
      query: () => ({ url: '/telephony/calls/live', headers: { 'X-Background': '1' } }),
      providesTags: ['LiveCalls'],
    }),
    startCall: build.mutation<ApiResponse<LiveCall>, { leadId: string }>({
      query: (body) => ({ url: '/telephony/calls', method: 'POST', body }),
      invalidatesTags: (_r, error, { leadId }) => (error ? [] : ['LiveCalls', { type: 'LeadCalls', id: leadId }]),
    }),
    hangupCall: build.mutation<ApiResponse<LiveCall>, string>({
      query: (id) => ({ url: `/telephony/calls/${id}/hangup`, method: 'POST' }),
      invalidatesTags: ['LiveCalls'],
    }),
    dismissCall: build.mutation<ApiResponse<LiveCall>, string>({
      query: (id) => ({ url: `/telephony/calls/${id}/dismiss`, method: 'POST' }),
      invalidatesTags: ['LiveCalls'],
    }),
    attachLead: build.mutation<ApiResponse<LiveCall>, { callId: string; leadId: string }>({
      query: ({ callId, leadId }) => ({ url: `/telephony/calls/${callId}/attach-lead`, method: 'POST', body: { leadId } }),
      invalidatesTags: (_r, error, { leadId }) =>
        error ? [] : ['LiveCalls', { type: 'LeadCalls', id: leadId }, { type: 'LeadTimeline', id: leadId }, { type: 'Lead', id: leadId }],
    }),
    telephonyEvents: build.query<ApiResponse<TelephonyEventRow[]>, { status?: string; limit?: number }>({
      query: (params) => ({ url: '/telephony/events', params: cleanParams({ limit: 50, ...params }) }),
      providesTags: ['Telephony'],
    }),
    retryTelephonyEvent: build.mutation<ApiResponse<TelephonyEventRow>, string>({
      query: (id) => ({ url: `/telephony/events/${id}/retry`, method: 'POST' }),
      invalidatesTags: ['Telephony', 'LiveCalls'],
    }),
    telephonyAgents: build.query<ApiResponse<TelephonyAgentRow[]>, void>({
      query: () => '/telephony/agents',
      // a user edit (dialer fields in Users & Access) refreshes this list too
      providesTags: ['Telephony', { type: 'Users', id: 'LIST' }],
    }),
    syncTelephonyAgents: build.mutation<
      ApiResponse<{ matched: { userId: string; name: string; agentId: string }[]; unmatched: { agentId: string; name: string; number: string }[]; updated: number }>,
      void
    >({
      query: () => ({ url: '/telephony/agents/sync', method: 'POST' }),
      invalidatesTags: ['Telephony', { type: 'Users', id: 'LIST' }, 'Me'],
    }),
    provisionTelephonyAgent: build.mutation<ApiResponse<TelephonyAgentRow>, string>({
      query: (userId) => ({ url: `/telephony/agents/${userId}/provision`, method: 'POST' }),
      invalidatesTags: ['Telephony', { type: 'Users', id: 'LIST' }, 'Me'],
    }),
    telephonyNumbers: build.query<ApiResponse<TelephonyNumberRow[]>, void>({
      query: () => '/telephony/numbers',
      providesTags: ['Telephony'],
    }),
    applyTelephonyRouting: build.mutation<ApiResponse<TelephonyRouting | null>, void>({
      query: () => ({ url: '/telephony/routing/apply', method: 'POST' }),
      invalidatesTags: ['Telephony'],
    }),
    testCall: build.mutation<ApiResponse<{ refId: string; message: string }>, { destination: string }>({
      query: (body) => ({ url: '/telephony/test-call', method: 'POST', body }),
    }),
    /** Call log (Calling tab): admin-like users see every call, a counsellor their own. */
    telephonyCalls: build.query<ApiListResponse<LiveCall>, CallLogParams>({
      query: (params) => ({ url: '/telephony/calls', params: cleanParams({ ...params }) }),
      providesTags: ['LiveCalls'],
    }),
  }),
})

export const {
  useTelephonyStatusQuery,
  useLiveCallsQuery,
  useStartCallMutation,
  useHangupCallMutation,
  useDismissCallMutation,
  useAttachLeadMutation,
  useTelephonyEventsQuery,
  useRetryTelephonyEventMutation,
  useTelephonyAgentsQuery,
  useSyncTelephonyAgentsMutation,
  useProvisionTelephonyAgentMutation,
  useTelephonyNumbersQuery,
  useApplyTelephonyRoutingMutation,
  useTestCallMutation,
  useTelephonyCallsQuery,
} = telephonyApi
