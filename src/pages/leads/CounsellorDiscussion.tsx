import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useLeadDiscussionQuery, useSaveLeadDiscussionMutation } from '../../services/leadsApi'
import { Button } from '../../components/ui/Button'
import { Input, Select, Textarea } from '../../components/ui/fields'
import { ErrorState, Skeleton } from '../../components/ui/feedback'
import { cn, parseApiError } from '../../lib/utils'
import type { DiscussionFieldMeta } from '../../types/models'

type Values = Record<string, unknown>

const NAME_RE = /^[A-Za-z][A-Za-z .']*$/

function visible(field: DiscussionFieldMeta, values: Values): boolean {
  return !field.showIf || values[field.showIf.field] === field.showIf.value
}

/** '' / null / undefined and {} are all "empty", so a cleared field compares equal to one never filled. */
function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => {
    if (v === '' || v === null || v === undefined) return null
    if (typeof v === 'object') {
      const o = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== '' && x !== null && x !== undefined))
      return Object.keys(o).length ? JSON.stringify(o) : null
    }
    return typeof v === 'number' ? String(v) : v
  }
  return norm(a) === norm(b)
}

/** The checks the backend makes, run first so the form can point at the field. */
function validate(fields: DiscussionFieldMeta[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const v = values[f.key]
    if (v === '' || v === null || v === undefined) continue
    if (f.type === 'number') {
      const n = Number(v)
      if (Number.isNaN(n)) errors[f.key] = 'Enter a number'
      else if (f.integer && !Number.isInteger(n)) errors[f.key] = 'Enter a whole number'
      else if (n < (f.min ?? 0) || n > (f.max ?? Number.MAX_SAFE_INTEGER)) errors[f.key] = `Must be between ${f.min ?? 0} and ${f.max}`
    } else if ((f.type === 'text' || f.type === 'textarea') && f.max && String(v).length > f.max) {
      errors[f.key] = `Max ${f.max} characters`
    } else if (f.type === 'name_relation') {
      const name = ((v as { name?: string }).name ?? '').trim()
      if (name && (name.length > 60 || !NAME_RE.test(name))) errors[f.key] = 'Letters and spaces only, max 60'
    }
  }
  const family = Number(values.familySize), earning = Number(values.earningMembers)
  if (values.familySize && values.earningMembers && earning > family) errors.earningMembers = 'Cannot be more than Family Size'
  return errors
}

/**
 * GL-15 Counsellor Discussion: the 27 internal fields. Read-only until Edit;
 * changes stay in a local draft until Save sends them in one request (the
 * backend records every change in History and refreshes the Lead Score).
 * Cancel drops the draft without a request. Hiding a child (e.g. Working →
 * Fresher) clears it on save.
 */
