import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Checkbox, Input, Textarea } from '../../components/ui/fields'
import type { SubStage } from '../../types/models'

export type SubStageDraft = Partial<Pick<SubStage, '_id'>> & Pick<SubStage, 'name' | 'counsellorAction' | 'isActive'>

/**
 * Sub-stages of a lead stage with the counsellor action for each (Lead Stages sheet).
 * Saved sub-stages keep their _id — leads point at it — so they are deactivated, not removed.
 */
export function SubStagesEditor({
  value,
  onChange,
  errors,
}: {
  value: SubStageDraft[]
  onChange: (next: SubStageDraft[]) => void
  errors: Record<string, string>
}) {
  const update = (i: number, patch: Partial<SubStageDraft>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const move = (i: number, by: -1 | 1) => {
    const next = [...value]
    const [item] = next.splice(i, 1)
    next.splice(i + by, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-xs text-slate-400">No sub-stages. Leads in this stage need none.</p>}
      {value.map((s, i) => (
        <div key={s._id ?? `new-${i}`} className="rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center gap-2">
            <span className="w-5 text-right text-[11px] tabular-nums text-slate-400">{i + 1}</span>
            <Input
              value={s.name}
              placeholder="Sub-stage name"
              aria-invalid={!!errors[`subStages.${i}.name`]}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-600">
              <Checkbox checked={s.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} /> Active
            </label>
            <Button type="button" variant="ghost" size="sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            {!s._id && (
              <Button type="button" variant="ghost" size="sm" aria-label="Remove" className="text-red-600" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {errors[`subStages.${i}.name`] && <p className="ml-7 mt-1 text-[11px] text-red-600">{errors[`subStages.${i}.name`]}</p>}
          <Textarea
            rows={2}
            className="ml-7 mt-2 w-[calc(100%-1.75rem)] text-xs"
            placeholder="Counsellor action"
            value={s.counsellorAction ?? ''}
            onChange={(e) => update(i, { counsellorAction: e.target.value })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...value, { name: '', counsellorAction: '', isActive: true }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add sub-stage
      </Button>
    </div>
  )
}
