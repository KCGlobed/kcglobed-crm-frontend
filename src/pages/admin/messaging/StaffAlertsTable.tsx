import { useState } from 'react'
import { BellRing, Mail, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, EmptyState } from '../../../components/ui/feedback'
import { Switch } from '../../../components/ui/fields'
import { cn, parseApiError } from '../../../lib/utils'
import { useDeleteStaffAlertMutation, useTestStaffAlertMutation, useUpdateStaffAlertMutation } from '../../../services/messagingApi'
import type { StaffAlertRow, StaffAlertsResponse } from '../../../types/models'
import { alertKey, capabilitiesOf, describeTest, errorChannel, groupRows, kindOf, refusalMessage, rowToBody, type ChannelTab } from './notifications'
import type { DrawerPrefill } from './StaffAlertDrawer'

type ToggleField = 'isActive' | 'pushEnabled' | 'emailEnabled' | 'smsEnabled'
const FIELD_TAB: Partial<Record<ToggleField, ChannelTab>> = { pushEnabled: 'push', emailEnabled: 'email', smsEnabled: 'sms' }
const TH = 'px-4 py-2'
const COLUMNS = 9

/**
 * Communication → Notifications → Staff alerts: every alert the team gets, grouped, each row with its on/off
 * switch, its Push / Email / SMS switches, who gets it and its title. A switch the server refuses (an SMS without
 * its DLT details, an email without a subject) opens the editor on that channel with the switch already flipped.
 */