export function CounsellorDiscussion({ leadId, compact = false, readOnly = false }: { leadId: string; compact?: boolean; readOnly?: boolean }) {
  const { data, isLoading, isError, error, refetch } = useLeadDiscussionQuery(leadId)
  const [save, { isLoading: saving }] = useSaveLeadDiscussionMutation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const server = data?.data
  const saved: Values = server?.data ?? {}
  const values = editing ? draft : saved

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
  const change = (field: DiscussionFieldMeta, value: unknown) => {
    setDraft((d) => ({ ...d, [field.key]: value }))
    setErrors((e) => (e[field.key] ? { ...e, [field.key]: '' } : e))
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError || !server) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />

  const fields = server.fields.filter((f) => visible(f, values))
  const missing = server.fields.filter((f) => f.requiredIfShown && visible(f, values) && !values[f.key])
  const dirtyKeys = editing ? server.fields.map((f) => f.key).filter((k) => !same(draft[k], saved[k])) : []
  const canEdit = !readOnly

  const submit = async () => {
    if (saving) return
    const local = validate(fields, draft)
    if (Object.keys(local).length) {
      setErrors(local)
      setFormError('Fix the highlighted fields before saving')
      return
    }
    if (!dirtyKeys.length) {
      cancel() // nothing changed: back to read-only without a request
      return
    }
    const changes = Object.fromEntries(dirtyKeys.map((k) => [k, draft[k] === '' || draft[k] === undefined ? null : draft[k]]))
    try {
      const res = await save({ id: leadId, changes }).unwrap()
      setEditing(false)
      setDraft({})
      setErrors({})
      setFormError(null)
      toast.success(`Counsellor discussion saved (${res.data.changed?.length ?? dirtyKeys.length} field${(res.data.changed?.length ?? dirtyKeys.length) === 1 ? '' : 's'})`)
    } catch (err) {
      // the draft stays as typed; the error points at the field when the backend named one
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      setFormError(parsed.message)
      toast.error(parsed.message)
    }
  }

  const disabled = !editing || saving

  return (
    <div className={cn(!compact && 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm')} data-testid="counsellor-discussion" data-editing={editing}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-500" style={{ width: `${server.completionPercent}%` }} />
          </div>
          <span className="text-xs text-slate-500">{server.completionPercent}% complete · internal only</span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                {dirtyKeys.length > 0 && <span className="text-[11px] text-amber-700">{dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? '' : 's'}</span>}
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
      {missing.length > 0 && (
        <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Details needed: {missing.map((m) => m.label).join(', ')}
        </p>
      )}
      <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        {fields.map((f) => {
          const value = values[f.key]
          const err = errors[f.key]
          return (
            <div key={f.key} className={cn('space-y-1', f.type === 'textarea' && !compact && 'sm:col-span-2', f.showIf && 'border-l-2 border-brand-100 pl-2')}>
              <label className="block text-xs font-medium text-slate-600">
                <span className="text-slate-400">{Number.isInteger(f.no) ? `${f.no}. ` : ''}</span>
                {f.label}
                {f.sharedWithProfile && <span className="ml-1 text-[10px] text-sky-600">(same as student profile)</span>}
                {f.requiredIfShown && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {f.type === 'choice' && (
                <Select disabled={disabled} aria-invalid={!!err} value={(value as string) ?? ''} onChange={(e) => change(f, e.target.value || null)}>
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              )}
              {(f.type === 'text' || f.type === 'number') && (
                <Input
                  disabled={disabled}
                  aria-invalid={!!err}
                  type={f.type === 'number' ? 'number' : 'text'}
                  min={f.min ?? undefined}
                  max={f.type === 'number' ? f.max ?? undefined : undefined}
                  maxLength={f.type === 'text' ? f.max ?? undefined : undefined}
                  value={(value as string | number | undefined) ?? ''}
                  onChange={(e) => change(f, f.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)}
                />
              )}
              {f.type === 'textarea' && (
                <Textarea
                  disabled={disabled}
                  aria-invalid={!!err}
                  rows={compact ? 2 : 3}
                  maxLength={f.max ?? undefined}
                  value={(value as string) ?? ''}
                  onChange={(e) => change(f, e.target.value)}
                />
              )}
              {f.type === 'name_relation' && (
                <div className="grid grid-cols-[1fr_auto] gap-1">
                  <Input
                    disabled={disabled}
                    aria-invalid={!!err}
                    placeholder="Name"
                    value={((value as { name?: string }) ?? {}).name ?? ''}
                    onChange={(e) => change(f, { ...((value as object) ?? {}), name: e.target.value })}
                  />
                  <Select
                    disabled={disabled}
                    className="!w-32"
                    value={((value as { relation?: string }) ?? {}).relation ?? ''}
                    onChange={(e) => change(f, { ...((value as object) ?? {}), relation: e.target.value || null })}
                  >
                    <option value="">Relation</option>
                    {f.options?.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                </div>
              )}
              {err && <p className="text-[11px] font-medium text-red-600">{err}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
