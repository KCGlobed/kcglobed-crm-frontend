import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateLeadMutation } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/fields'
import { cn, parseApiError } from '../../lib/utils'
import type { CustomFieldDef, Lead } from '../../types/models'
import { formatCustomValue } from './leadColumns'

type Values = Record<string, unknown>

const empty = (v: unknown) => v === '' || v === null || v === undefined
/** '' / null / undefined compare equal; numbers compare by text ("12" typed vs 12 stored) */
const same = (a: unknown, b: unknown) => (empty(a) && empty(b)) || (!empty(a) && !empty(b) && String(a) === String(b))

/** The checks the backend makes (services.validate_custom_fields), run first so the form can point at the field. */
function validate(defs: CustomFieldDef[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const d of defs) {
    const v = values[d.key]
    if (empty(v)) continue
    if (d.type === 'number' && Number.isNaN(Number(v))) errors[d.key] = 'Enter a number'
    else if (d.type === 'select' && !d.options.includes(String(v))) errors[d.key] = `Choose one of: ${d.options.join(', ')}`
    else if (d.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errors[d.key] = 'Enter a date'
  }
  return errors
}

/** The shape the API stores: numbers as numbers, yes/no as booleans, cleared fields left out. */
function payload(defs: CustomFieldDef[], values: Values): Values {
  const out: Values = {}
  for (const d of defs) {
    const v = values[d.key]
    if (empty(v)) continue
    out[d.key] = d.type === 'number' ? Number(v) : d.type === 'boolean' ? v === true || v === 'true' : v
  }
  return out
}

/**
 * Additional Lead Information card (below the Counsellor Discussion): every Masters →
 * Custom field on one lead, read-only until Edit; changes stay in a local
 * draft until Save sends them in one request
 * (the backend validates each value by type and writes one History row per
 * field). Cancel drops the draft without a request. Values arrive here from
 * the lead form, the bulk upload or an earlier edit on this panel.
 */
export function CustomInformation({
  lead,
  readOnly = false,
  compact = false,
}: {
  lead: Lead
  readOnly?: boolean
  compact?: boolean
}) {
  const { data: masters } = useMasterBootstrapQuery()
  const defs = masters?.data.customFields ?? []
  const [update, { isLoading: saving }] = useUpdateLeadMutation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const saved: Values = (lead.customFields as Values | undefined) ?? {}
  const values = editing ? draft : saved
  const filled = defs.filter((d) => !empty(saved[d.key])).length
  const percent = defs.length ? Math.round((filled / defs.length) * 100) : 0
  const dirty = editing ? defs.filter((d) => !same(draft[d.key], saved[d.key])).map((d) => d.key) : []

  const startEdit = () => {
    setDraft({ ...saved })
    setErrors({})
    setFormError(null)
    setEditing(true)
  }
  const cancel = () => {
    setDraft({})
    setErrors({})
    setFormError(null)
    setEditing(false)
  }
  const change = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e))
  }

  const submit = async () => {
    if (saving) return
    const local = validate(defs, draft)
    if (Object.keys(local).length) {
      setErrors(local)
      setFormError('Fix the highlighted fields before saving')
      return
    }
    if (!dirty.length) {
      cancel() // nothing changed: back to read-only without a request
      return
    }
    try {
      await update({ id: lead._id, body: { customFields: payload(defs, draft) } }).unwrap()
      setEditing(false)
      setDraft({})
      setErrors({})
      setFormError(null)
      toast.success(`Additional lead information saved (${dirty.length} field${dirty.length === 1 ? '' : 's'})`)
    } catch (err) {
      // the draft stays as typed; the backend names fields as customFields.<key>
      const parsed = parseApiError(err)
      setErrors(Object.fromEntries(Object.entries(parsed.errors).map(([k, v]) => [k.replace(/^customFields\./, ''), v])))
      setFormError(parsed.message)
      toast.error(parsed.message)
    }
  }

  const wrapper = cn(!compact && 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm')

  if (!defs.length) {
    return (
      <div className={wrapper} data-testid="custom-information">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Additional Lead Information</h3>
        <p className="text-xs text-slate-500">
          No custom fields are defined yet. Add them in{' '}
          <Link to="/app/admin/masters" className="font-medium text-brand-700 hover:underline">
            Masters → Custom fields
          </Link>
          , or create them while mapping a{' '}
          <Link to="/app/leads/import" className="font-medium text-brand-700 hover:underline">
            bulk upload
          </Link>
          .
        </p>
      </div>
    )
  }

  const disabled = !editing || saving

  return (
    <div className={wrapper} data-testid="custom-information" data-editing={editing}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-800">Additional Lead Information</h3>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-500" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-xs text-slate-500">
              {filled} of {defs.length} filled · {percent}%
            </span>
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                {dirty.length > 0 && (
                  <span className="text-[11px] text-amber-700">
                    {dirty.length} unsaved change{dirty.length === 1 ? '' : 's'}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={submit} loading={saving}>
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        )}
      </div>
      {formError && (
        <p role="alert" className="mb-2 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700">
          {formError}
        </p>
      )}
      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3')}>
        {defs.map((d) => {
          const value = values[d.key]
          const err = errors[d.key]
          return (
            <div key={d.key} className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                {d.label}
              </label>
              {!editing ? (
                <p
                  className={cn(
                    'min-h-9 rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-sm',
                    empty(value) ? 'text-slate-400' : 'text-slate-800'
                  )}
                  data-testid={`custom-value-${d.key}`}
                >
                  {formatCustomValue(value, d) ?? '—'}
                </p>
              ) : d.type === 'select' ? (
                <Select disabled={disabled} aria-invalid={!!err} value={(value as string) ?? ''} onChange={(e) => change(d.key, e.target.value || null)}>
                  <option value="">—</option>
                  {d.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : d.type === 'boolean' ? (
                <Select
                  disabled={disabled}
                  aria-invalid={!!err}
                  value={value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''}
                  onChange={(e) => change(d.key, e.target.value === '' ? null : e.target.value === 'true')}
                >
                  <option value="">—</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              ) : (
                <Input
                  disabled={disabled}
                  aria-invalid={!!err}
                  type={d.type === 'number' ? 'number' : d.type === 'date' ? 'date' : 'text'}
                  value={(value as string | number | undefined) ?? ''}
                  onChange={(e) => change(d.key, e.target.value)}
                />
              )}
              {err && <p className="text-[11px] font-medium text-red-600">{err}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
