import type { ReactNode } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../lib/utils'

/** Two-or-three choice fields the doc writes as "A/B" (e.g. Fresher/Experienced). */
export function RadioGroup({
  options,
  registration,
  invalid,
}: {
  options: readonly { value: string; label: string }[] | readonly string[]
  registration: UseFormRegisterReturn
  invalid?: boolean
}) {
  const items = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div role="radiogroup" className={cn('flex flex-wrap gap-2', invalid && 'rounded-lg ring-1 ring-red-300')}>
      {items.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:disabled]:cursor-default"
        >
          <input type="radio" value={o.value} className="h-4 w-4 text-brand-600" {...registration} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  )
}

export function StepActions({
  onBack,
  saving,
  readOnly,
  submitLabel = 'Save & continue',
}: {
  onBack?: () => void
  saving?: boolean
  readOnly?: boolean
  submitLabel?: string
}) {
  return (
    <div className="flex justify-between gap-2">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
      ) : (
        <span />
      )}
      {!readOnly && (
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      )}
    </div>
  )
}
