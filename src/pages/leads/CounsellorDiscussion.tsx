import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useLeadDiscussionQuery, useSaveLeadDiscussionMutation } from '../../services/leadsApi'
import { Input, Select, Textarea } from '../../components/ui/fields'
import { ErrorState, Skeleton } from '../../components/ui/feedback'
import { cn, parseApiError } from '../../lib/utils'
import type { DiscussionFieldMeta } from '../../types/models'

type Values = Record<string, unknown>

function visible(field: DiscussionFieldMeta, values: Values): boolean {
  return !field.showIf || values[field.showIf.field] === field.showIf.value
}

/**
 * GL-15 Counsellor Discussion: the 27 internal fields. Every field autosaves
 * (choices at once, text after a pause) and every change lands in History.
 * Hiding a child (e.g. Working → Fresher) clears it on save.
 */
export function CounsellorDiscussion({ leadId, compact = false, readOnly = false }: { leadId: string; compact?: boolean; readOnly?: boolean }) {
  const { data, isLoading, isError, error, refetch } = useLeadDiscussionQuery(leadId)
  const [save] = useSaveLeadDiscussionMutation()
  const [values, setValues] = useState<Values>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const timers = useRef<Record<string, number>>({})
  // fields typed but not saved yet — a save of another field must not overwrite them
  const pending = useRef<Set<string>>(new Set())
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const server = data?.data
  if (server && loadedFor !== leadId) {
    setLoadedFor(leadId)
    setValues(server.data)
  }

  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearTimeout(t)), [])

  const commit = async (key: string, value: unknown) => {
    setStatus('saving')
    try {
      const res = await save({ id: leadId, changes: { [key]: value === '' ? null : value } }).unwrap()
      pending.current.delete(key)
      setValues((v) => {
        const next = { ...res.data.data }
        pending.current.forEach((k) => (next[k] = v[k]))
        return next
      })
      setErrors((e) => ({ ...e, [key]: '' }))
      setStatus('saved')
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors((e) => ({ ...e, [key]: Object.values(parsed.errors)[0] ?? parsed.message }))
      setStatus('idle')
    }
  }

  const change = (field: DiscussionFieldMeta, value: unknown, debounce: boolean) => {
    setValues((v) => ({ ...v, [field.key]: value }))
    window.clearTimeout(timers.current[field.key])
    pending.current.add(field.key)
    if (debounce) timers.current[field.key] = window.setTimeout(() => commit(field.key, value), 700)
    else commit(field.key, value)
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError || !server) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />

  const fields = server.fields.filter((f) => visible(f, values))
  const missing = server.fields.filter((f) => f.requiredIfShown && visible(f, values) && !values[f.key])

  return (
    <div className={cn(!compact && 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-500" style={{ width: `${server.completionPercent}%` }} />
          </div>
          <span className="text-xs text-slate-500">{server.completionPercent}% complete · internal only</span>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-slate-400">
          {status === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          )}
          {status === 'saved' && (
            <>
              <Check className="h-3 w-3 text-emerald-600" /> Saved
            </>
          )}
        </span>
      </div>
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
                <Select disabled={readOnly} value={(value as string) ?? ''} onChange={(e) => change(f, e.target.value || null, false)}>
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              )}
              {(f.type === 'text' || f.type === 'number') && (
                <Input
                  disabled={readOnly}
                  type={f.type === 'number' ? 'number' : 'text'}
                  min={f.min ?? undefined}
                  max={f.type === 'number' ? f.max ?? undefined : undefined}
                  maxLength={f.type === 'text' ? f.max ?? undefined : undefined}
                  value={(value as string | number | undefined) ?? ''}
                  onChange={(e) => change(f, f.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value, true)}
                />
              )}
              {f.type === 'textarea' && (
                <Textarea
                  disabled={readOnly}
                  rows={compact ? 2 : 3}
                  maxLength={f.max ?? undefined}
                  value={(value as string) ?? ''}
                  onChange={(e) => change(f, e.target.value, true)}
                />
              )}
              {f.type === 'name_relation' && (
                <div className="grid grid-cols-[1fr_auto] gap-1">
                  <Input
                    disabled={readOnly}
                    placeholder="Name"
                    value={((value as { name?: string }) ?? {}).name ?? ''}
                    onChange={(e) => change(f, { ...((value as object) ?? {}), name: e.target.value }, true)}
                  />
                  <Select
                    disabled={readOnly}
                    className="!w-32"
                    value={((value as { relation?: string }) ?? {}).relation ?? ''}
                    onChange={(e) => change(f, { ...((value as object) ?? {}), relation: e.target.value || null }, false)}
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
