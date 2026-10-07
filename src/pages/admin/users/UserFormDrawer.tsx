import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  useCreateUserMutation,
  useListTemplatesQuery,
  useSetUserPermissionsMutation,
  useTeamOptionsQuery,
  useUpdateUserMutation,
  useUserOptionsQuery,
} from '../../../services/adminApi'
import { useCurrentUser } from '../../../app/hooks'
import { Drawer } from '../../../components/ui/Drawer'
import { Button } from '../../../components/ui/Button'
import { Checkbox, FieldGroup, FormField, Input, Select } from '../../../components/ui/fields'
import { parseApiError } from '../../../lib/utils'
import type { RoleKey, User } from '../../../types/models'
import { PermissionBuilder, type PermissionState } from './PermissionBuilder'
import { MenuPreview } from './MenuPreview'

// GL-01 rules for the profile; GL-02 password rules when a password is set by hand
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(60, 'Max 60 characters')
    .regex(/^[A-Za-z][A-Za-z ]*$/, 'Letters and spaces only'),
  email: z.email('Enter a valid email'),
  designation: z.string().trim().min(1, 'Designation is required').max(60, 'Max 60 characters'),
  mobile: z
    .string()
    .trim()
    .regex(/^(\d{10})?$/, 'Mobile must be 10 digits')
    .optional(),
  password: z
    .string()
    .optional()
    .refine((v) => !v || (v.length >= 8 && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v)), {
      message: 'Min 8 characters with an upper-case letter, a number and a symbol',
    }),
  team: z.string().optional(),
  reportingManager: z.string().optional(),
  role: z.string().min(1, 'Choose a role'),
  isActive: z.boolean().optional(),
  receivesLeads: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

const ROLE_HINTS: Record<string, string> = {
  admin: 'All leads, assignment, uploads, exports, SMS/email admin and users (counsellors only).',
  counsellor: 'Own leads only: work, follow up and message them. No export or reassignment.',
  other: 'Tick modules, actions, data scope and masked fields below — or start from a role template.',
}

/** Role dropdown value for a role template: the user follows that template's access. */
const TPL = 'tpl:'

const refId = (v: User['team'] | User['reportingManager']) => (typeof v === 'object' && v ? v._id : ((v as string) ?? ''))

/**
 * Create / edit a user (SOW Admin & User Management + Go-live §2):
 * profile → team & reporting manager → role. "Custom access" opens the
 * plug-and-play permission builder (template → modules/actions → data scope →
 * field masking). Without a password the login credentials are emailed.
 */
