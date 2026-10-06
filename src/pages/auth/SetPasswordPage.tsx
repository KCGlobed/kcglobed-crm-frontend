import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useChangePasswordMutation, useLazyMeQuery } from '../../services/authApi'
import { useAppDispatch, useCurrentUser } from '../../app/hooks'
import { setUser } from '../../features/auth/authSlice'
import { Button } from '../../components/ui/Button'
import { FormField, Input } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'

// GL-02: min 8 characters, 1 upper-case letter, 1 number, 1 symbol
const strongPassword = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Add an upper-case letter')
  .regex(/\d/, 'Add a number')
  .regex(/[^A-Za-z0-9]/, 'Add a symbol')

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter the temporary password from your email'),
    newPassword: strongPassword,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type FormValues = z.infer<typeof schema>

/** First login with emailed credentials: the user must choose their own password. */
export default function SetPasswordPage() {
  const user = useCurrentUser()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [changePassword, { isLoading }] = useChangePasswordMutation()
  const [fetchMe] = useLazyMeQuery()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }).unwrap()
      const me = await fetchMe().unwrap()
      dispatch(setUser(me.data.user))
      toast.success('Password set — welcome to GCC School CRM')
      navigate('/app', { replace: true })
    } catch (err) {
      const { message, errors: fieldErrors } = parseApiError(err)
      Object.entries(fieldErrors).forEach(([field, msg]) => setError(field as keyof FormValues, { message: msg }))
      toast.error(message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 bg-[radial-gradient(circle_at_top,var(--color-brand-50),transparent_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <KeyRound className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">Set your password</h1>
          <p className="text-xs text-slate-500">
            Hi {user?.name?.split(' ')[0]}, replace the temporary password from your email before you continue.
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormField label="Temporary password" error={errors.currentPassword?.message} required>
            <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <FormField
            label="New password"
            error={errors.newPassword?.message}
            hint="Min 8 characters with an upper-case letter, a number and a symbol"
            required
          >
            <Input type="password" autoComplete="new-password" {...register('newPassword')} />
          </FormField>
          <FormField label="Confirm new password" error={errors.confirm?.message} required>
            <Input type="password" autoComplete="new-password" {...register('confirm')} />
          </FormField>
          <Button type="submit" className="w-full" loading={isLoading}>
            Save and continue
          </Button>
        </form>
      </div>
    </div>
  )
}
