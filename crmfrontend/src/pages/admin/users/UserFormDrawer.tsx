import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreateUserMutation, useUpdateUserMutation } from '../../../services/adminApi'
import { useCurrentUser } from '../../../app/hooks'
import { Drawer } from '../../../components/ui/Drawer'
import { Button } from '../../../components/ui/Button'
import { Checkbox, FormField, Input, Select } from '../../../components/ui/fields'
import { parseApiError } from '../../../lib/utils'
import { ROLE_OPTIONS } from '../../../lib/roles'
import type { User } from '../../../types/models'

// GL-01 create-user form
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
  role: z.string().min(1, 'Choose a role'),
  receivesLeads: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

/**
 * Users are created with only name, email and designation (+ optional mobile
 * and the role); the login credentials are emailed automatically (GL-02).
 * Admin can create only Admission Counsellors. Email can't change later.
 */
export function UserFormDrawer({ open, onClose, user }: { open: boolean; onClose: () => void; user?: User }) {
  const isEdit = !!user
  const me = useCurrentUser()
  const [createUser, { isLoading: creating }] = useCreateUserMutation()
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation()
  const roles = me?.isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value === 'counsellor')
  const legacy = user?.role === 'other' || user?.role === 'super_admin'

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      designation: user?.designation ?? '',
      mobile: user?.mobile ?? '',
      role: user?.role && user.role !== 'other' && user.role !== 'super_admin' ? user.role : legacy ? 'keep' : 'counsellor',
      receivesLeads: user?.receivesLeads ?? true,
    },
  })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = async (values: FormValues) => {
    const body: Record<string, unknown> = {
      name: values.name,
      designation: values.designation,
      mobile: values.mobile || null,
    }
    if (values.role !== 'keep' && (!isEdit || me?.isSuperAdmin)) body.role = values.role
    if (values.role === 'counsellor') body.receivesLeads = values.receivesLeads ?? true
    try {
      if (isEdit) {
        await updateUser({ id: user!._id, body }).unwrap()
        toast.success('User updated')
      } else {
        const res = await createUser({ ...body, email: values.email }).unwrap()
        toast.success(res.message)
      }
      onClose()
    } catch (err) {
      const { message, errors: fieldErrors } = parseApiError(err)
      Object.entries(fieldErrors).forEach(([f, m]) => setError(f as keyof FormValues, { message: String(m) }))
      toast.error(message)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${user?.name}` : 'Create user'}
      description={isEdit ? 'Email cannot be changed after creation.' : 'The user receives an email with a login link and a temporary password (valid 48 hours).'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={creating || updating}>
            {isEdit ? 'Save changes' : 'Create & send credentials'}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Full name" required error={errors.name?.message}>
          <Input maxLength={60} {...register('name')} aria-invalid={!!errors.name} />
        </FormField>
        <FormField label="Email ID" required error={errors.email?.message} hint={isEdit ? undefined : 'Also the username'}>
          <Input type="email" disabled={isEdit} {...register('email')} aria-invalid={!!errors.email} />
        </FormField>
        <FormField label="Designation" required error={errors.designation?.message}>
          <Input maxLength={60} {...register('designation')} aria-invalid={!!errors.designation} />
        </FormField>
        <FormField label="Mobile" error={errors.mobile?.message} hint="Optional, 10 digits — used in SMS as the counsellor's number">
          <Input inputMode="numeric" maxLength={10} {...register('mobile')} />
        </FormField>
        <FormField label="Role" required error={errors.role?.message}>
          <Select {...register('role')} disabled={isEdit && !me?.isSuperAdmin}>
            {legacy && <option value="keep">{user?.roleLabel ?? 'Keep current access'}</option>}
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </FormField>
        {role === 'counsellor' && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox {...register('receivesLeads')} /> Receives live Meta leads (round-robin while logged in)
          </label>
        )}
      </form>
    </Drawer>
  )
}
