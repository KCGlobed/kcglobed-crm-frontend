import { useState } from 'react'
import { KeyRound, PhoneIncoming, Power, RefreshCw, Save, Settings2, UserX, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import {
  useApplyDialerSettingsMutation,
  useDialerAgentActionMutation,
  useDialerOverviewQuery,
  useSaveDialerConfigMutation,
  useSetupDialerMutation,
  useSyncDialerMutation,
  useTelephonyNumbersQuery,
} from '../../../services/telephonyApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Checkbox, Input, Select, Switch } from '../../../components/ui/fields'
import { ConfirmDialog, Skeleton } from '../../../components/ui/feedback'
import { Card } from '../../../components/ui/misc'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import type { DialerConfig, DialerOverview } from '../../../types/models'

const NUMBER_FIELDS: { key: keyof DialerConfig; label: string; hint: string }[] = [
  { key: 'retries', label: 'Retries', hint: 'unanswered leads are tried again' },
  { key: 'retryAfterMinutes', label: 'Retry after (min)', hint: '' },
  { key: 'wrapUpSeconds', label: 'Gap before next call (s)', hint: 'Progressive call: the most it waits after a call (to save its outcome) before the next lead — 45 by default; saving the outcome sooner calls the next lead at once' },
  { key: 'redialRounds', label: 'Call again (rounds)', hint: 'progressive call: once every lead was called, the ones who did not pick up are called again (0 = off)' },
  { key: 'ringTimeout', label: 'Ring time (s)', hint: '' },
]

const LEAD_STATUS_LABEL: Record<string, string> = {
  synced: 'in Smartflo',
  sent: 'uploading',
  pending: 'waiting',
  failed: 'retrying',
  error: 'failed',
  removed: 'removed',
}

function SettingsForm({ overview }: { overview: DialerOverview }) {
  const [form, setForm] = useState<DialerConfig>(overview.config)
  const [save, { isLoading: saving }] = useSaveDialerConfigMutation()
  const [apply, { isLoading: applying }] = useApplyDialerSettingsMutation()
  const set = <K extends keyof DialerConfig>(key: K, value: DialerConfig[K]) => setForm((f) => ({ ...f, [key]: value }))
  const toggleStage = (id: string) =>
    set('stageIds', form.stageIds.includes(id) ? form.stageIds.filter((s) => s !== id) : [...form.stageIds, id])
  const onSave = async (patch?: Partial<DialerConfig>) => {
    try {
      const res = await save(patch ?? form).unwrap()
      setForm(res.data)
      toast.success(res.message || 'Saved')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const onApply = async () => {
    try {
      const res = await apply().unwrap()
      const { updated, failed } = res.data
      if (failed.length) toast.error(`${failed.length} campaign(s) not updated: ${failed.map((f) => `${f.name} (${f.error})`).join('; ')}`)
      else toast.success(`${updated} campaign${updated === 1 ? '' : 's'} updated`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <Switch
          checked={form.syncEnabled}
          loading={saving}
          label="Push leads to Smartflo"
          onChange={(on) => {
            set('syncEnabled', on)
            void onSave({ syncEnabled: on })
          }}
        />
        <div className="min-w-0 flex-1 text-xs text-slate-600">
          <b className="text-slate-800">Lead sync {form.syncEnabled ? 'on' : 'off'}</b> — every open lead (website, Meta, upload, manual) goes to its
          counsellor's own Smartflo list within a minute; closed, deleted and reassigned leads leave it. Only the owner's dialer ever calls a lead.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <Switch
          checked={form.queuedOnly ?? true}
          loading={saving}
          label="Call only the queued leads"
          onChange={(on) => {
            set('queuedOnly', on)
            void onSave({ queuedOnly: on })
          }}
        />
        <div className="min-w-0 flex-1 text-xs text-slate-600">
          <b className="text-slate-800">Queued leads only {(form.queuedOnly ?? true) ? 'on' : 'off'}</b> — the dialer calls just the leads a counsellor
          picks for Progressive call, in that order, and no one else. Off: all their open leads are in the list, the picked ones first.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <Switch
          checked={form.stickyAgent ?? true}
          loading={saving}
          label="Calls back reach their counsellor"
          onChange={(on) => {
            set('stickyAgent', on)
            void onSave({ stickyAgent: on })
          }}
        />
        <div className="min-w-0 flex-1 text-xs text-slate-600">
          <b className="text-slate-800">Sticky counsellor {(form.stickyAgent ?? true) ? 'on' : 'off'}</b> — a lead calling the main number is put
          through to the counsellor they last spoke to (for 10 days) instead of the next one in the ring group.
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Stages the dialer calls</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {overview.stages.map((s) => (
            <label key={s._id} className="flex items-center gap-1.5 text-xs text-slate-700">
              <Checkbox checked={form.stageIds.includes(s._id)} onChange={() => toggleStage(s._id)} /> {s.name}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">None ticked = every open stage. Untouched leads are dialled before the others.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {NUMBER_FIELDS.map((f) => (
          <label key={f.key} className="text-xs text-slate-600" title={f.hint}>
            {f.label}
            <Input
              type="number"
              className="mt-1 !h-8 text-xs"
              value={String(form[f.key] ?? '')}
              onChange={(e) => set(f.key, Number(e.target.value) as never)}
            />
          </label>
        ))}
        <label className="text-xs text-slate-600">
          Order
          <Select className="mt-1 !h-8 text-xs" value={form.traversal} onChange={(e) => set('traversal', e.target.value as DialerConfig['traversal'])}>
            <option value="2">Newest first</option>
            <option value="1">Oldest first</option>
            <option value="3">Random</option>
          </Select>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Smartflo role with softphone
          <Input className="mt-1 !h-8 !w-40 font-mono text-xs" placeholder="auto-detected" value={form.roleId ?? ''} onChange={(e) => set('roleId', e.target.value.trim() || null)} />
        </label>
        <Button size="sm" loading={saving} onClick={() => onSave()}>
          <Save className="h-3.5 w-3.5" /> Save settings
        </Button>
        <Button variant="outline" size="sm" loading={applying} onClick={onApply} title="Push ratio, retries, wrap-up … to every counsellor's campaign">
          <Settings2 className="h-3.5 w-3.5" /> Apply to campaigns
        </Button>
      </div>
    </div>
  )
}

function AgentRow({ row, numbers }: { row: DialerOverview['agents'][number]; numbers: { id: string; did: string; isInbound: boolean }[] }) {
  const d = row.dialer
  const deleted = !!row.smartfloDeleted
  const [didId, setDidId] = useState(d?.didId ?? '')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [action, { isLoading }] = useDialerAgentActionMutation()
  const run = async (what: 'enable' | 'disable' | 'reset-password' | 'route-number' | 'remove') => {
    setConfirmRemove(false)
    try {
      await action({ userId: row.userId, action: what, didId: what === 'enable' ? didId || undefined : undefined }).unwrap()
      toast.success(
        what === 'enable'
          ? `${row.name}: ${deleted ? 'created again in Smartflo and ' : ''}on the auto-dialer — they open it from the Dialer button`
          : what === 'disable'
            ? `${row.name}: off the auto-dialer`
            : what === 'reset-password'
              ? `${row.name}: new dialer password (shown in their Dialer)`
              : what === 'remove'
                ? `${row.name}: deleted from Smartflo — the seat is free`
                : `${row.name}: calls to ${d?.didNumber} now reach them`
      )
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const leads = d?.leads ?? {}
  const inList = (leads.synced ?? 0) + (leads.sent ?? 0)
  return (
    <tr data-testid="dialer-agent-row">
      <td className="px-3 py-2">
        <p className="text-xs font-medium text-slate-800">{row.name}</p>
        <p className="font-mono text-[11px] text-slate-400">{d?.loginId ?? row.telephonyAgentId ?? 'no Smartflo agent yet'}</p>
      </td>
      <td className="px-3 py-2">
        {deleted ? (
          <Badge tone="red">Deleted in Smartflo</Badge>
        ) : d ? (
          <Badge tone={d.enabled ? 'green' : 'slate'}>{d.enabled ? 'On' : 'Off'}</Badge>
        ) : (
          <Badge tone="slate">Not set up</Badge>
        )}
        {deleted ? (
          <p className="mt-1 max-w-56 text-[11px] text-red-600">Turn on creates a new Smartflo user for them</p>
        ) : (
          d?.lastError && <p className="mt-1 max-w-56 text-[11px] text-red-600">{d.lastError}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <Select className="!h-8 !w-40 text-xs" value={didId} onChange={(e) => setDidId(e.target.value)} aria-label={`Number for ${row.name}`}>
          <option value="">Default caller ID</option>
          {numbers
            .filter((n) => !n.isInbound)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.did}
              </option>
            ))}
        </Select>
        {d?.didNumber && (
          <p className="mt-1 text-[11px] text-slate-500">
            {d.didNumber} · {d.didRouted ? 'callbacks reach them' : 'callbacks not routed'}
          </p>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">
        {d ? (
          <>
            <b className="text-slate-800">{inList}</b> in list
            {Object.entries(leads)
              .filter(([k, n]) => n && !['synced', 'sent'].includes(k))
              .map(([k, n]) => ` · ${n} ${LEAD_STATUS_LABEL[k] ?? k}`)
              .join('')}
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            size="sm"
            variant={d?.enabled && !deleted ? 'outline' : 'primary'}
            loading={isLoading}
            disabled={!row.mobile && !row.telephonyAgentId}
            onClick={() => run('enable')}
            title={
              !row.mobile && !row.telephonyAgentId
                ? 'Add a mobile in Users & Access first'
                : 'Creates their Smartflo counsellor if needed, then dialer role + softphone, own lead list, own campaign (running it again repairs it)'
            }
          >
            {d?.enabled && !deleted ? <Wrench className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}{' '}
            {deleted ? 'Create again' : d?.enabled ? 'Update' : 'Turn on'}
          </Button>
          {d?.enabled && !deleted && (
            <>
              {d.didId && !d.didRouted && d.didId !== numbers.find((n) => n.isInbound)?.id && (
                <Button size="sm" variant="outline" disabled={isLoading} onClick={() => run('route-number')} title={`Calls to ${d.didNumber} ring ${row.name}'s dialer`}>
                  <PhoneIncoming className="h-3.5 w-3.5" /> Route callbacks
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => run('reset-password')} title="New Smartflo password for the dialer login">
                <KeyRound className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" disabled={isLoading} onClick={() => run('disable')}>
                Turn off
              </Button>
            </>
          )}
          {row.telephonyAgentId && !deleted && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              disabled={isLoading}
              aria-label={`Remove ${row.name} from Smartflo`}
              title="Delete their Smartflo user (frees the calling seat)"
              onClick={() => setConfirmRemove(true)}
            >
              <UserX className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <ConfirmDialog
          open={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          onConfirm={() => void run('remove')}
          loading={isLoading}
          title={`Remove ${row.name} from Smartflo?`}
          message={`Their Smartflo user is deleted and its calling seat is freed. ${row.name} cannot call from the CRM until you Turn on again (that creates a new Smartflo user and keeps their lead list, campaign and number).`}
          confirmLabel="Delete from Smartflo"
          danger
        />
      </td>
    </tr>
  )
}

/**
 * Super Admin: the auto-dialer (apps.telephony.dialer). One Smartflo lead list + campaign per counsellor, filled
 * by the CRM, so the progressive dialer only ever connects a counsellor to their own leads.
 */
export function AutoDialerCard() {
  const { data, isLoading, refetch, isFetching } = useDialerOverviewQuery(undefined, { pollingInterval: 60000 })
  const { data: numbers } = useTelephonyNumbersQuery()
  const [setup, { isLoading: preparing }] = useSetupDialerMutation()
  const [sync, { isLoading: syncing }] = useSyncDialerMutation()
  const overview = data?.data
  const onSetup = async () => {
    try {
      const res = await setup().unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const onSync = async () => {
    try {
      const res = await sync().unwrap()
      const r = res.data as { added?: number; removed?: number; marked?: number; rateLimited?: boolean }
      toast.success(`${r.marked ?? 0} changed · ${r.added ?? 0} sent · ${r.removed ?? 0} removed${r.rateLimited ? ' · Smartflo asked to slow down, the rest follows in a minute' : ''}`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const totals = overview?.totals ?? {}
  return (
    <Card
      title="Auto-dialer (progressive calling on the laptop)"
      actions={
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" loading={isFetching} onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" loading={preparing} onClick={onSetup} title="Create / refresh the CRM dispositions (lead stages) and break codes in Smartflo">
            <Wrench className="h-3.5 w-3.5" /> Prepare Smartflo
          </Button>
          <Button size="sm" loading={syncing} disabled={!overview?.config.syncEnabled} onClick={onSync}>
            <RefreshCw className="h-3.5 w-3.5" /> Sync now
          </Button>
        </div>
      }
    >
      {isLoading || !overview ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-5">
          <p className="text-xs leading-5 text-slate-600">
            Each counsellor gets their <b>own</b> Smartflo lead list, campaign and callback queue, with only them as the agent, so the dialer can never
            put one counsellor's lead through to another. They work in the <b>Dialer</b> (header button): Smartflo's agent panel with a browser
            softphone — calls ring on the laptop headset and every connected lead opens in the CRM. Selecting leads and choosing <b>Auto-dial first</b>{' '}
            makes them the next calls.
          </p>
          <SettingsForm key={JSON.stringify(overview.config)} overview={overview} />
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {Object.entries(LEAD_STATUS_LABEL).map(([k, label]) => (
              <span key={k}>
                <b className="text-slate-800">{totals[k] ?? 0}</b> {label}
              </span>
            ))}
            <span className="text-slate-400">last sync {overview.lastRunAt ? formatDateTime(overview.lastRunAt) : 'never'}</span>
          </div>
          {overview.errors.length > 0 && (
            <ul className="space-y-0.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {overview.errors.map((e) => (
                <li key={e.leadId}>
                  Lead {e.leadId}: {e.error} ({e.status === 'error' ? 'gave up until the lead changes' : 'retrying'})
                </li>
              ))}
            </ul>
          )}
          <div className="-mx-4 overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Counsellor</th>
                  <th className="px-3 py-2">Auto-dialer</th>
                  <th className="px-3 py-2">Their number</th>
                  <th className="px-3 py-2">Leads</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.agents.map((row) => (
                  <AgentRow key={`${row.userId}-${row.dialer?.updatedAt ?? ''}`} row={row} numbers={numbers?.data ?? []} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}
