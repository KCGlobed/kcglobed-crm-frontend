import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  PhoneCall,
  PhoneIncoming,
  RefreshCw,
  RotateCw,
  Save,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import {
  useApplyTelephonyRoutingMutation,
  useProvisionTelephonyAgentMutation,
  useRetryTelephonyEventMutation,
  useSyncTelephonyAgentsMutation,
  useTelephonyAgentsQuery,
  useTelephonyEventsQuery,
  useTelephonyNumbersQuery,
  useTelephonyStatusQuery,
  useTestCallMutation,
  type CallLogParams,
} from '../../../services/telephonyApi'
import { useUpdateUserMutation } from '../../../services/adminApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/fields'
import { EmptyState, Skeleton } from '../../../components/ui/feedback'
import { Card } from '../../../components/ui/misc'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import { CallLog } from '../../../features/telephony/CallLog'
import { AutoDialerCard } from './AutoDialerCard'
import type { TelephonyAgentRow, TelephonyEventRow, TelephonyStatus, TelephonyTemplate } from '../../../types/models'

const copy = (text: string, what = 'Copied') =>
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(what))
    .catch(() => toast.error('Could not copy — select the text and copy it by hand'))

/** The body the admin pastes into Smartflo's webhook form: one key=value per line (form-encoded), or JSON. */
const asForm = (t: TelephonyTemplate) => t.fields.map((f) => `${f.key}=${f.value}`).join('&')
const asJson = (t: TelephonyTemplate) => JSON.stringify(Object.fromEntries(t.fields.map((f) => [f.key, f.value])), null, 2)

function Check({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', ok ? 'text-emerald-700' : 'text-red-600')}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {label}
    </span>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm font-medium text-slate-800">{children}</p>
    </div>
  )
}

// ------------------------------------------------------------------ status

