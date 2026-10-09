import { ACTIONS, DATA_SCOPES, MODULES } from '../../../constants/permissions'
import type { ActionKey, DataScope, FieldRule, ModuleKey, ModulePermission, PermissionTemplate } from '../../../types/models'
import { Checkbox, FormField, Select } from '../../../components/ui/fields'
import { Button } from '../../../components/ui/Button'
import { Trash2 } from 'lucide-react'

export interface PermissionState {
  permissions: ModulePermission[]
  dataScope: DataScope
  fieldRules: FieldRule[]
  templateKey?: string
}

interface Props {
  value: PermissionState
  onChange: (next: PermissionState) => void
  templates: PermissionTemplate[]
  /** false in the template editor itself */
  showTemplatePicker?: boolean
}

/**
 * Lead fields a rule can mask/hide — the backend applies rules to these API
 * keys on every lead it returns (common/masking.py). Mobile/email get a
 * partial mask (98•••••210, r•••@gmail.com), everything else becomes "****";
 * hidden removes the field entirely, read-only blocks edits.
 */
const MASKABLE_FIELDS: { value: string; label: string; group: string }[] = [
  { value: 'mobile', label: 'Mobile', group: 'Contact' },
  { value: 'altMobile', label: 'Alternate mobile', group: 'Contact' },
  { value: 'email', label: 'Email', group: 'Contact' },
  { value: 'firstName', label: 'First name', group: 'Identity' },
  { value: 'lastName', label: 'Last name', group: 'Identity' },
  { value: 'city', label: 'City', group: 'Location' },
  { value: 'state', label: 'State', group: 'Location' },
  { value: 'country', label: 'Country', group: 'Location' },
  { value: 'source', label: 'Latest source', group: 'Attribution' },
  { value: 'firstSource', label: 'First source', group: 'Attribution' },
  { value: 'utm', label: 'UTM parameters', group: 'Attribution' },
  { value: 'referral', label: 'Referral details', group: 'Attribution' },
  { value: 'createdVia', label: 'Created via', group: 'Attribution' },
  { value: 'programInterest', label: 'Program interest', group: 'Lead data' },
  { value: 'cohort', label: 'Cohort', group: 'Lead data' },
  { value: 'score', label: 'Lead score', group: 'Lead data' },
  { value: 'lastDisposition', label: 'Last disposition', group: 'Lead data' },
  { value: 'customFields', label: 'Custom fields', group: 'Lead data' },
]
const FIELD_GROUPS = [...new Set(MASKABLE_FIELDS.map((f) => f.group))]

/**
 * The SOW's plug-and-play access builder: pick a template (a saved tick-set),
 * then adjust modules → actions → data scope → field visibility per user.
 */
export function PermissionBuilder({ value, onChange, templates, showTemplatePicker = true }: Props) {
  const has = (module: ModuleKey, action: ActionKey) =>
    value.permissions.find((p) => p.module === module)?.actions.includes(action) ?? false

  const toggle = (module: ModuleKey, action: ActionKey) => {
    const existing = value.permissions.find((p) => p.module === module)
    let permissions: ModulePermission[]
    if (!existing) {
      // First tick on a module implies view so the module is actually usable.
      const actions: ActionKey[] = action === 'view' ? ['view'] : ['view', action]
      permissions = [...value.permissions, { module, actions }]
    } else {
      let actions = existing.actions.includes(action)
        ? existing.actions.filter((a) => a !== action)
        : [...existing.actions, action]
      if (action === 'view' && !actions.includes('view')) {
        actions = [] // removing view removes the module entirely
      }
      permissions = actions.length
        ? value.permissions.map((p) => (p.module === module ? { ...p, actions } : p))
        : value.permissions.filter((p) => p.module !== module)
    }
    onChange({ ...value, permissions, templateKey: undefined })
  }

  const applyTemplate = (key: string) => {
    if (!key) return
    const template = templates.find((t) => t.key === key)
    if (!template) return
    onChange({
      permissions: template.permissions.map((p) => ({ ...p, actions: [...p.actions] })),
      dataScope: template.dataScope,
      fieldRules: template.fieldRules.map((r) => ({ ...r })),
      templateKey: template.key,
    })
  }

  const setRule = (index: number, patch: Partial<FieldRule>) => {
    const fieldRules = value.fieldRules.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange({ ...value, fieldRules, templateKey: undefined })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {showTemplatePicker && (
          <FormField label="Start from template" hint="The user follows the template — later template edits update them too. Changing any tick here detaches it.">
            <Select value={value.templateKey ?? ''} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">Custom / start blank</option>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Data scope" hint={DATA_SCOPES.find((s) => s.key === value.dataScope)?.hint}>
          <Select value={value.dataScope} onChange={(e) => onChange({ ...value, dataScope: e.target.value as DataScope, templateKey: undefined })}>
            {DATA_SCOPES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
            {/* a scope this user/template already has but which is no longer offered (e.g. 'all') — shown so it is not lost on save */}
            {!DATA_SCOPES.some((s) => s.key === value.dataScope) && <option value={value.dataScope}>{value.dataScope} (current)</option>}
          </Select>
        </FormField>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Modules & actions</p>
        <p className="mb-2 text-[11px] text-slate-400">Unticked modules are hidden from this user's menu entirely.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Module</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="px-2 py-2 text-center font-semibold">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODULES.map((m) => (
                <tr key={m.key} className={!m.slice1 ? 'opacity-60' : undefined}>
                  <td className="px-3 py-1.5 font-medium text-slate-700">
                    {m.label}
                    {!m.slice1 && <span className="ml-1 text-[9px] text-slate-400">(upcoming)</span>}
                  </td>
                  {ACTIONS.map((a) => (
                    <td key={a.key} className="px-2 py-1.5 text-center">
                      <Checkbox checked={has(m.key, a.key)} onChange={() => toggle(m.key, a.key)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Field visibility (data masking)</p>
        <div className="space-y-2">
          {value.fieldRules.map((rule, i) => {
            const usedElsewhere = new Set(value.fieldRules.filter((_, idx) => idx !== i).map((r) => r.field))
            return (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_7.5rem_2rem] items-center gap-2">
                <Select
                  className="min-w-0"
                  value={rule.field}
                  onChange={(e) => setRule(i, { field: e.target.value })}
                >
                  <option value="">Choose field…</option>
                  {FIELD_GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {MASKABLE_FIELDS.filter((f) => f.group === g).map((f) => (
                        <option key={f.value} value={f.value} disabled={usedElsewhere.has(f.value)}>
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  {/* a saved rule on a field not in the list (e.g. hand-set earlier) stays selectable so it is kept on save */}
                  {!!rule.field && !MASKABLE_FIELDS.some((f) => f.value === rule.field) && (
                    <option value={rule.field}>{rule.field} (current)</option>
                  )}
                </Select>
                <Select
                  value={rule.mode}
                  onChange={(e) => setRule(i, { mode: e.target.value as FieldRule['mode'] })}
                >
                  <option value="masked">Masked</option>
                  <option value="hidden">Hidden</option>
                  <option value="readonly">Read-only</option>
                </Select>
                <button
                  type="button"
                  aria-label="Remove field rule"
                  onClick={() => onChange({ ...value, fieldRules: value.fieldRules.filter((_, idx) => idx !== i), templateKey: undefined })}
                  className="flex h-9 w-8 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...value, fieldRules: [...value.fieldRules, { field: '', mode: 'masked' }], templateKey: undefined })}
          >
            Add field rule
          </Button>
        </div>
      </div>
    </div>
  )
}
