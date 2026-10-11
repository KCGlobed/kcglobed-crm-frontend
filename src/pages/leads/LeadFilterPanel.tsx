import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { Input, Select } from '../../components/ui/fields'
import type { FilterCondition, FilterField } from '../../types/models'

const OP_LABELS: Record<string, string> = {
  is: 'Is',
  is_not: 'Is Not',
  any_of: 'Any Of',
  none_of: 'None Of',
  contains: 'Contains',
  empty: 'Is Empty',
  not_empty: 'Is Not Empty',
  before: 'Before',
  after: 'After',
  between: 'Between',
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 Days',
  this_month: 'This Month',
  eq: '=',
  gte: '≥',
  lte: '≤',
}
const NO_VALUE = new Set(['empty', 'not_empty', 'today', 'yesterday', 'last_7_days', 'this_month'])
/** Field types whose values come from a list; with nothing to list, the condition cannot be built. */
const LISTED_TYPES = new Set(['fk', 'choice', 'optout'])
const noValues = (field: FilterField | undefined, op: string) => !!field && LISTED_TYPES.has(field.type) && !field.options?.length && !NO_VALUE.has(op)

function ValueInput({ field, cond, onChange }: { field?: FilterField; cond: FilterCondition; onChange: (v: FilterCondition['value']) => void }) {
  if (!field || NO_VALUE.has(cond.op)) return <span className="text-xs text-slate-400">—</span>
  if (noValues(field, cond.op)) {
    return (
      <Select value="" disabled title="Nothing to choose from yet for this field">
        <option value="">No Values Available</option>
      </Select>
    )
  }
  if (cond.op === 'between') {
    const [low, high] = Array.isArray(cond.value) ? cond.value : ['', '']
    const type = field.type === 'date' ? 'date' : 'number'
    return (
      <div className="flex gap-1">
        <Input type={type} value={low ?? ''} onChange={(e) => onChange([e.target.value, high ?? ''])} />
        <Input type={type} value={high ?? ''} onChange={(e) => onChange([low ?? '', e.target.value])} />
      </div>
    )
  }
  if (field.options?.length) {
    if (cond.op === 'any_of' || cond.op === 'none_of') {
      const values = Array.isArray(cond.value) ? cond.value : []
      return (
        <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
          {field.options.map((o) => (
            <label key={o.value} className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...values, o.value] : values.filter((v) => v !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </div>
      )
    }
    return (
      <Select value={(cond.value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }
  return (
    <Input
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={(cond.value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * GL-34 filter panel: any lead, profile or counsellor field with operators by
 * type. All conditions must match. Stored in the URL as `filters` JSON.
 */
export function LeadFilterPanel({
  open,
  onClose,
  fields,
  value,
  onApply,
}: {
  open: boolean
  onClose: () => void
  fields: FilterField[]
  value: FilterCondition[]
  onApply: (conditions: FilterCondition[]) => void
}) {
  const [rows, setRows] = useState<FilterCondition[]>(value.length ? value : [])
  const byKey = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields])
  const groups = useMemo(() => [...new Set(fields.map((f) => f.group))], [fields])

  const update = (i: number, patch: Partial<FilterCondition>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  const complete = rows.filter((r) => {
    if (!r.field || !r.op) return false
    if (NO_VALUE.has(r.op)) return true
    if (noValues(byKey[r.field], r.op)) return false
    if (Array.isArray(r.value)) return r.value.length > 0 && r.value.every((v) => v !== '')
    return r.value !== undefined && r.value !== ''
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Filter Leads"
      description="Every condition must match. Operators change with the field type."
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => setRows([])}>
            Clear All
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(complete)
              onClose()
            }}
          >
            Apply {complete.length ? `(${complete.length})` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-slate-500">No conditions yet — add one below.</p>}
        {rows.map((row, i) => {
          const field = byKey[row.field]
          return (
            <div key={i} className="grid grid-cols-[1.4fr_0.8fr_1.4fr_auto] items-start gap-2 rounded-lg border border-slate-200 p-2">
              <Select
                value={row.field}
                onChange={(e) => {
                  const f = byKey[e.target.value]
                  update(i, { field: e.target.value, op: f?.ops[0] ?? 'is', value: undefined })
                }}
              >
                <option value="">Field…</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {fields
                      .filter((f) => f.group === g)
                      .map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              <Select value={row.op} onChange={(e) => update(i, { op: e.target.value, value: undefined })} disabled={!field}>
                {(field?.ops ?? ['is']).map((op) => (
                  <option key={op} value={op}>
                    {OP_LABELS[op] ?? op}
                  </option>
                ))}
              </Select>
              <ValueInput field={field} cond={row} onChange={(v) => update(i, { value: v })} />
              <Button variant="ghost" size="sm" onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        })}
        <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { field: '', op: 'is' }])}>
          <Plus className="h-3.5 w-3.5" /> Add Condition
        </Button>
      </div>
    </Drawer>
  )
}
