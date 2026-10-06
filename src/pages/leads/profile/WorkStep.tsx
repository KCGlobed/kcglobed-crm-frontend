import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useSaveLeadProfileStepMutation } from '../../../services/leadsApi'
import { FormField, Input, Select } from '../../../components/ui/fields'
import { EMPLOYMENT_STATUSES } from '../../../constants/profileOptions'
import type { LeadProfile } from '../../../types/models'
import { toNumber, workSchema, type WorkValues, showSaveError } from './profileSchemas'
import { Section, StepActions } from './ProfileFields'

export function WorkStep({
  leadId,
  profile,
  readOnly,
  onBack,
  onSaved,
}: {
  leadId: string
  profile: LeadProfile
  readOnly: boolean
  onBack: () => void
  onSaved: () => void
}) {
  const [save, { isLoading }] = useSaveLeadProfileStepMutation()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<WorkValues>({
    resolver: zodResolver(workSchema),
    defaultValues: profile.work ? { work: profile.work as WorkValues['work'] } : undefined,
  })
  const experienced = useWatch({ control, name: 'work.employmentStatus' }) === 'Experienced'
  const we = errors.work

  const onSubmit = async (values: WorkValues) => {
    // Experience details only apply to an experienced candidate.
    const body =
      values.work.employmentStatus === 'Experienced' ? values : { work: { employmentStatus: values.work.employmentStatus } }
    try {
      const res = await save({ id: leadId, step: 'work', body }).unwrap()
      toast.success(res.message)
      onSaved()
    } catch (err) {
      showSaveError(err, setError)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <fieldset disabled={readOnly}>
        <Section title="Work Experience">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Employment Status" required error={we?.employmentStatus?.message}>
              <Select aria-invalid={!!we?.employmentStatus} {...register('work.employmentStatus')}>
                <option value="">Select status…</option>
                {EMPLOYMENT_STATUSES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Select>
            </FormField>
            {/* #30–#33 show only for Experienced */}
            {experienced && <span className="hidden sm:block" />}
            {experienced && (
              <>
                <FormField label="Organization Name" required error={we?.organization?.message}>
                  <Input aria-invalid={!!we?.organization} {...register('work.organization')} />
                </FormField>
                <FormField label="Designation" required error={we?.designation?.message}>
                  <Input aria-invalid={!!we?.designation} {...register('work.designation')} />
                </FormField>
                <FormField label="Functional Area" required error={we?.functionalArea?.message}>
                  <Input aria-invalid={!!we?.functionalArea} {...register('work.functionalArea')} />
                </FormField>
                <FormField
                  label="Experience (Years, Months)"
                  required
                  error={we?.experienceYears?.message ?? we?.experienceMonths?.message}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      placeholder="YY"
                      aria-label="Years"
                      aria-invalid={!!we?.experienceYears}
                      {...register('work.experienceYears', { setValueAs: toNumber })}
                    />
                    <span className="text-xs text-slate-400">/</span>
                    <Input
                      type="number"
                      min={0}
                      max={11}
                      placeholder="MM"
                      aria-label="Months"
                      aria-invalid={!!we?.experienceMonths}
                      {...register('work.experienceMonths', { setValueAs: toNumber })}
                    />
                  </div>
                </FormField>
              </>
            )}
          </div>
        </Section>
      </fieldset>
      <StepActions onBack={onBack} saving={isLoading} readOnly={readOnly} />
    </form>
  )
}
