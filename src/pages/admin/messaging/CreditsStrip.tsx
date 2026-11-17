import type { ReactNode } from 'react'
import { Mail, MessageCircle, MessageSquareText, RefreshCw, type LucideIcon } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Skeleton } from '../../../components/ui/feedback'
import { cn, formatDateTime } from '../../../lib/utils'
import {
  useLazyMessagingCreditsQuery,
  useMessagingCreditsQuery,
  type CreditsOverview,
} from '../../../services/messagingApi'

/**
 * What each channel can still send, above every tab of the Communication page:
 * SMS — the credits Webinfosys reports; WhatsApp — the number's daily Meta tier (no prepaid credits, Meta bills the
 * card on the business account); Email — Office 365's daily limit (rolling 24 h, no monthly cap).
 */

const num = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'))

const QUALITY: Record<string, { label: string; tone: 'green' | 'amber' | 'red' }> = {
  GREEN: { label: 'High', tone: 'green' },
  YELLOW: { label: 'Medium', tone: 'amber' },
  RED: { label: 'Low', tone: 'red' },
}

function StatusBadge({ status, low }: { status: 'ok' | 'low' | 'unavailable'; low: string }) {
  if (status === 'low') return <Badge tone="red" dot>{low}</Badge>
  if (status === 'unavailable') return <Badge tone="slate">Not available</Badge>
  return <Badge tone="green" dot>OK</Badge>
}

function Card({
  icon: Icon,
  title,
  badge,
  big,
  sub,
  lines,
  note,
  checkedAt,
  tone,
}: {
  icon: LucideIcon
  title: string
  badge: ReactNode
  big: ReactNode
  sub?: ReactNode
  lines: ReactNode[]
  note?: string | null
  checkedAt?: string | null
  tone: 'ok' | 'low' | 'unavailable'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-xl border bg-white p-4 shadow-sm',
        tone === 'low' ? 'border-red-200' : 'border-slate-200',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon className="h-4 w-4 text-slate-400" aria-hidden />
          {title}
        </span>
        {badge}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold', tone === 'low' ? 'text-red-600' : 'text-slate-900')}>{big}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
      <div className="mt-2 space-y-0.5 text-xs text-slate-600">
        {lines.filter(Boolean).map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      {note && <p className="mt-2 text-xs text-slate-400">{note}</p>}
      {checkedAt && <p className="mt-auto pt-2 text-[11px] text-slate-400">Checked {formatDateTime(checkedAt)}</p>}
    </div>
  )
}

function Cards({ data }: { data: CreditsOverview }) {
  const { sms, whatsapp: wa, email } = data
  const quality = wa.quality ? QUALITY[wa.quality.toUpperCase()] : undefined
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card
        icon={MessageSquareText}
        title="SMS credits"
        tone={sms.status}
        badge={<StatusBadge status={sms.status} low="Recharge needed" />}
        big={sms.credits == null ? 'N/A' : `${num(sms.credits)} credits`}
        sub={sms.pools.length > 1 ? sms.pools.map((p) => `${p.label} ${num(p.credits)}`).join(' · ') : 'Webinfosys balance'}
        lines={[`Sent today: ${num(sms.sentToday)}`, `Sent this month: ${num(sms.sentMonth)}`]}
        note={sms.note}
        checkedAt={sms.checkedAt}
      />
      <Card
        icon={MessageCircle}
        title="WhatsApp"
        tone={wa.status}
        badge={<StatusBadge status={wa.status} low={wa.quality?.toUpperCase() === 'RED' ? 'Quality low' : 'Limit almost used'} />}
        big={
          wa.status === 'unavailable'
            ? 'N/A'
            : wa.limit == null
              ? 'Unlimited'
              : `${num(wa.left)} of ${num(wa.limit)} left today`
        }
        sub="People you can start a chat with in 24 hours (Meta limit)"
        lines={[
          `Sent today: ${num(wa.sentToday)} · this month: ${num(wa.sentMonth)}`,
          wa.status !== 'unavailable' && `People messaged in last 24 h: ${num(wa.used24h)}`,
          quality && (
            <>
              Quality: <Badge tone={quality.tone}>{quality.label}</Badge>
            </>
          ),
          wa.spend != null && `Spent this month: ${wa.currency ?? ''} ${wa.spend.toLocaleString('en-IN')}`.trim(),
        ]}
        note={wa.note}
        checkedAt={wa.checkedAt}
      />
      <Card
        icon={Mail}
        title="Email (Office 365)"
        tone={email.status}
        badge={<StatusBadge status={email.status} low="Limit almost used" />}
        big={email.status === 'unavailable' ? 'N/A' : `${num(email.left)} of ${num(email.limit)} left today`}
        sub={`Daily limit, rolling 24 hours · no monthly cap · ${email.perMinute} per minute`}
        lines={[
          `Sent in last 24 h: ${num(email.used24h)}`,
          `Sent today: ${num(email.sentToday)} · this month: ${num(email.sentMonth)}`,
          `From: ${email.sender}`,
        ]}
        note={email.status === 'unavailable' ? email.note : null}
      />
    </div>
  )
}

export function CreditsStrip() {
  const { data, isLoading, isFetching } = useMessagingCreditsQuery()
  const [refresh, { data: fresh, isFetching: refreshing }] = useLazyMessagingCreditsQuery()
  // after Refresh, the providers' new answer (it is cached under its own args)
  const overview = fresh?.data ?? data?.data
  return (
    <section className="mb-4 mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Credits &amp; sending limits</h2>
        <button
          type="button"
          onClick={() => refresh({ refresh: true })}
          disabled={refreshing || isFetching}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', (refreshing || isFetching) && 'animate-spin')} aria-hidden />
          Refresh
        </button>
      </div>
      {isLoading || !overview ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        <Cards data={overview} />
      )}
    </section>
  )
}
