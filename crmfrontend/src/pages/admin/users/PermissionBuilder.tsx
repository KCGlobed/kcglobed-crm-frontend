import { ACTIONS, DATA_SCOPES, MODULES } from '../../../constants/permissions'
import type {
  ActionKey,
  DataScope,
  FieldRule,
  ModuleKey,
  ModulePermission,
  PermissionTemplate,
} from '../../../types/models'
import { Checkbox, FormField, Input, Select } from '../../../components/ui/fields'
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
}

const SUGGESTED_FIELDS = ['mobile', 'email', 'altMobile']

/**
 * The SOW's plug-and-play access builder: pick a template (a saved tick-set),
 * then adjust modules → actions → data scope → field visibility per user.
 */
export function PermissionBuilder({ value, onChange, templates }: Props) {
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
    onChange({ ...value, fieldRules })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start from template" hint="Templates are saved tick-sets — editing after applying detaches it">
          <Select value={value.templateKey ?? ''} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">Custom / start blank</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Data scope" hint={DATA_SCOPES.find((s) => s.key === value.dataScope)?.hint}>
          <Select
            value={value.dataScope}
            onChange={(e) => onChange({ ...value, dataScope: e.target.value as DataScope })}
          >
            {DATA_SCOPES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Modules & actions
        </p>
        <p className="mb-2 text-[11px] text-slate-400">
          Unticked modules are hidden from this user's menu entirely.
        </p>
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
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Field visibility (data masking)
        </p>
        <div className="space-y-2">
          {value.fieldRules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="!h-8 flex-1"
                value={rule.field}
                placeholder="Field, e.g. mobile"
                onChange={(e) => setRule(i, { field: e.target.value })}
                list="field-suggestions"
              />
              <Select
                className="!h-8 !w-32"
                value={rule.mode}
                onChange={(e) => setRule(i, { mode: e.target.value as FieldRule['mode'] })}
              >
                <option value="masked">Masked</option>
                <option value="hidden">Hidden</option>
                <option value="readonly">Read-only</option>
              </Select>
              <button
                type="button"
                onClick={() =>
                  onChange({ ...value, fieldRules: value.fieldRules.filter((_, idx) => idx !== i) })
                }
                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <datalist id="field-suggestions">
            {SUGGESTED_FIELDS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ ...value, fieldRules: [...value.fieldRules, { field: '', mode: 'masked' }] })
            }
          >
            Add field rule
          </Button>
        </div>
      </div>
    </div>
  )
}
