import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useChangePasswordMutation } from '../services/authApi'
import { useCurrentUser } from '../app/hooks'
import { PageHeader } from '../components/ui/misc'
import { Button } from '../components/ui/Button'
import { FormField, Input } from '../components/ui/fields'
import { parseApiError } from '../lib/utils'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-zA-Z]/, 'Must contain a letter')
      .regex(/\d/, 'Must contain a number'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type FormValues = z.infer<typeof schema>

export default function ProfilePage() {
  const user = useCurrentUser()
  const [changePassword, { isLoading }] = useChangePasswordMutation()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (v: FormValues) => {
    try {
      await changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }).unwrap()
      toast.success('Password changed. Other sessions were signed out.')
      reset({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      if (fe.currentPassword) setError('currentPassword', { message: fe.currentPassword })
      toast.error(message)
    }
  }

  return (
    <>
      <PageHeader title="My profile" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Account</h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between"><dt className="text-slate-400">Name</dt><dd className="font-medium">{user?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Email</dt><dd className="font-medium">{user?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Access</dt><dd className="font-medium">{user?.isSuperAdmin ? 'Super admin' : user?.templateKey ?? 'Custom'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Data scope</dt><dd className="font-medium">{user?.dataScope}</dd></div>
          </dl>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Change password</h3>
          <FormField label="Current password" error={errors.currentPassword?.message} required>
            <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <FormField label="New password" error={errors.newPassword?.message} required>
            <Input type="password" autoComplete="new-password" {...register('newPassword')} />
          </FormField>
          <FormField label="Confirm new password" error={errors.confirm?.message} required>
            <Input type="password" autoComplete="new-password" {...register('confirm')} />
          </FormField>
          <Button type="submit" loading={isLoading}>Update password</Button>
        </form>
      </div>
    </>
  )
}
