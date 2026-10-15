import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSaveLeadProfileStepMutation } from '../../../services/leadsApi'
import { Button } from '../../../components/ui/Button'
import { FormField, Input, Select } from '../../../components/ui/fields'
import { EMPLOYMENT_STATUSES } from '../../../constants/profileOptions'
import type { LeadProfile, ProfileWork } from '../../../types/models'
import { workSchema, type ExperienceEntry, type WorkValues, showSaveError } from './profileSchemas'
import { Section, PROFILE_STEP_FORM, PROFILE_STEP_SAVE } from './ProfileFields'

const EMPTY_ENTRY: ExperienceEntry = { organization: '', designation: '', functionalArea: '', fromDate: '', toDate: '' }

/** Stored work → form values; an old single-organisation record becomes the first entry. */
function toFormValues(work: ProfileWork | null): WorkValues | undefined {
  if (!work) return undefined
  const stored =
    work.experiences && work.experiences.length
      ? work.experiences
      : work.organization
        ? [{ organization: work.organization, designation: work.designation ?? '', functionalArea: work.functionalArea }]
        : []
  const experiences = stored.map((e) => ({
    organization: e.organization ?? '',
    designation: e.designation ?? '',
    functionalArea: e.functionalArea ?? '',
    fromDate: e.fromDate ?? '',
    toDate: e.toDate ?? '',
  }))
  return { work: { employmentStatus: work.employmentStatus as WorkValues['work']['employmentStatus'], experiences } }
}

export function WorkStep({
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
  const [save] = useSaveLeadProfileStepMutation({ fixedCacheKey: PROFILE_STEP_SAVE })
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<WorkValues>({
    resolver: zodResolver(workSchema),
    defaultValues: toFormValues(profile.work),
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'work.experiences' })
  const experienced = useWatch({ control, name: 'work.employmentStatus' }) === 'Experienced'
  const we = errors.work

  const onSubmit = async (values: WorkValues) => {
    // Experience entries only apply to an experienced candidate (LM-18).
    const body =
      values.work.employmentStatus === 'Experienced'
        ? { work: { employmentStatus: values.work.employmentStatus, experiences: values.work.experiences } }
        : { work: { employmentStatus: values.work.employmentStatus } }
    try {
      const res = await save({ id: leadId, step: 'work', body }).unwrap()
      toast.success(res.message)
      onSaved()
    } catch (err) {
      showSaveError(err, setError)
    }
  }

  return (
    <form id={PROFILE_STEP_FORM} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <fieldset disabled={readOnly} className="space-y-4">
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
          </div>

          {/* #30–#33 show only for Experienced — one card per organisation/role */}
          {experienced && (
            <div className="mt-3 space-y-3">
              {we?.experiences?.message && <p className="text-xs text-red-600">{we.experiences.message}</p>}
              {fields.map((field, i) => {
                const ee = we?.experiences?.[i]
                return (
                  <div key={field.id} className="relative rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience {i + 1}</p>
                      {!readOnly && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)} title="Remove this experience">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Organization Name" required error={ee?.organization?.message}>
                        <Input maxLength={100} aria-invalid={!!ee?.organization} {...register(`work.experiences.${i}.organization`)} />
                      </FormField>
                      <FormField label="Designation" required error={ee?.designation?.message}>
                        <Input maxLength={100} aria-invalid={!!ee?.designation} {...register(`work.experiences.${i}.designation`)} />
                      </FormField>
                      <FormField label="Functional Area" error={ee?.functionalArea?.message}>
                        <Input maxLength={100} aria-invalid={!!ee?.functionalArea} {...register(`work.experiences.${i}.functionalArea`)} />
                      </FormField>
                      <FormField label="From" required error={ee?.fromDate?.message}>
                        <Input type="date" aria-invalid={!!ee?.fromDate} {...register(`work.experiences.${i}.fromDate`)} />
                      </FormField>
                      <FormField label="To" hint="Leave empty if currently working here" error={ee?.toDate?.message}>
                        <Input type="date" aria-invalid={!!ee?.toDate} {...register(`work.experiences.${i}.toDate`)} />
                      </FormField>
                    </div>
                  </div>
                )
              })}
              {!readOnly && (
                <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_ENTRY)}>
                  <Plus className="h-3.5 w-3.5" /> Add Experience
                </Button>
              )}
            </div>
          )}
        </Section>
      </fieldset>
    </form>
  )
}
