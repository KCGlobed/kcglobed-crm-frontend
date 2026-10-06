import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useSaveLeadProfileStepMutation } from '../../../services/leadsApi'
import { FormField, Input, Select, Textarea } from '../../../components/ui/fields'
import { GENDERS, INDIAN_STATES, MAX_AGE, MIN_AGE, RELATIONSHIPS } from '../../../constants/profileOptions'
import type { LeadProfile } from '../../../types/models'
import { ageFrom, personalSchema, type PersonalValues, showSaveError } from './profileSchemas'
import { Section, StepActions } from './ProfileFields'
import { CityField } from './CityField'

/** Bounds for the date picker from the 17–40 age rule (#5). */
const yearsAgo = (n: number) => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - n)
  return d.toISOString().slice(0, 10)
}

export function PersonalStep({
  leadId,
  profile,
  readOnly,
  onSaved,
}: {
  leadId: string
  profile: LeadProfile
  readOnly: boolean
  onSaved: () => void
}) {
  const [save, { isLoading }] = useSaveLeadProfileStepMutation()
  const p = profile.personal ?? {}
  const g = profile.guardian ?? {}
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PersonalValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      personal: {
        firstName: p.firstName ?? '',
        lastName: p.lastName ?? '',
        email: p.email ?? '',
        mobile: p.mobile ?? '',
        dob: p.dob ?? '',
        gender: (p.gender ?? '') as PersonalValues['personal']['gender'],
        state: (p.state ?? '') as PersonalValues['personal']['state'],
        city: p.city ?? '',
        pinCode: p.pinCode ?? '',
        address: p.address ?? '',
      },
      guardian: {
        name: g.name ?? '',
        relationship: (g.relationship ?? '') as PersonalValues['guardian']['relationship'],
        mobile: g.mobile ?? '',
        email: g.email ?? '',
      },
    },
  })
  const age = ageFrom(useWatch({ control, name: 'personal.dob' }))
  const personalState = useWatch({ control, name: 'personal.state' }) as string | undefined
  const pe = errors.personal
  const ge = errors.guardian

  const onSubmit = async (values: PersonalValues) => {
    try {
      const res = await save({ id: leadId, step: 'personal', body: values }).unwrap()
      toast.success(res.message)
      onSaved()
    } catch (err) {
      showSaveError(err, setError)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <fieldset disabled={readOnly} className="space-y-4">
        <Section title="Personal Information">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="First Name" required error={pe?.firstName?.message}>
              <Input maxLength={50} aria-invalid={!!pe?.firstName} {...register('personal.firstName')} />
            </FormField>
            <FormField label="Last Name" required error={pe?.lastName?.message}>
              <Input maxLength={50} aria-invalid={!!pe?.lastName} {...register('personal.lastName')} />
            </FormField>
            <FormField label="Email ID" required error={pe?.email?.message}>
              <Input type="email" aria-invalid={!!pe?.email} {...register('personal.email')} />
            </FormField>
            <FormField label="Mobile Number" required error={pe?.mobile?.message} hint="10 digits">
              <Input type="tel" inputMode="numeric" aria-invalid={!!pe?.mobile} {...register('personal.mobile')} />
            </FormField>
            <FormField label="Date of Birth" required error={pe?.dob?.message}>
              <Input
                type="date"
                min={yearsAgo(MAX_AGE + 1)}
                max={yearsAgo(MIN_AGE)}
                aria-invalid={!!pe?.dob}
                {...register('personal.dob')}
              />
            </FormField>
            <FormField label="Age" hint="Calculated from date of birth">
              <Input value={age ?? ''} readOnly disabled placeholder="—" />
            </FormField>
            <FormField label="Gender" required error={pe?.gender?.message}>
              <Select aria-invalid={!!pe?.gender} {...register('personal.gender')}>
                <option value="">Select gender…</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Current State" required error={pe?.state?.message}>
              <Select aria-invalid={!!pe?.state} {...register('personal.state')}>
                <option value="">Select state…</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Current City" required error={pe?.city?.message}>
              <Controller
                control={control}
                name="personal.city"
                render={({ field }) => (
                  <CityField state={personalState} value={field.value ?? ''} onChange={field.onChange} invalid={!!pe?.city} disabled={readOnly} />
                )}
              />
            </FormField>
            <FormField label="PIN Code" required error={pe?.pinCode?.message}>
              <Input inputMode="numeric" maxLength={6} aria-invalid={!!pe?.pinCode} {...register('personal.pinCode')} />
            </FormField>
            <FormField label="Complete Address" error={pe?.address?.message} hint="Optional, max 250 characters" className="sm:col-span-2 lg:col-span-3">
              <Textarea rows={3} maxLength={250} aria-invalid={!!pe?.address} {...register('personal.address')} />
            </FormField>
          </div>
        </Section>

        <Section title="Parent / Guardian Details">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Parent/Guardian Name" required error={ge?.name?.message}>
              <Input aria-invalid={!!ge?.name} {...register('guardian.name')} />
            </FormField>
            <FormField label="Relationship" required error={ge?.relationship?.message}>
              <Select aria-invalid={!!ge?.relationship} {...register('guardian.relationship')}>
                <option value="">Select relationship…</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Parent/Guardian Mobile" required error={ge?.mobile?.message} hint="Must differ from the candidate's mobile">
              <Input type="tel" inputMode="numeric" aria-invalid={!!ge?.mobile} {...register('guardian.mobile')} />
            </FormField>
            <FormField label="Parent/Guardian Email" error={ge?.email?.message} hint="Optional">
              <Input type="email" aria-invalid={!!ge?.email} {...register('guardian.email')} />
            </FormField>
          </div>
        </Section>
      </fieldset>
      <StepActions saving={isLoading} readOnly={readOnly} />
    </form>
  )
}
