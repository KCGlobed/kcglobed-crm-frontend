import { Phone } from 'lucide-react'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { RowActions, type RowAction } from '../../components/ui/RowActions'
import { hasDialableNumber } from '../../features/telephony/callState'
import { useLiveCalls, useStartCall } from '../../features/telephony/useLiveCalls'
import type { Lead } from '../../types/models'

/** The "⋮" menu of a leads-list row: Call (click-to-dial) while the dialer is set up. */
export function LeadRowActions({ lead }: { lead: Lead }) {
  const user = useCurrentUser()
  const { enabled, phase } = useLiveCalls()
  const { startCall } = useStartCall()
  const busy = phase !== 'idle' && phase !== 'ended' && phase !== 'failed'
  const actions: RowAction[] = [
    {
      label: busy ? 'Call (a call is in progress)' : 'Call',
      icon: Phone,
      onClick: () => void startCall(lead._id),
      hidden: !enabled || !can(user, 'leads', 'edit') || !hasDialableNumber(lead.mobile ?? null) || busy,
    },
  ]
  return <RowActions actions={actions} label={`Actions for ${lead.leadNo}`} />
}
