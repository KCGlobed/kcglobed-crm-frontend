import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../app/hooks'
import { START_CALL_KEY, telephonyApi, useLiveCallsQuery, useStartCallMutation, useTelephonyStatusQuery } from '../../services/telephonyApi'
import { parseApiError } from '../../lib/utils'
import type { LiveCall, TelephonyStatus } from '../../types/models'
import { deriveCallState, pollIntervalFor, type CallState } from './callState'
import { cancelExpectedCall, expectCall } from './softphone'

/** Whether the dialer is switched on for this CRM (the server says so; console in DEBUG counts). */
export function useTelephonyEnabled(): { enabled: boolean; status: TelephonyStatus | undefined } {
  const user = useCurrentUser()
  const { data } = useTelephonyStatusQuery(undefined, { skip: !user })
  return { enabled: !!data?.data.enabled, status: data?.data }
}

/**
 * The live-calls feed (GET /telephony/calls/live) as a call state, polled quickly while a call is
 * in progress and slowly when nothing is. Every subscriber shares the one query, so the Call
 * buttons, the lead page and the popover all see the same thing.
 */
export function useLiveCalls(): CallState<LiveCall> & { enabled: boolean; dialing: boolean; refetch: () => void } {
  const user = useCurrentUser()
  const { enabled, status } = useTelephonyEnabled()
  const [, { isLoading: dialing }] = useStartCallMutation({ fixedCacheKey: START_CALL_KEY })
  // the interval follows what the cache already holds (read without subscribing), so no effect is needed
  const { data: cached } = telephonyApi.endpoints.liveCalls.useQueryState(undefined)
  const preview = deriveCallState(cached?.data, dialing)
  const interval = pollIntervalFor(preview.phase, preview.pending.length > 0, status?.pollSeconds)
  const { data, refetch } = useLiveCallsQuery(undefined, {
    skip: !user || !enabled,
    pollingInterval: interval,
    skipPollingIfUnfocused: false,
    refetchOnFocus: true,
  })
  const state = useMemo(() => deriveCallState(data?.data, dialing), [data, dialing])
  return { ...state, enabled, dialing, refetch }
}

/** Places a click-to-call for a lead, with the toasts; returns the call row or null when it failed. */
export function useStartCall() {
  const [start, { isLoading }] = useStartCallMutation({ fixedCacheKey: START_CALL_KEY })
  const startCall = useCallback(
    async (leadId: string): Promise<LiveCall | null> => {
      try {
        expectCall({ leadId }) // the CRM phone picks up the counsellor's leg by itself
        const res = await start({ leadId }).unwrap()
        toast.success('Calling the lead…', { id: `call-${res.data._id}` })
        return res.data
      } catch (err) {
        cancelExpectedCall()
        toast.error(parseApiError(err).message)
        return null
      }
    },
    [start]
  )
  return { startCall, dialing: isLoading }
}
