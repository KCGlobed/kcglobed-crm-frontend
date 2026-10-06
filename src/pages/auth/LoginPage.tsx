import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GraduationCap } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useLoginMutation } from '../../services/authApi'
import { useAppDispatch } from '../../app/hooks'
import { setCredentials } from '../../features/auth/authSlice'
import { Button } from '../../components/ui/Button'
import { FormField, Input } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const [login, { isLoading }] = useLoginMutation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await login(values).unwrap()
      dispatch(setCredentials({ user: result.data.user, accessToken: result.data.access_token }))
      if (result.data.user.mustChangePassword) {
        navigate('/set-password', { replace: true })
        return
      }
      toast.success(`Welcome back, ${result.data.user.name.split(' ')[0]}`)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/app', { replace: true })
    } catch (err) {
      const { message, errors: fieldErrors } = parseApiError(err)
      Object.entries(fieldErrors).forEach(([field, msg]) =>
        setError(field as keyof FormValues, { message: msg })
      )
      toast.error(message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 bg-[radial-gradient(circle_at_top,var(--color-brand-50),transparent_60%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">GCC School CRM</h1>
          <p className="text-xs text-slate-500">Sign in to the admissions platform</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <FormField label="Email" error={errors.email?.message} required>
            <Input
              type="email"
              placeholder="you@gccschool.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </FormField>
          <FormField label="Password" error={errors.password?.message} required>
            <Input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </FormField>
          <div className="flex items-center justify-end">
            <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" loading={isLoading}>
            Sign in
          </Button>
        </form>

        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/60 p-3 text-[11px] text-slate-500">
          <p className="font-semibold text-slate-600">Demo accounts (seeded)</p>
          <p>Super admin: admin@gccschool.com / Admin@12345</p>
          <p>Admin: priya.admin@gccschool.com / Welcome@123</p>
          <p>Admission Counsellor: arjun.c@gccschool.com / Welcome@123</p>
          <p>Admission Counsellor: sara.c@gccschool.com / Welcome@123</p>
        </div>
      </div>
    </div>
  )
}