export function StaffAlertsTable({ rows, groups, options, editable, onEdit, onAdd, hasAny }: {
  rows: StaffAlertRow[]
  groups?: { key: string; label: string }[]
  options: StaffAlertsResponse
  editable: boolean
  onEdit: (row: StaffAlertRow, prefill?: DrawerPrefill) => void
  onAdd: () => void
  /** false: nothing at all (not just nothing matching the filter) */
  hasAny: boolean
}) {
  const [update] = useUpdateStaffAlertMutation()
  const [sendTest] = useTestStaffAlertMutation()
  const [remove, { isLoading: removing }] = useDeleteStaffAlertMutation()
  const [busy, setBusy] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<StaffAlertRow | null>(null)
  const dlt = options.smsProvider === 'webinfosys'

  const toggle = async (row: StaffAlertRow, field: ToggleField) => {
    const key = alertKey(row)
    const next = !row[field]
    setBusy(`${key}:${field}`)
    try {
      const res = await update({ trigger: key, body: { [field]: next } }).unwrap()
      toast.success(res.message)
    } catch (err) {
      const { message, errors } = parseApiError(err)
      const channel = errorChannel(errors) ?? FIELD_TAB[field] ?? null
      if (next && Object.keys(errors).length) {
        // the server wants wording / DLT details first: open the editor on that channel with the switch already on
        onEdit(row, { tab: channel ?? undefined, body: { [field]: true }, errors })
        toast.error(refusalMessage(channel, message))
      } else toast.error(message)
    } finally {
      setBusy(null)
    }
  }
  const test = async (row: StaffAlertRow) => {
    const key = alertKey(row)
    setTesting(key)
    try {
      const res = await sendTest({ trigger: key, body: rowToBody(row) }).unwrap()
      toast.success(`Test sent to you: ${describeTest(res.data)}`)
    } catch (err) {
      const { message, errors } = parseApiError(err)
      if (Object.keys(errors).length) onEdit(row, { tab: errorChannel(errors) ?? undefined, errors })
      toast.error(message)
    } finally {
      setTesting(null)
    }
  }
  const onDelete = async () => {
    if (!deleting) return
    try {
      const res = await remove(alertKey(deleting)).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setDeleting(null)
    }
  }

  if (!hasAny) {
    return (
      <EmptyState
        title="No alerts yet"
        description="The alerts the team gets — a new lead assigned, a follow-up due, a lead left untouched — appear here with their channels and wording."
        action={editable ? <Button size="sm" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> Add alert</Button> : undefined}
      />
    )
  }
  if (!rows.length) return <EmptyState title="Nothing matches" description="Try another word, or show all alerts." />

  const channelSwitch = (row: StaffAlertRow, field: Exclude<ToggleField, 'isActive'>, allowed: boolean, title: string) =>
    allowed ? (
      <span title={title}>
        <Switch
          checked={row[field]}
          onChange={() => toggle(row, field)}
          loading={busy === `${alertKey(row)}:${field}`}
          disabled={!editable}
          label={`${row[field] ? 'Switch off' : 'Switch on'} ${field === 'pushEnabled' ? 'push' : field === 'emailEnabled' ? 'email' : 'SMS'} for ${row.label}`}
        />
      </span>
    ) : (
      <span className="text-slate-300">–</span>
    )

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className={cn(TH, 'w-16')}>Status</th>
              <th className={TH}>Alert</th>
              <th className={cn(TH, 'hidden md:table-cell')}>Who receives</th>
              <th className={cn(TH, 'w-14 text-center')}>Bell</th>
              <th className={cn(TH, 'w-16 text-center')}>Push</th>
              <th className={cn(TH, 'w-16 text-center')}>Email</th>
              <th className={cn(TH, 'w-16 text-center')}>SMS</th>
              <th className={cn(TH, 'hidden lg:table-cell')}>Title / subject</th>
              <th className={cn(TH, 'w-28')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupRows(rows, groups).map((group) => (
              <GroupRows key={group.key} label={group.label} count={group.rows.length}>
                {group.rows.map((row) => {
                  const caps = capabilitiesOf(row)
                  const key = alertKey(row)
                  const custom = kindOf(row) === 'custom'
                  const smsHint = dlt && !(row.smsSenderId && row.smsDltTemplateId)
                    ? 'Needs the DLT sender and template id — switching on opens the editor'
                    : 'Also sent as an SMS to their mobile'
                  return (
                    <tr key={key} className={cn(!row.isActive && 'bg-slate-50/60')}>
                      <td className={TH}>
                        {caps.toggle ? (
                          <Switch
                            checked={row.isActive}
                            onChange={() => toggle(row, 'isActive')}
                            loading={busy === `${key}:isActive`}
                            disabled={!editable}
                            label={`${row.isActive ? 'Switch off' : 'Switch on'} ${row.label}`}
                          />
                        ) : (
                          <span className="text-slate-300" title="Always on">–</span>
                        )}
                      </td>
                      <td className={TH}>
                        <button type="button" className="block max-w-md text-left" onClick={() => onEdit(row)} disabled={!editable}>
                          <span className="flex items-center gap-2">
                            <span className={cn('truncate text-sm font-medium', row.isActive ? 'text-slate-800' : 'text-slate-500')}>{row.label}</span>
                            {custom && <Badge tone="blue">Custom</Badge>}
                          </span>
                          <span className="block truncate text-xs text-slate-500" title={row.description ?? row.when}>
                            {row.description ?? row.when}
                          </span>
                        </button>
                      </td>
                      <td className={cn(TH, 'hidden max-w-[14rem] truncate text-xs text-slate-600 md:table-cell')} title={row.recipientsText}>
                        {caps.recipients || caps.owner ? row.recipientsText || 'Counsellor' : <span className="text-slate-300">–</span>}
                      </td>
                      <td className={cn(TH, 'text-center')}>
                        {row.bell === false ? <span className="text-slate-300">–</span> : <BellRing className="mx-auto h-4 w-4 text-brand-600" aria-label="Always in the bell" />}
                      </td>
                      <td className={cn(TH, 'text-center')}>{channelSwitch(row, 'pushEnabled', caps.push, 'Also pushed to their devices, if they allowed push in the bell')}</td>
                      <td className={cn(TH, 'text-center')}>{channelSwitch(row, 'emailEnabled', caps.email, 'Also emailed to their address')}</td>
                      <td className={cn(TH, 'text-center')}>{channelSwitch(row, 'smsEnabled', caps.sms, smsHint)}</td>
                      <td className={cn(TH, 'hidden max-w-[18rem] lg:table-cell')}>
                        <span className="block truncate text-xs text-slate-700" title={row.pushTitle}>{row.pushTitle || '—'}</span>
                        {row.emailEnabled && row.emailSubject && (
                          <span className="flex items-center gap-1 truncate text-xs text-slate-500" title={row.emailSubject}>
                            <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{row.emailSubject}</span>
                          </span>
                        )}
                      </td>
                      <td className={cn(TH, 'text-right')}>
                        {editable && (
                          <div className="flex justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600" title="Edit" aria-label={`Edit ${row.label}`} onClick={() => onEdit(row)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {caps.test && (
                              <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600" title="Sends this alert to you with sample values" aria-label={`Send a test of ${row.label} to me`} loading={testing === key} onClick={() => test(row)}>
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {caps.delete && (
                              <Button size="icon" variant="ghost" className="text-slate-300 hover:text-red-600" title="Delete" aria-label={`Delete ${row.label}`} onClick={() => setDeleting(row)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </GroupRows>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        title="Delete alert"
        message={`Delete "${deleting?.label}"? It stops at once; the alerts it already sent stay in people's bells.`}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </>
  )
}

/** A section heading row followed by its rows. */
function GroupRows({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-slate-50/70">
        <td colSpan={COLUMNS} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label} <span className="ml-1 font-normal normal-case text-slate-400">{count}</span>
        </td>
      </tr>
      {children}
    </>
  )
}
