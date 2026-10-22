import type { MouseEvent } from 'react'
import { Phone } from 'lucide-react'
import { Button, type ButtonProps } from '../../components/ui/Button'
import { hasDialableNumber } from './callState'
import { useLiveCalls, useStartCall } from './useLiveCalls'

/**
 * Click-to-call for one lead: the dialer rings the counsellor's phone, then the lead. Hidden while
 * the dialer is not set up (or shown disabled with `showWhenDisabled`, as on the lead page), and
 * disabled while this user already has a call going. `mobile` undefined = the row does not carry
 * the number; the server checks it.
 */
export function CallButton({
  leadId,
  mobile,
  label = 'Call',
  showWhenDisabled,
  iconOnly,
  size = 'sm',
  variant = 'outline',
  className,
  onStarted,
}: {
  leadId: string
  mobile?: string | null
  label?: string
  showWhenDisabled?: boolean
  iconOnly?: boolean
  size?: ButtonProps['size']
  variant?: ButtonProps['variant']
  className?: string
  onStarted?: () => void
}) {
  const { enabled, phase, dialing } = useLiveCalls()
  const { startCall } = useStartCall()
  if (!enabled && !showWhenDisabled) return null
  const busy = phase !== 'idle' && phase !== 'ended' && phase !== 'failed'
  const noNumber = !hasDialableNumber(mobile)
  const title = !enabled
    ? 'Calling is not set up yet'
    : noNumber
      ? 'No valid mobile number'
      : busy
        ? 'A call is already in progress'
        : 'Call this lead from the dialer (your phone rings first)'
  const onClick = async (e: MouseEvent) => {
    e.stopPropagation()
    const call = await startCall(leadId)
    if (call) onStarted?.()
  }
  return (
    <Button
      variant={variant}
      size={iconOnly ? 'icon' : size}
      className={className}
      disabled={!enabled || noNumber || busy}
      loading={dialing}
      title={title}
      aria-label={iconOnly ? label : undefined}
      onClick={onClick}
      data-testid="call-lead"
    >
      <Phone className="h-3.5 w-3.5" />
      {!iconOnly && label}
    </Button>
  )
}