function StatusCard({ status, loading }: { status?: TelephonyStatus; loading: boolean }) {
  if (loading || !status) return <Skeleton className="h-32 w-full" />
  const auth = status.auth
  const warnDays = auth?.daysLeft != null && auth.daysLeft <= 14
  const tokenExpiring = auth?.tokenExpires && dayjs(auth.tokenExpires).diff(dayjs(), 'day') <= 14
  return (
    <Card
      title="Dialer status"
      actions={
        <Badge tone={status.provider === 'smartflo' ? 'green' : 'amber'}>{status.provider === 'smartflo' ? 'Tata Smartflo' : `${status.provider} (test mode)`}</Badge>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Calling">{status.enabled ? 'Enabled for counsellors' : 'Switched off'}</Fact>
        <Fact label="Outbound caller ID">{status.callerId ?? '—'}</Fact>
        <Fact label="Inbound number">{status.inboundDid ?? '—'}</Fact>
        <Fact label="Agents mapped">
          {status.agents ? `${status.agents.mapped} of ${status.agents.total}` : '—'}
        </Fact>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
        <Check ok={status.configured?.auth} label={auth?.mode === 'login' ? 'Login configured' : auth?.mode === 'token' ? 'API token configured' : 'No API credentials'} />
        <Check ok={auth?.ok} label={auth?.ok ? 'Smartflo reachable' : `Smartflo: ${auth?.error ?? 'not checked'}`} />
        <Check ok={status.configured?.callerId} label="Caller ID set" />
        <Check ok={status.configured?.secret} label="Webhook secret set" />
        <Check ok={status.configured?.roleId} label="Agent role ID set (needed to create agents)" />
      </div>
      {(warnDays || tokenExpiring) && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warnDays ? `The Smartflo login password expires in ${auth?.daysLeft} day${auth?.daysLeft === 1 ? '' : 's'} — reset it in the Smartflo portal and update the server .env. ` : ''}
          {tokenExpiring ? `The API token expires on ${formatDateTime(auth?.tokenExpires)} — create a new one in Smartflo (API Connect → API Tokens) and update the server .env.` : ''}
        </p>
      )}
      {status.counters && (
        <p className="mt-3 text-[11px] text-slate-500">
          Today: {status.counters.eventsToday} webhook event{status.counters.eventsToday === 1 ? '' : 's'} · {status.counters.unmatched} unmatched · {status.counters.recordingErrors} recording download
          {status.counters.recordingErrors === 1 ? '' : 's'} failed
        </p>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ webhooks

function WebhooksCard({ status }: { status?: TelephonyStatus }) {
  const [reveal, setReveal] = useState(false)
  const { data: revealed } = useTelephonyStatusQuery({ reveal: true }, { skip: !reveal })
  const url = reveal ? (revealed?.data.webhookUrl ?? status?.webhookUrl) : status?.webhookUrl
  const templates = status?.templates ?? []
  const [open, setOpen] = useState<number | null>(null)
  if (!status) return null
  return (
    <Card title="Webhooks to add in Smartflo" actions={<span className="text-[11px] text-slate-500">API Connect → Webhook → Add Webhook</span>}>
      <p className="text-xs leading-5 text-slate-600">
        Tata support must <b>enable webhooks</b> on the account first. Then add each webhook below with: Request <b>POST</b>, Content-Type{' '}
        <b>application/x-www-form-urlencoded</b> (JSON works too), Date Time Format <b>ISO 8601</b>, Time Zone <b>UTC</b>, My Numbers = the CRM number, and the
        Call Type / Trigger / Outbound Type shown. The minimum set is marked.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Webhook URL</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800" title={url ?? ''}>
          {url ?? '—'}
        </code>
        {!reveal && (
          <Button variant="ghost" size="sm" onClick={() => setReveal(true)}>
            Reveal key
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={!url} onClick={() => copy(url!, 'Webhook URL copied')}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </Button>
      </div>
      {!templates.length ? (
        <p className="mt-3 text-xs text-slate-400">No templates from the server.</p>
      ) : (
        <ol className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {templates.map((t) => (
            <li key={t.n}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"
                onClick={() => setOpen((o) => (o === t.n ? null : t.n))}
                aria-expanded={open === t.n}
              >
                {open === t.n ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                <span className="w-5 shrink-0 font-semibold text-slate-500">{t.n}.</span>
                <span className="min-w-0 flex-1 truncate">
                  <b className="text-slate-800">{t.callType}</b> · {t.trigger}
                  {t.outboundType ? ` · ${t.outboundType}` : ''}
                </span>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">event={t.event}</code>
              </button>
              {open === t.n && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                  <table className="w-full text-[11px]">
                    <tbody>
                      {t.fields.map((f) => (
                        <tr key={f.key}>
                          <td className="w-48 py-0.5 pr-3 font-mono text-slate-600">{f.key}</td>
                          <td className="py-0.5 font-mono text-slate-800">{f.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => copy(asForm(t), 'Form body copied')}>
                      <Copy className="h-3.5 w-3.5" /> Copy as form body
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copy(asJson(t), 'JSON body copied')}>
                      <Copy className="h-3.5 w-3.5" /> Copy as JSON
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ agents

function AgentRow({ agent }: { agent: TelephonyAgentRow }) {
  const [agentId, setAgentId] = useState(agent.telephonyAgentId ?? '')
  const [number, setNumber] = useState(agent.telephonyAgentNumber ?? '')
  const [update, { isLoading: saving }] = useUpdateUserMutation()
  const [provision, { isLoading: creating }] = useProvisionTelephonyAgentMutation()
  const dirty = agentId !== (agent.telephonyAgentId ?? '') || number !== (agent.telephonyAgentNumber ?? '')
  const save = async () => {
    try {
      await update({ id: agent._id, body: { telephonyAgentId: agentId || null, telephonyAgentNumber: number || null } }).unwrap()
      toast.success(`${agent.name}: dialer agent saved`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const create = async () => {
    try {
      const res = await provision(agent._id).unwrap()
      setAgentId(res.data.telephonyAgentId ?? '')
      toast.success(res.message || `${agent.name} created in Smartflo`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const tone = agent.smartflo ? (agent.smartflo.status === 0 ? 'green' : agent.smartflo.status === 3 ? 'amber' : 'red') : 'slate'
  return (
    <tr data-testid="telephony-agent-row">
      <td className="px-3 py-2">
        <p className="text-xs font-medium text-slate-800">{agent.name}</p>
        <p className="text-[11px] text-slate-400">{agent.mobile ?? 'no mobile in CRM'}</p>
      </td>
      <td className="px-3 py-2">
        {agent.smartflo ? (
          <span className="flex flex-wrap items-center gap-1 text-xs">
            <Badge tone={tone}>{agent.smartflo.statusLabel}</Badge>
            <span className="font-mono text-[11px] text-slate-500">{agent.smartflo.agentId}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400">Not in Smartflo</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Input className="!h-8 !w-36 font-mono text-xs" placeholder="050…" value={agentId} onChange={(e) => setAgentId(e.target.value.trim())} aria-label={`Agent ID for ${agent.name}`} />
      </td>
      <td className="px-3 py-2">
        <Input className="!h-8 !w-32 text-xs" placeholder="10 digits" value={number} onChange={(e) => setNumber(e.target.value.trim())} aria-label={`Dialer mobile for ${agent.name}`} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" disabled={!dirty} loading={saving} onClick={save}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          {!agent.smartflo && (
            <Button size="sm" loading={creating} disabled={!agent.mobile} title={agent.mobile ? 'Create this user as a Smartflo agent (rings their mobile)' : 'Add a mobile in Users & Access first'} onClick={create}>
              <UserPlus className="h-3.5 w-3.5" /> Create in Smartflo
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function AgentsCard() {
  const { data, isLoading, refetch, isFetching } = useTelephonyAgentsQuery()
  const [sync, { isLoading: syncing }] = useSyncTelephonyAgentsMutation()
  const onSync = async () => {
    try {
      const res = await sync().unwrap()
      const { matched, unmatched, updated, unlinked = [] } = res.data
      toast.success(`${matched.length} matched, ${updated} updated${unmatched.length ? `, ${unmatched.length} Smartflo agent${unmatched.length === 1 ? '' : 's'} without a CRM user` : ''}`)
      if (unlinked.length) {
        toast.warning(`Deleted in Smartflo: ${unlinked.map((u) => u.name).join(', ')} — use Turn on (Auto-dialer) to create them again`)
      }
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  return (
    <Card
      title="Counsellors as dialer agents"
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" loading={isFetching} onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" loading={syncing} onClick={onSync} title="Match Smartflo agents to CRM users by mobile and fill their agent IDs">
            <RefreshCw className="h-3.5 w-3.5" /> Sync from Smartflo
          </Button>
        </div>
      }
      bodyClassName="p-0"
    >
      {isLoading ? (
        <Skeleton className="m-4 h-32" />
      ) : !data?.data.length ? (
        <EmptyState title="No users with lead access" description="Users who can view leads appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">In Smartflo</th>
                <th className="px-3 py-2">Agent ID</th>
                <th className="px-3 py-2">Dialer mobile</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((a) => (
                <AgentRow key={`${a._id}-${a.telephonyAgentId ?? ''}-${a.telephonyAgentNumber ?? ''}`} agent={a} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ numbers & routing

function RoutingCard({ status }: { status?: TelephonyStatus }) {
  const { data, isLoading } = useTelephonyNumbersQuery()
  const [apply, { isLoading: applying }] = useApplyTelephonyRoutingMutation()
  const onApply = async () => {
    try {
      const res = await apply().unwrap()
      toast.success(res.message || 'Inbound routing applied')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const routing = status?.routing
  return (
    <Card
      title="Numbers & inbound routing"
      actions={
        <Button size="sm" loading={applying} onClick={onApply} title="Create / refresh the CRM Counsellors ring group in Smartflo and point the inbound number at it">
          <PhoneIncoming className="h-3.5 w-3.5" /> Apply inbound routing
        </Button>
      }
      bodyClassName="p-0"
    >
      <p className="px-4 pt-3 text-xs text-slate-600">
        Inbound calls to <b>{status?.inboundDid ?? 'the inbound number'}</b> ring the mapped counsellors{routing?.departmentId ? ` (ring group ${routing.departmentId})` : ''}
        {routing?.destination ? ` · current destination: ${routing.destination}` : ' · not routed yet'}.
      </p>
      {isLoading ? (
        <Skeleton className="m-4 h-24" />
      ) : !data?.data.length ? (
        <EmptyState title="No numbers" description="Smartflo returned no numbers for this account." />
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Number</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Destination</th>
              <th className="px-4 py-2">Used as</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.data.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-2 font-mono text-xs text-slate-800">{n.did}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{n.name || '—'}</td>
                <td className="px-4 py-2 text-xs text-slate-600">{n.destinationName || n.destination || <span className="text-slate-400">not routed</span>}</td>
                <td className="px-4 py-2">
                  <span className="flex gap-1">
                    {n.isCallerId && <Badge tone="blue">Caller ID</Badge>}
                    {n.isInbound && <Badge tone="green">Inbound</Badge>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ events

const EVENT_TONE: Record<string, 'green' | 'red' | 'amber' | 'slate' | 'blue'> = {
  processed: 'green',
  duplicate: 'slate',
  ignored: 'slate',
  unmatched: 'amber',
  failed: 'amber',
  error: 'red',
  received: 'blue',
}

function EventsCard() {
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const { data, isLoading, refetch, isFetching } = useTelephonyEventsQuery({ status: status || undefined }, { pollingInterval: 30000 })
  const [retry, { isLoading: retrying }] = useRetryTelephonyEventMutation()
  const onRetry = async (e: TelephonyEventRow) => {
    try {
      const res = await retry(e._id).unwrap()
      toast[res.data.status === 'processed' ? 'success' : 'error'](res.data.status === 'processed' ? 'Event processed' : (res.data.lastError ?? `Still ${res.data.status}`))
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  return (
    <Card
      title="Recent webhook events"
      actions={
        <div className="flex items-center gap-2">
          <Select className="!h-8 !w-auto text-xs" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Event status">
            <option value="">All</option>
            <option value="processed">Processed</option>
            <option value="unmatched">Unmatched</option>
            <option value="failed">Failed (retrying)</option>
            <option value="error">Error (gave up)</option>
            <option value="duplicate">Duplicate</option>
          </Select>
          <Button variant="ghost" size="sm" loading={isFetching} onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
      bodyClassName="p-0"
    >
      {isLoading ? (
        <Skeleton className="m-4 h-32" />
      ) : !data?.data.length ? (
        <EmptyState title="No events yet" description="Every webhook Smartflo sends lands here with its raw payload, so templates can be checked after the first real call." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Call</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Error</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((e) => (
                <Fragment key={e._id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen((o) => (o === e._id ? null : e._id))}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{formatDateTime(e.createdAt)}</td>
                    <td className="px-3 py-2">
                      <code className="font-mono text-xs text-slate-800">{e.event}</code>
                      {e.direction && <span className="ml-1 text-[11px] text-slate-400">{e.direction}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {e.call?.lead ? (
                        <Link to={`/app/leads/${e.call.lead._id}`} className="text-brand-700 hover:underline" onClick={(ev) => ev.stopPropagation()}>
                          {e.call.lead.name} · {e.call.lead.leadNo}
                        </Link>
                      ) : e.call ? (
                        <span className="text-slate-500">unknown caller</span>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">{e.refId ?? e.uuid ?? e.callId ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={EVENT_TONE[e.status] ?? 'slate'}>{e.status}</Badge>
                      {e.attempts > 1 && <span className="ml-1 text-[11px] text-slate-400">×{e.attempts}</span>}
                    </td>
                    <td className="max-w-64 truncate px-3 py-2 text-xs text-red-600" title={e.lastError ?? ''}>
                      {e.lastError}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                      {(e.status === 'unmatched' || e.status === 'failed' || e.status === 'error') && (
                        <Button variant="outline" size="sm" loading={retrying} onClick={() => onRetry(e)}>
                          <RotateCw className="h-3.5 w-3.5" /> Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                  {open === e._id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-3 py-2">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-700">{JSON.stringify(e.payload, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ------------------------------------------------------------------ test call

function TestCallCard({ status }: { status?: TelephonyStatus }) {
  const [destination, setDestination] = useState('')
  const [test, { isLoading }] = useTestCallMutation()
  const onTest = async () => {
    try {
      const res = await test({ destination: destination.replace(/\D/g, '') }).unwrap()
      toast.success(`${res.data.message} (ref ${res.data.refId})`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  return (
    <Card title="Test call">
      <p className="text-xs text-slate-600">
        Rings your dialer agent{status?.myAgent?.agentId || status?.myAgent?.agentNumber ? ` (${status.myAgent.agentId ?? status.myAgent.agentNumber})` : ''} first, then the
        number below. Nothing is logged on a lead.
      </p>
      <div className="mt-2 flex gap-2">
        <Input className="!w-48" placeholder="10-digit number" value={destination} onChange={(e) => setDestination(e.target.value)} aria-label="Number to call" />
        <Button size="sm" loading={isLoading} disabled={destination.replace(/\D/g, '').length < 10} onClick={onTest}>
          <PhoneCall className="h-3.5 w-3.5" /> Place test call
        </Button>
      </div>
    </Card>
  )
}

// ------------------------------------------------------------------ call log

function CallLogCard() {
  const [filters, setFilters] = useState<CallLogParams>({ page: 1, page_size: 25 })
  return <CallLog filters={filters} onChange={setFilters} />
}

/**
 * Communication → Calling (Super Admin): the Tata Smartflo dialer — status and credentials check, the
 * webhooks to paste into Smartflo, counsellors as agents (create / sync), inbound routing, the raw
 * webhook events, a test call and the call log.
 */
export function CallingTab() {
  const { data, isLoading } = useTelephonyStatusQuery()
  const status = data?.data
  return (
    <div className="space-y-4" data-testid="calling-tab">
      <StatusCard status={status} loading={isLoading} />
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <WebhooksCard status={status} />
        <TestCallCard status={status} />
      </div>
      <AgentsCard />
      <AutoDialerCard />
      <RoutingCard status={status} />
      <EventsCard />
      <CallLogCard />
    </div>
  )
}
