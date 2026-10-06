import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useForgotPasswordMutation } from '../../services/authApi'
import { Button } from '../../components/ui/Button'
import { FormField, Input } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'

const schema = z.object({ email: z.email('Enter a valid email') })
type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [forgot, { isLoading }] = useForgotPasswordMutation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      await forgot(values).unwrap()
      setSent(true)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 bg-[radial-gradient(circle_at_top,var(--color-brand-50),transparent_60%)] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="rounded-full bg-emerald-50 p-3">
              <MailCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-700">Check your inbox</p>
            <p className="text-xs text-slate-500">
              If that email exists, a reset link is on its way. (Without SMTP configured, the link is
              printed in the backend logs.)
            </p>
            <Link to="/login" className="text-xs font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <h1 className="text-base font-semibold text-slate-800">Forgot password</h1>
              <p className="mt-1 text-xs text-slate-500">
                Enter your email and we'll send you a reset link.
              </p>
            </div>
            <FormField label="Email" error={errors.email?.message} required>
              <Input type="email" placeholder="you@gccschool.com" {...register('email')} />
            </FormField>
            <Button type="submit" className="w-full" loading={isLoading}>
              Send reset link
            </Button>
            <p className="text-center">
              <Link to="/login" className="text-xs font-medium text-brand-600 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
