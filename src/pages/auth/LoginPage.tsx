import { useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Crown, Headset, UserCog, type LucideIcon } from 'lucide-react'
import logo from '../../assets/logo-kcglobed.svg'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useLoginMutation } from '../../services/authApi'
import { useAppDispatch } from '../../app/hooks'
import { setCredentials } from '../../features/auth/authSlice'
import { AuthShell } from '../../components/layout/AuthShell'
import { Button } from '../../components/ui/Button'
import { FormField, Input } from '../../components/ui/fields'
import { cn, parseApiError } from '../../lib/utils'

const schema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

/** Seeded backend accounts — a click fills the form. Delete this list to remove the quick-fill buttons. */
const DEMO_ACCOUNTS: { label: string; email: string; password: string; icon: LucideIcon; tone: string }[] = [
  { label: 'Super Admin', email: 'admin@gccschool.com', password: 'Admin@12345', icon: Crown, tone: 'from-gold-300 to-gold-500' },
  { label: 'Admin', email: 'priya.admin@gccschool.com', password: 'Welcome@123', icon: UserCog, tone: 'from-brand-400 to-brand-600' },
  { label: 'Counsellor', email: 'arjun.c@gccschool.com', password: 'Welcome@123', icon: Headset, tone: 'from-emerald-400 to-emerald-600' },
  { label: 'Counsellor', email: 'sara.c@gccschool.com', password: 'Welcome@123', icon: Headset, tone: 'from-sky-500 to-sky-600' },
]

export default function LoginPage() {
  const [login, { isLoading }] = useLoginMutation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const submitRef = useRef<HTMLButtonElement>(null)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const [email, password] = useWatch({ control, name: ['email', 'password'] })

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setValue('email', account.email, { shouldDirty: true })
    setValue('password', account.password, { shouldDirty: true })
    clearErrors()
    // Enter now signs in
    submitRef.current?.focus()
  }

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
    <AuthShell>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src={logo} alt="KcGlobed" className="mb-2 h-12 w-auto lg:hidden" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500">Sign in to KcGlobed CRM</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
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
          <Button ref={submitRef} type="submit" className="h-10 w-full" loading={isLoading}>
            Sign in
          </Button>
        </form>

        {DEMO_ACCOUNTS.length > 0 && (
          <section className="mt-6" aria-label="Demo accounts">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sign in as a demo user</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => {
                const active = email === account.email && password === account.password
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account)}
                    disabled={isLoading}
                    aria-pressed={active}
                    title={`${account.label} — ${account.email}`}
                    className={cn(
                      'flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
                      active
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100'
                        : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50'
                    )}
                  >
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-sm', account.tone)}>
                      <account.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800">{account.label}</span>
                      <span className="block truncate text-[10px] text-slate-500">{account.email}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2.5 text-center text-[11px] text-slate-400">Pick an account to fill in its email and password, then sign in.</p>
          </section>
        )}
      </div>
    </AuthShell>
  )
}
