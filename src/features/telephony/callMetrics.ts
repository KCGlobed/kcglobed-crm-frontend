import type { CallMetric } from '../../services/telephonyApi'

/** The call groups the dashboard cards count — the same definitions as the server's (telephony CALL_METRICS). */
export const CALL_METRICS: { key: CallMetric; label: string }[] = [
  { key: 'dial', label: 'Dial calls' },
  { key: 'dial_connected', label: 'Dial calls — connected' },
  { key: 'dial_not_connected', label: 'Dial calls — not connected' },
  { key: 'inbound', label: 'Inbound calls' },
  { key: 'inbound_answered', label: 'Inbound — received' },
  { key: 'inbound_missed', label: 'Inbound — missed' },
  { key: 'connected', label: 'Connected calls' },
  { key: 'not_connected', label: 'Not connected calls' },
]
