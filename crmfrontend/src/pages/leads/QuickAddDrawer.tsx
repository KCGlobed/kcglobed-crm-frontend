import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateLeadMutation, useLazyCheckDuplicateQuery, useProfileOptionsQuery } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { useCurrentUser } from '../../app/hooks'
import { isCounsellor } from '../../lib/roles'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { DuplicateCheck } from '../../types/models'
import { useCounsellors } from './leadSelection'

// GL-10 Quick Add sources
const QUICK_ADD_SOURCES = ['Walk-in', 'Inbound Call', 'Referral', 'Event', 'Other']
const NAME = /^[A-Za-z][A-Za-z .]*$/

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50, 'Max 50 characters').regex(NAME, 'Letters, spaces and "." only'),
  lastName: z.string().trim().max(50, 'Max 50 characters').regex(NAME, 'Letters, spaces and "." only').optional().or(z.literal('')),
  mobile: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91(?=\d{10}$)|0)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, '10 digits starting with 6–9')),
  email: z.email('Enter a valid email').optional().or(z.literal('')),
  state: z.string().optional(),
  city: z.string().optional(),
  programInterest: z.string().optional(),
  source: z.string().min(1, 'Choose the source'),
  note: z.string().max(2000, 'Max 2,000 characters').optional(),
  owner: z.string().optional(),
})
type FormValues = z.input<typeof schema>

/** One-screen Quick Add (GL-10). The duplicate check runs while typing, before save. */
export function QuickAddDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const counsellor = isCounsellor(user)
  const { data: masters } = useMasterBootstrapQuery()
  const { data: places } = useProfileOptionsQuery()
  const counsellors = useCounsellors()
  const [createLead, { isLoading }] = useCreateLeadMutation()
  const [checkDuplicate] = useLazyCheckDuplicateQuery()
  const [checked, setChecked] = useState<{ key: string; result: DuplicateCheck | null } | null>(null)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', mobile: '', email: '', state: '', city: '', programInterest: '', source: '', note: '', owner: '' },
  })
  const [mobile, email, state] = useWatch({ control, name: ['mobile', 'email', 'state'] })

  // live duplicate check (debounced) as soon as a full mobile or an email is typed;
  // the answer is tagged with what was checked, so a stale answer never shows
  const digits = (mobile ?? '').replace(/\D/g, '').slice(-10)
  const mail = (email ?? '').trim()
  const checkKey = digits.length === 10 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) ? `${digits.length === 10 ? digits : ''}|${mail}` : ''
  useEffect(() => {
    if (!checkKey) return
    const [m, e] = checkKey.split('|')
    const t = setTimeout(() => {
      checkDuplicate({ mobile: m || undefined, email: e || undefined })
        .unwrap()
        .then((r) => setChecked({ key: checkKey, result: r.data.exists ? r.data : null }))
        .catch(() => setChecked({ key: checkKey, result: null }))
    }, 400)
    return () => clearTimeout(t)
  }, [checkKey, checkDuplicate])
  const duplicate = checked && checked.key === checkKey ? checked.result : null

  const sources = (masters?.data.sources ?? []).filter((s) => QUICK_ADD_SOURCES.includes(s.name))
  const cities = state ? places?.data.citiesByState[state] ?? [] : []

  const onSubmit = async (values: FormValues) => {
    if (duplicate) return
    const parsed = schema.parse(values)
    const body: Record<string, unknown> = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== '' && v !== undefined))
    try {
      const res = await createLead(body).unwrap()
      toast.success(`Lead ${res.data.leadNo} created${res.data.owner ? ` · owner ${res.data.owner.name}` : ' · in the Unassigned pool'}`)
      onClose()
      navigate(`/app/leads/${res.data._id}`)
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
      title="Quick Add lead"
      description={counsellor ? 'The lead will be assigned to you.' : 'Pick a counsellor, or leave it in the Unassigned pool.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isLoading} disabled={!!duplicate}>
            Save lead
          </Button>
        </>
      }
    >
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
        {duplicate && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{duplicate.message}</p>
              {duplicate.visible && duplicate.leadId && (
                <button type="button" className="mt-1 text-xs font-medium underline" onClick={() => navigate(`/app/leads/${duplicate.leadId}`)}>
                  Open {duplicate.leadNo}
                </button>
              )}
            </div>
          </div>
        )}
        <FormField label="First name" error={errors.firstName?.message} required>
          <Input {...register('firstName')} aria-invalid={!!errors.firstName} />
        </FormField>
        <FormField label="Last name" error={errors.lastName?.message}>
          <Input {...register('lastName')} />
        </FormField>
        <FormField label="Mobile" error={errors.mobile?.message} required hint="10 digits; +91 / leading 0 removed">
          <Input inputMode="tel" {...register('mobile')} aria-invalid={!!errors.mobile || duplicate?.field === 'mobile'} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} aria-invalid={!!errors.email || duplicate?.field === 'email'} />
        </FormField>
        <FormField label="State" error={errors.state?.message}>
          <Select {...register('state')}>
            <option value="">—</option>
            {places?.data.states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="City" error={errors.city?.message}>
          <Input list="quick-add-cities" {...register('city')} placeholder={state ? 'Pick or type' : 'Choose a state first'} />
          <datalist id="quick-add-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Program interest">
          <Select {...register('programInterest')}>
            <option value="">—</option>
            {masters?.data.programs.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Source" error={errors.source?.message} required>
          <Select {...register('source')} aria-invalid={!!errors.source}>
            <option value="">Choose…</option>
            {sources.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
        {!counsellor && (
          <FormField label="Assign to" className="sm:col-span-2" hint="Leave empty to keep it in the Unassigned pool">
            <Select {...register('owner')}>
              <option value="">Unassigned pool</option>
              {counsellors.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Note" error={errors.note?.message} className="sm:col-span-2">
          <Textarea rows={3} maxLength={2000} {...register('note')} />
        </FormField>
      </form>
    </Drawer>
  )
}
