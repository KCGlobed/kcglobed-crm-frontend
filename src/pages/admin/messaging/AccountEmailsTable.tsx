import { useState } from 'react'
import { Pencil, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/feedback'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import { useTestStaffAlertMutation } from '../../../services/messagingApi'
import type { StaffAlertRow } from '../../../types/models'
import { alertKey, describeTest, errorChannel, rowToBody } from './notifications'
import type { DrawerPrefill } from './StaffAlertDrawer'

const TD = 'px-4 py-2'

/**
 * Communication → Notifications → Account emails: the login details, temporary password and password reset emails.
 * Always on, email only, to the user they concern — the subject and text are the admin's to edit.
 */
export function AccountEmailsTable({ rows, editable, onEdit }: { rows: StaffAlertRow[]; editable: boolean; onEdit: (row: StaffAlertRow, prefill?: DrawerPrefill) => void }) {
  const [sendTest] = useTestStaffAlertMutation()
  const [testing, setTesting] = useState<string | null>(null)

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

  if (!rows.length) return <EmptyState title="No account emails" description="The server lists none — it may be older than this page." />
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
          <tr>
            <th className={TD}>Email</th>
            <th className={TD}>Subject</th>
            <th className={cn(TD, 'hidden md:table-cell')}>Last changed</th>
            <th className={cn(TD, 'w-24')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const key = alertKey(row)
            return (
              <tr key={key}>
                <td className={TD}>
                  <button type="button" className="block max-w-md text-left" onClick={() => onEdit(row)} disabled={!editable}>
                    <span className="block truncate text-sm font-medium text-slate-800">{row.label}</span>
                    <span className="block truncate text-xs text-slate-500" title={row.description ?? row.when}>{row.description ?? row.when}</span>
                  </button>
                </td>
                <td className={cn(TD, 'max-w-[20rem] truncate text-slate-700')} title={row.emailSubject}>{row.emailSubject}</td>
                <td className={cn(TD, 'hidden text-xs text-slate-500 md:table-cell')}>
                  {row.updatedBy ? `${row.updatedBy} · ${formatDateTime(row.updatedAt)}` : 'Default wording'}
                </td>
                <td className={cn(TD, 'text-right')}>
                  {editable && (
                    <div className="flex justify-end gap-0.5">
                      <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600" title="Edit" aria-label={`Edit ${row.label}`} onClick={() => onEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600" title="Sends this email to you with sample values" aria-label={`Send a test of ${row.label} to me`} loading={testing === key} onClick={() => test(row)}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
