import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useResetPasswordMutation } from '../../services/authApi'
import { AuthShell } from '../../components/layout/AuthShell'
import { Button } from '../../components/ui/Button'
import { FormField, Input } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-zA-Z]/, 'Must contain a letter')
      .regex(/\d/, 'Must contain a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [reset, { isLoading }] = useResetPasswordMutation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      await reset({ token, password: values.password }).unwrap()
      toast.success('Password reset. Sign in with your new password.')
      navigate('/login')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Set a new password</h1>
            {!token && (
              <p className="mt-1 text-xs text-red-600">
                Missing reset token — use the link from your email.
              </p>
            )}
          </div>
          <FormField label="New password" error={errors.password?.message} required>
            <Input type="password" {...register('password')} />
          </FormField>
          <FormField label="Confirm password" error={errors.confirm?.message} required>
            <Input type="password" {...register('confirm')} />
          </FormField>
          <Button type="submit" className="w-full" loading={isLoading} disabled={!token}>
            Reset password
          </Button>
          <p className="text-center">
            <Link to="/login" className="text-xs font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </AuthShell>
  )
}
