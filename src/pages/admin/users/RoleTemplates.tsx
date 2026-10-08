import { useState } from 'react'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useListTemplatesQuery,
  useUpdateTemplateMutation,
} from '../../../services/adminApi'
import { DATA_SCOPES, MODULES } from '../../../constants/permissions'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Drawer } from '../../../components/ui/Drawer'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { ConfirmDialog } from '../../../components/ui/feedback'
import { FieldGroup, FormField, Input, Textarea } from '../../../components/ui/fields'
import { RowActions } from '../../../components/ui/RowActions'
import { parseApiError } from '../../../lib/utils'
import type { PermissionTemplate } from '../../../types/models'
import { PermissionBuilder, type PermissionState } from './PermissionBuilder'
import { MenuPreview } from './MenuPreview'

const scopeLabel = (key: string) => DATA_SCOPES.find((s) => s.key === key)?.label ?? key
const moduleLabel = (key: string) => MODULES.find((m) => m.key === key)?.label ?? key

/**
 * The template key is not typed in: it is derived from the name on create and
 * sent to the backend as before. "Senior Counsellor (copy)" → "senior-counsellor-copy".
 */
const keyFromName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

/** Create / edit a role template: name, description and its tick-set. */
function TemplateDrawer({ template, copyOf, onClose }: { template?: PermissionTemplate; copyOf?: PermissionTemplate; onClose: () => void }) {
  const source = template ?? copyOf
  const [name, setName] = useState(template?.name ?? (copyOf ? `${copyOf.name} (copy)` : ''))
  const [description, setDescription] = useState(source?.description ?? '')
  const [perms, setPerms] = useState<PermissionState>(() => ({
    permissions: source ? source.permissions.map((p) => ({ ...p, actions: [...p.actions] })) : [],
    dataScope: source?.dataScope ?? 'own',
    fieldRules: source ? source.fieldRules.map((r) => ({ ...r })) : [],
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [create, { isLoading: creating }] = useCreateTemplateMutation()
  const [update, { isLoading: updating }] = useUpdateTemplateMutation()

  const onSave = async () => {
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      permissions: perms.permissions,
      dataScope: perms.dataScope,
      fieldRules: perms.fieldRules.filter((r) => r.field.trim()),
    }
    try {
      if (template) {
        const res = await update({ id: template._id, body }).unwrap()
        toast.success(res.message)
      } else {
        await create({ ...body, key: keyFromName(name) }).unwrap()
        toast.success('Template created')
      }
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={template ? `Edit template · ${template.name}` : 'New role template'}
      description={
        template?.roleLabel
          ? `Drives the ${template.roleLabel} role. Saving applies these ticks to all ${template.userCount ?? 0} user(s) following it.`
          : template
            ? `Saving applies these ticks to all ${template.userCount ?? 0} user(s) following this template.`
            : 'A saved tick-set of modules, actions, data scope and masked fields. Users who get this template follow it — later edits update them too.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={creating || updating} disabled={!name.trim() || (!template && !keyFromName(name))}>
            {template ? 'Save template' : 'Create template'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <FieldGroup title="Template">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* a duplicate-key error from the backend means a template with this name already exists */}
            <FormField
              label="Name"
              required
              error={errors.name ?? errors.key}
              className="sm:col-span-2"
              hint={template ? `Key: ${template.key} (cannot change)` : name.trim() ? `Key: ${keyFromName(name)}` : 'The key is generated from the name'}
            >
              <Input value={name} maxLength={100} placeholder="e.g. Senior Counsellor" onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Description" error={errors.description} className="sm:col-span-2">
              <Textarea rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
          </div>
        </FieldGroup>
        <FieldGroup title="Access">
          <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
            <div className="min-w-0 overflow-x-auto">
              <PermissionBuilder value={perms} onChange={setPerms} templates={[]} showTemplatePicker={false} />
            </div>
            <MenuPreview permissions={perms.permissions} />
          </div>
        </FieldGroup>
      </div>
    </Drawer>
  )
}

/**
 * SOW Admin #2/#3 — default role templates (Counsellor, Team Leader, Marketing,
 * Finance …) and custom roles built by ticking modules, actions and data scope.
 * System templates can be edited but not deleted.
 */
export function RoleTemplates() {
  const { data, isLoading, isError, error, refetch } = useListTemplatesQuery()
  const [remove, { isLoading: removing }] = useDeleteTemplateMutation()
  const [editing, setEditing] = useState<{ template?: PermissionTemplate; copyOf?: PermissionTemplate } | null>(null)
  const [confirm, setConfirm] = useState<PermissionTemplate | null>(null)

  const columns: Column<PermissionTemplate>[] = [
    {
      key: 'name',
      header: 'Template',
      render: (t) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            {t.name} {t.roleLabel ? <Badge tone="green">Role: {t.roleLabel}</Badge> : t.isSystem && <Badge tone="blue">Default</Badge>}
          </p>
          <p className="max-w-80 truncate text-[11px] text-slate-500" title={t.description}>
            {t.description || t.key}
          </p>
        </div>
      ),
    },
    {
      key: 'modules',
      header: 'Modules',
      render: (t) => (
        <span className="block max-w-72 truncate text-xs text-slate-600" title={t.permissions.map((p) => `${moduleLabel(p.module)}: ${p.actions.join(', ')}`).join('\n')}>
          {t.permissions.map((p) => moduleLabel(p.module)).join(', ') || '—'}
        </span>
      ),
    },
    { key: 'userCount', header: 'Users', render: (t) => <span className="text-xs tabular-nums text-slate-600">{t.userCount ?? 0}</span> },
    { key: 'dataScope', header: 'Data scope', render: (t) => <Badge>{scopeLabel(t.dataScope)}</Badge> },
    {
      key: 'fieldRules',
      header: 'Masked fields',
      render: (t) => <span className="text-xs text-slate-600">{t.fieldRules.map((r) => `${r.field} (${r.mode})`).join(', ') || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      align: 'right',
      render: (t) => (
        <RowActions
          label={`Actions for ${t.name}`}
          actions={[
            { label: 'Edit', icon: Pencil, onClick: () => setEditing({ template: t }) },
            { label: 'Duplicate', icon: Copy, onClick: () => setEditing({ copyOf: t }) },
            { label: 'Delete', icon: Trash2, danger: true, hidden: t.isSystem, onClick: () => setConfirm(t) },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Users set up from a template <b>follow it</b>: editing a template updates every user on it. Admin and Admission Counsellor take their access from their role templates. Changing a single user's ticks makes that user custom access.
        </p>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus className="h-3.5 w-3.5" /> New Role
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(t) => t._id}
        loading={isLoading}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        errorDetail={error}
        onRetry={refetch}
        emptyTitle="No role templates"
        onRowClick={(t) => setEditing({ template: t })}
      />
      {editing && <TemplateDrawer key={editing.template?._id ?? editing.copyOf?._id ?? 'new'} {...editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          try {
            await remove(confirm!._id).unwrap()
            toast.success('Template deleted')
            setConfirm(null)
          } catch (err) {
            toast.error(parseApiError(err).message)
          }
        }}
        title="Delete template"
        message={`Delete "${confirm?.name}"? Its ${confirm?.userCount ?? 0} user(s) keep their current access as custom access.`}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </>
  )
}