export function UserFormDrawer({ open, onClose, user }: { open: boolean; onClose: () => void; user?: User }) {
  const isEdit = !!user
  const me = useCurrentUser()
  const superAdmin = !!me?.isSuperAdmin
  const { data: teams } = useTeamOptionsQuery()
  const { data: templates } = useListTemplatesQuery(undefined, { skip: !superAdmin })
  const { data: userOptions } = useUserOptionsQuery()
  const [createUser, { isLoading: creating }] = useCreateUserMutation()
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation()
  const [setPermissions, { isLoading: savingPerms }] = useSetUserPermissionsMutation()

  const initialRole: string = user
    ? user.role === 'other' && user.templateKey
      ? TPL + user.templateKey
      : user.role && user.role !== 'super_admin'
        ? user.role
        : 'other'
    : 'counsellor'
  // The parent mounts this drawer fresh per user (keyed), so defaults derive once.
  const [perms, setPerms] = useState<PermissionState>(() =>
    user
      ? {
          permissions: user.permissions.map((p) => ({ ...p, actions: [...p.actions] })),
          dataScope: user.dataScope,
          fieldRules: user.fieldRules.map((r) => ({ ...r })),
          templateKey: user.templateKey,
        }
      : { permissions: [], dataScope: 'own', fieldRules: [] }
  )

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      designation: user?.designation ?? '',
      mobile: user?.mobile ?? '',
      password: '',
      team: refId(user?.team),
      reportingManager: refId(user?.reportingManager),
      role: initialRole,
      isActive: user?.isActive ?? true,
      receivesLeads: user?.receivesLeads ?? true, // shown checked for a new counsellor
      isSuperAdmin: user?.isSuperAdmin ?? false,
    },
  })
  const [role, isSuperAdminChecked] = useWatch({ control, name: ['role', 'isSuperAdmin'] })
  const receivesTouched = !!dirtyFields.receivesLeads
  // new users: the round-robin box follows the role (counsellors in) until it is ticked by hand
  useEffect(() => {
    if (!isEdit && !receivesTouched) setValue('receivesLeads', role === 'counsellor')
  }, [isEdit, receivesTouched, role, setValue])

  // Super Admin: Admin, Admission Counsellor or custom access; Admin: counsellors only (§2)
  const roleOptions: { value: RoleKey; label: string }[] = superAdmin
    ? [
        { value: 'admin', label: 'Admin' },
        { value: 'counsellor', label: 'Admission Counsellor' },
        { value: 'other', label: 'Custom access (permission builder)' },
      ]
    : [{ value: 'counsellor', label: 'Admission Counsellor' }]
  // templates that drive Admin / Admission Counsellor are those roles, so they are not listed twice
  const roleTemplates = (templates?.data ?? []).filter((t) => !t.role)
  const selectedTemplate = role.startsWith(TPL) ? roleTemplates.find((t) => TPL + t.key === role) : undefined
  const linkedRoleTemplate = (templates?.data ?? []).find((t) => t.role === role)
  const custom = (role === 'other' || role.startsWith(TPL)) && !isSuperAdminChecked
  const roleHint = selectedTemplate
    ? `Access comes from the "${selectedTemplate.name}" template. Editing that template later updates this user too. Changing any tick below makes it custom access.`
    : linkedRoleTemplate
      ? `${ROLE_HINTS[role]} Follows the "${linkedRoleTemplate.name}" role template — edit the template to change every user with this role.`
      : ROLE_HINTS[role]

  const fromTemplate = (key: string): PermissionState | undefined => {
    const t = (templates?.data ?? []).find((x) => x.key === key)
    return t
      ? {
          permissions: t.permissions.map((p) => ({ ...p, actions: [...p.actions] })),
          dataScope: t.dataScope,
          fieldRules: t.fieldRules.map((r) => ({ ...r })),
          templateKey: t.key,
        }
      : undefined
  }

  // keep the Role dropdown and the builder in step: picking / leaving a template in either updates the other
  const onPermsChange = (next: PermissionState) => {
    setPerms(next)
    if (next.templateKey && roleTemplates.some((t) => t.key === next.templateKey)) setValue('role', TPL + next.templateKey)
    else if (role.startsWith(TPL)) setValue('role', 'other')
  }

  const onSubmit = async (values: FormValues) => {
    const base: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      designation: values.designation,
      mobile: values.mobile || null,
      team: values.team || null,
      reportingManager: values.reportingManager || null,
      isActive: values.isActive,
      // on create, an untouched box lets the server default it (counsellors in, others out)
      ...(isEdit || dirtyFields.receivesLeads ? { receivesLeads: values.receivesLeads } : {}),
      ...(superAdmin ? { isSuperAdmin: values.isSuperAdmin } : {}),
    }
    if (values.password) base.password = values.password
    const access = {
      permissions: perms.permissions,
      dataScope: perms.dataScope,
      fieldRules: perms.fieldRules.filter((r) => r.field.trim()),
      templateKey: perms.templateKey ?? null,
    }
    // a template choice is stored as custom access that follows the template
    const apiRole = values.role.startsWith(TPL) ? 'other' : values.role
    try {
      if (isEdit) {
        const roleChanged = apiRole !== user!.role
        await updateUser({ id: user!._id, body: { ...base, ...(superAdmin && roleChanged ? { role: apiRole } : {}) } }).unwrap()
        if (custom && superAdmin) await setPermissions({ id: user!._id, body: access }).unwrap()
        toast.success('User updated')
      } else {
        const res = await createUser({
          ...base,
          role: apiRole,
          ...(custom ? { ...access, templateKey: perms.templateKey } : {}),
        }).unwrap()
        toast.success(res.message)
      }
      onClose()
    } catch (err) {
      const { message, errors: fieldErrors } = parseApiError(err)
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        if (field in schema.shape) setError(field as keyof FormValues, { message: String(msg) })
      })
      toast.error(message)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={isEdit ? `Edit ${user?.name}` : 'Create user'}
      description={
        isEdit
          ? 'Every change is recorded in the activity log.'
          : 'Without a password, the user gets an email with a login link and a temporary password (valid 48 hours).'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={creating || updating || savingPerms}>
            {isEdit ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup title="Profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Full name" required error={errors.name?.message}>
              <Input maxLength={60} placeholder="e.g. Neha Joshi" {...register('name')} aria-invalid={!!errors.name} />
            </FormField>
            <FormField
              label="Email ID"
              required
              error={errors.email?.message}
              hint={isEdit ? 'Also the username — the user signs in with the new email' : 'Also the username'}
            >
              <Input type="email" placeholder="name@gccschool.com" {...register('email')} aria-invalid={!!errors.email} />
            </FormField>
            <FormField label="Designation" required error={errors.designation?.message}>
              <Input maxLength={60} placeholder="e.g. Admission Counsellor" {...register('designation')} aria-invalid={!!errors.designation} />
            </FormField>
            <FormField label="Mobile" error={errors.mobile?.message} hint="Optional · 10 digits · used as {counsellor_mobile} in SMS">
              <Input inputMode="numeric" maxLength={10} {...register('mobile')} aria-invalid={!!errors.mobile} />
            </FormField>
            <FormField
              label={isEdit ? 'Reset password (optional)' : 'Password (optional)'}
              error={errors.password?.message}
              hint={isEdit ? 'Leave empty to keep the current password' : 'Leave empty to email login credentials instead'}
              className="sm:col-span-2"
            >
              <Input type="password" autoComplete="new-password" {...register('password')} aria-invalid={!!errors.password} />
            </FormField>
          </div>
        </FieldGroup>

        <FieldGroup title="Team & reporting" description="Team data scope, dashboards and round-robin follow this structure.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Team">
              <Select {...register('team')}>
                <option value="">No team</option>
                {teams?.data.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Reporting manager">
              <Select {...register('reportingManager')}>
                <option value="">None</option>
                {userOptions?.data
                  .filter((u) => u._id !== user?._id)
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                      {u.designation ? ` · ${u.designation}` : ''}
                    </option>
                  ))}
              </Select>
            </FormField>
          </div>
        </FieldGroup>

        <FieldGroup title="Role & access">
          <FormField label="Role" required error={errors.role?.message} hint={isSuperAdminChecked ? undefined : roleHint}>
            <Select
              {...register('role', {
                onChange: (e) => {
                  const value: string = e.target.value
                  if (value.startsWith(TPL)) {
                    const next = fromTemplate(value.slice(TPL.length))
                    if (next) setPerms(next)
                  } else if (value === 'other') {
                    setPerms((p) => ({ ...p, templateKey: undefined }))
                  }
                },
              })}
              disabled={(isEdit && !superAdmin) || isSuperAdminChecked}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
              {superAdmin && roleTemplates.length > 0 && (
                <optgroup label="Role templates">
                  {roleTemplates.map((t) => (
                    <option key={t.key} value={TPL + t.key}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {role.startsWith(TPL) && !selectedTemplate && templates && (
                <option value={role}>Template no longer exists</option>
              )}
            </Select>
          </FormField>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox {...register('isActive')} disabled={isEdit && user?._id === me?._id} /> Active (can sign in)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox {...register('receivesLeads')} /> In round-robin lead pool
            </label>
            {superAdmin && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox {...register('isSuperAdmin')} disabled={isEdit && user?._id === me?._id} /> Super admin (bypasses all
                permissions)
              </label>
            )}
          </div>
          {custom && (
            <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
              <div className="min-w-0 overflow-x-auto">
                <PermissionBuilder value={perms} onChange={onPermsChange} templates={roleTemplates} />
              </div>
              <MenuPreview permissions={perms.permissions} />
            </div>
          )}
        </FieldGroup>
      </form>
    </Drawer>
  )
}
