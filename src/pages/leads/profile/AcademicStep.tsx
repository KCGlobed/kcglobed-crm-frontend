import { useForm, useWatch, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useSaveLeadProfileStepMutation } from '../../../services/leadsApi'
import { FormField, Input, Select } from '../../../components/ui/fields'
import {
  GRADE_TYPES,
  MEDIUMS,
  MIN_PASSING_YEAR,
  QUALIFICATION_STATUSES,
  UG_QUALIFICATIONS,
  maxPursuingYear,
  yearsBetween,
} from '../../../constants/profileOptions'
import type { LeadProfile } from '../../../types/models'
import { academicSchema, showSaveError, toNumber, type AcademicInput, type AcademicValues } from './profileSchemas'
import { RadioGroup, Section, StepActions } from './ProfileFields'

type Register = UseFormRegister<AcademicInput>

function YearSelect({ years, invalid, ...registration }: ReturnType<Register> & { years: number[]; invalid?: boolean }) {
  return (
    <Select aria-invalid={invalid} {...registration}>
      <option value="">Select year…</option>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </Select>
  )
}

function OptionSelect({
  options,
  placeholder,
  invalid,
  ...registration
}: ReturnType<Register> & { options: readonly string[]; placeholder: string; invalid?: boolean }) {
  return (
    <Select aria-invalid={invalid} {...registration}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
  )
}

/** #17 / #20 / #25: pick Percentage or CGPA, then the value (% 0–100, CGPA 0–10). */
function GradeFields({
  label,
  base,
  register,
  errors,
  gradeType,
  required,
}: {
  label: string
  base: 'academic.class10' | 'academic.class12' | 'academic.ug'
  register: Register
  errors?: { gradeType?: { message?: string }; score?: { message?: string } }
  gradeType?: unknown
  required: boolean
}) {
  const max = gradeType === 'CGPA' ? 10 : 100
  return (
    <FormField label={label} required={required} error={errors?.gradeType?.message ?? errors?.score?.message}>
      <div className="flex flex-wrap items-center gap-2">
        <RadioGroup options={GRADE_TYPES} registration={register(`${base}.gradeType`)} invalid={!!errors?.gradeType} />
        <Input
          type="number"
          step="0.01"
          min={0}
          max={max}
          className="!w-28"
          placeholder={gradeType === 'CGPA' ? '0–10' : '0–100'}
          aria-label={`${label} score`}
          aria-invalid={!!errors?.score}
          {...register(`${base}.score`, { setValueAs: toNumber })}
        />
      </div>
    </FormField>
  )
}

function SchoolFields({
  cls,
  register,
  errors,
  gradeType,
  years,
}: {
  cls: '10' | '12'
  register: Register
  errors?: FieldErrors<AcademicInput['academic']['class10']>
  gradeType?: unknown
  years: number[]
}) {
  const key = cls === '10' ? 'class10' : 'class12'
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <FormField label={`Class ${cls}th Year of Passing`} required error={errors?.yearOfPassing?.message}>
        <YearSelect years={years} invalid={!!errors?.yearOfPassing} {...register(`academic.${key}.yearOfPassing`, { setValueAs: toNumber })} />
      </FormField>
      <GradeFields
        label={`Class ${cls}th Grade Type + Score`}
        base={`academic.${key}`}
        register={register}
        errors={errors}
        gradeType={gradeType}
        required
      />
      <FormField label={`Class ${cls}th Medium`} required error={errors?.medium?.message}>
        <OptionSelect options={MEDIUMS} placeholder="Select medium…" invalid={!!errors?.medium} {...register(`academic.${key}.medium`)} />
      </FormField>
    </div>
  )
}

export function AcademicStep({
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
  const a = profile.academic
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AcademicInput, unknown, AcademicValues>({
    resolver: zodResolver(academicSchema),
    // Untouched selects/radios start empty; the schema reports them as required.
    defaultValues: a
      ? {
          academic: {
            ...(a as AcademicInput['academic']),
            // radios match on string values
            higherQualification: { ...a.higherQualification, has: String(a.higherQualification.has) },
          },
        }
      : undefined,
  })
  const [g10, g12, gUg, ugStatus, hasHigher] = useWatch({
    control,
    name: [
      'academic.class10.gradeType',
      'academic.class12.gradeType',
      'academic.ug.gradeType',
      'academic.ug.status',
      'academic.higherQualification.has',
    ],
  })
  const ae = errors.academic
  const ug = ae?.ug
  const now = new Date().getFullYear()
  const schoolYears = yearsBetween(MIN_PASSING_YEAR, now)
  const ugYears = yearsBetween(MIN_PASSING_YEAR, ugStatus === 'Pursuing' ? maxPursuingYear() : now)

  const onSubmit = async (values: AcademicValues) => {
    try {
      const res = await save({ id: leadId, step: 'academic', body: values }).unwrap()
      toast.success(res.message)
      onSaved()
    } catch (err) {
      showSaveError(err, setError)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <fieldset disabled={readOnly} className="space-y-4">
        <Section title="Academic Information — Class 10th">
          <SchoolFields cls="10" register={register} errors={ae?.class10} gradeType={g10} years={schoolYears} />
        </Section>
        <Section title="Academic Information — Class 12th">
          <SchoolFields cls="12" register={register} errors={ae?.class12} gradeType={g12} years={schoolYears} />
        </Section>
        <Section title="Academic Information — Undergraduate">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Undergraduate Qualification" required error={ug?.qualification?.message}>
              <OptionSelect
                options={UG_QUALIFICATIONS}
                placeholder="Select qualification…"
                invalid={!!ug?.qualification}
                {...register('academic.ug.qualification')}
              />
            </FormField>
            <FormField label="Qualification Status" required error={ug?.status?.message}>
              <OptionSelect
                options={QUALIFICATION_STATUSES}
                placeholder="Select status…"
                invalid={!!ug?.status}
                {...register('academic.ug.status')}
              />
            </FormField>
            <FormField label="UG Institution Name" required error={ug?.institution?.message}>
              <Input maxLength={150} aria-invalid={!!ug?.institution} {...register('academic.ug.institution')} />
            </FormField>
            {/* #25: mandatory only when Completed */}
            <GradeFields
              label="UG CGPA / Percentage"
              base="academic.ug"
              register={register}
              errors={ug}
              gradeType={gUg}
              required={ugStatus === 'Completed'}
            />
            <FormField label="UG Year of Passing" required error={ug?.yearOfPassing?.message}>
              <YearSelect years={ugYears} invalid={!!ug?.yearOfPassing} {...register('academic.ug.yearOfPassing', { setValueAs: toNumber })} />
            </FormField>
            <FormField label="Medium of Instruction" required error={ug?.medium?.message}>
              <OptionSelect options={MEDIUMS} placeholder="Select medium…" invalid={!!ug?.medium} {...register('academic.ug.medium')} />
            </FormField>
          </div>
        </Section>
        <Section title="Academic Information — Higher Qualification">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Higher Qualification" required error={ae?.higherQualification?.has?.message}>
              <RadioGroup
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
                registration={register('academic.higherQualification.has')}
                invalid={!!ae?.higherQualification?.has}
              />
            </FormField>
            {String(hasHigher) === 'true' && (
              <FormField label="Qualification details" required error={ae?.higherQualification?.details?.message}>
                <Input maxLength={150} aria-invalid={!!ae?.higherQualification?.details} {...register('academic.higherQualification.details')} />
              </FormField>
            )}
          </div>
        </Section>
      </fieldset>
      <StepActions onBack={onBack} saving={isLoading} readOnly={readOnly} />
    </form>
  )
}
