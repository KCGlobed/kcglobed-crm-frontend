import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/feedback'
import { CheckboxMultiSelect } from '../../components/ui/CheckboxMultiSelect'
import { useUserOptionsQuery } from '../../services/adminApi'
import {
  useExportMaskingQuery,
  useUpdateExportMaskingMutation,
  type ExportMasking,
  type ExportMaskingRule,
} from '../../services/mastersApi'
import { formatDateTime, parseApiError } from '../../lib/utils'

/** The roles that can be given full contacts (the Super Admin always has them). */
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'counsellor', label: 'Admission Counsellor' },
  { value: 'other', label: 'Custom access' },
]

type Rules = Record<string, ExportMaskingRule>

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v))

function MaskingForm({ data }: { data: ExportMasking }) {
  const [rules, setRules] = useState<Rules>(data.fullAccess)
  const [save, { isLoading }] = useUpdateExportMaskingMutation()
  const users = useUserOptionsQuery()
  const userOptions = useMemo(
    () =>
      (users.data?.data ?? [])
        .filter((u) => u.role !== 'super_admin')
        .map((u) => ({ value: u._id, label: u.email ? `${u.name} (${u.email})` : u.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users.data]
  )
  const rule = (key: string): ExportMaskingRule => rules[key] ?? { roles: [], users: [] }
  const set = (key: string, patch: Partial<ExportMaskingRule>) => setRules((r) => ({ ...r, [key]: { ...rule(key), ...patch } }))
  const dirty = data.modules.some(
    ({ key }) =>
      !same(rule(key).roles, data.fullAccess[key]?.roles ?? []) || !same(rule(key).users, data.fullAccess[key]?.users ?? [])
  )

  const onSave = async () => {
    try {
      await save({ fullAccess: rules }).unwrap()
      toast.success('Download masking saved')
    } catch (e) {
      toast.error(parseApiError(e).message)
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-sm text-slate-700">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div>
          <p className="font-medium text-slate-800">Mobile &amp; email are masked in every download for everyone except the Super Admin.</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Masked looks like <span className="font-mono">******7630</span> / <span className="font-mono">sh******@gmail.com</span>.
            Only pick a role or a user below if they must get the full numbers in that download. Nothing picked = masked.
            The bulk-send recipients list can only be downloaded by the Super Admin.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Download</th>
              <th className="py-2 pr-4">Full contacts for roles</th>
              <th className="py-2 pr-4">Full contacts for users</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.modules.map(({ key, label }) => {
              const r = rule(key)
              const open = r.roles.length + r.users.length > 0
              return (
                <tr key={key} className="border-b border-slate-100 last:border-0" data-testid={`masking-${key}`}>
                  <td className="py-3 pr-4 font-medium text-slate-800">{label}</td>
                  <td className="py-3 pr-4">
                    <CheckboxMultiSelect
                      options={ROLE_OPTIONS}
                      value={r.roles}
                      onChange={(roles) => set(key, { roles })}
                      allLabel="No role"
                      plural="roles"
                      ariaLabel={`${label}: roles with full contacts`}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <CheckboxMultiSelect
                      options={userOptions}
                      value={r.users}
                      onChange={(ids) => set(key, { users: ids })}
                      allLabel="No user"
                      plural="users"
                      ariaLabel={`${label}: users with full contacts`}
                      searchPlaceholder="Search users…"
                    />
                  </td>
                  <td className="py-3 text-xs">
                    {open ? (
                      <span className="font-medium text-amber-700">Full for the picked roles / users</span>
                    ) : (
                      <span className="text-slate-500">Masked for everyone (except Super Admin)</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">{data.updatedAt ? `Last saved ${formatDateTime(data.updatedAt)}` : ''}</span>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" onClick={() => setRules(data.fullAccess)}>
              Undo
            </Button>
          )}
          <Button onClick={onSave} loading={isLoading} disabled={!dirty} data-testid="masking-save">
            Save
          </Button>
        </div>
      </div>
    </Card>
  )
}

/** Masters → Download Masking (Super Admin only). */
export function ExportMaskingTab() {
  const { data, isLoading, isError, error, refetch } = useExportMaskingQuery()
  if (isLoading) return <LoadingState />
  if (isError || !data) return <ErrorState error={error} message={parseApiError(error).message} onRetry={refetch} />
  // re-mounted after a save, so the form starts from what the server stored
  return <MaskingForm key={data.data.updatedAt ?? 'new'} data={data.data} />
}
