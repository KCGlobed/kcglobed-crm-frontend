import { useSearchParams } from 'react-router-dom'
import { useCurrentUser } from '../../app/hooks'
import { PageHeader } from '../../components/ui/misc'
import { CallLog } from '../../features/telephony/CallLog'
import { CALL_METRICS } from '../../features/telephony/callMetrics'
import type { CallLogParams, CallMetric } from '../../services/telephonyApi'

const KEYS = ['from', 'to', 'userId', 'metric', 'direction', 'status', 'source'] as const

/**
 * Calls: the call log behind the dashboard's call cards (Dial calls, Connected, Inbound missed, …). The card's filters
 * come in the address — the same ones the card counted, so the list's total is the card's number — and stay there
 * while they are changed (a link to it shows the same calls). `back=dashboard` offers the way back.
 */
export default function CallsPage() {
  const user = useCurrentUser()
  const [search, setSearch] = useSearchParams()
  const filters: CallLogParams = {
    ...Object.fromEntries(KEYS.flatMap((k) => (search.get(k) ? [[k, search.get(k)]] : []))),
    page: Number(search.get('page')) || 1,
    page_size: Number(search.get('page_size')) || 25,
  }
  const onChange = (next: CallLogParams) => {
    const out = new URLSearchParams()
    for (const k of KEYS) if (next[k]) out.set(k, String(next[k]))
    if ((next.page ?? 1) > 1) out.set('page', String(next.page))
    if (next.page_size && next.page_size !== 25) out.set('page_size', String(next.page_size))
    if (search.get('back')) out.set('back', search.get('back')!)
    setSearch(out, { replace: true })
  }
  // a counsellor sees their own calls: no one to pick
  const seesOthers = !!user && (user.isSuperAdmin || user.dataScope !== 'own')
  const metric = CALL_METRICS.find((m) => m.key === (filters.metric as CallMetric | undefined))
  const day = filters.from && filters.from === filters.to ? filters.from : null
  return (
    <>
      <PageHeader
        title={metric ? metric.label : 'Calls'}
        description={[day ? `On ${day}` : filters.from || filters.to ? `${filters.from ?? '…'} to ${filters.to ?? '…'}` : 'All dates', 'newest first'].join(' · ')}
      />
      <CallLog filters={filters} onChange={onChange} title="Calls" showPeople={seesOthers} />
    </>
  )
}
