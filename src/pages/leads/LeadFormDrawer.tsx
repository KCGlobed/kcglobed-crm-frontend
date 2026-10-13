import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreateLeadMutation, useDispositionOptionsQuery, useUpdateLeadMutation } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { useUserOptionsQuery } from '../../services/adminApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { Checkbox, FormField, Input, Select } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { Lead } from '../../types/models'
import { StageFields } from './StageFields'
import { STAGE_ERROR_KEYS, stageChanged, stagePayload, stageValueOf, validateStage, type StageValue } from './stageForm'

const schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required')
    .max(50, 'Max 50 characters')
    .regex(/^[A-Za-z][A-Za-z .]*$/, 'Letters, spaces and "." only'),
  lastName: z.string().trim().max(50, 'Max 50 characters').regex(/^[A-Za-z .]*$/, 'Letters, spaces and "." only').optional(),
  mobile: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|0)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, '10 digits starting with 6–9')),
  email: z.email('Enter a valid email').optional().or(z.literal('')),
  city: z.string().optional(),
  state: z.string().optional(),
  source: z.string().optional(),
  programInterest: z.string().optional(),
  cohort: z.string().optional(),
  track: z.enum(['ads', 'partner', 'other']).optional(),
  owner: z.string().optional(),
  autoAssign: z.boolean().optional(),
  referralCode: z.string().optional(),
  partnerName: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  lead?: Lead
}

export function LeadFormDrawer({ open, onClose, lead }: Props) {
  const isEdit = !!lead
  const user = useCurrentUser()
  const { data: masters } = useMasterBootstrapQuery()
  const { data: userOptions } = useUserOptionsQuery()
  // the stage picker (edit only): stages and their rules come from Masters through the disposition options
  const { data: dispositionOptions } = useDispositionOptionsQuery(undefined, { skip: !isEdit })
  const stages = useMemo(() => (dispositionOptions?.data.stages ?? []).filter((s) => !s.locked), [dispositionOptions])
  const [createLead, { isLoading: creating }] = useCreateLeadMutation()
  const [updateLead, { isLoading: updating }] = useUpdateLeadMutation()
  const [stageValue, setStageValue] = useState<StageValue>(() => stageValueOf(lead ?? {}))
  const [stageErrors, setStageErrors] = useState<Record<string, string>>({})
  // Another lead starts the picker from that lead's stage — adopted during render (like SearchInput),
  // while a refetch of the same lead keeps what the user has picked.
  const [stageLeadId, setStageLeadId] = useState(lead?._id)
  if (stageLeadId !== lead?._id) {
    setStageLeadId(lead?._id)
    setStageValue(stageValueOf(lead ?? {}))
    setStageErrors({})
  }

  const hiddenFields = useMemo(
    () => new Set(user?.fieldRules.filter((r) => r.mode !== 'masked').map((r) => r.field) ?? []),
    [user]
  )

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset(
      lead
        ? {
            firstName: lead.firstName,
            lastName: lead.lastName ?? '',
            mobile: lead.mobile ?? '',
            email: lead.email ?? '',
            city: lead.city ?? '',
            state: lead.state ?? '',
            source: lead.source?._id ?? '',
            programInterest: lead.programInterest?._id ?? '',
            cohort: lead.cohort?._id ?? '',
            track: lead.track,
            referralCode: lead.referral?.code ?? '',
            partnerName: lead.referral?.partnerName ?? '',
            customFields: (lead.customFields as Record<string, unknown>) ?? {},
          }
        : { track: 'other', autoAssign: false, customFields: {} }
    )
  }, [open, lead, reset])

  const selectedProgram = useWatch({ control, name: 'programInterest' })
  const cohorts = masters?.data.cohorts.filter((c) =>
    selectedProgram ? (typeof c.program === 'string' ? c.program : c.program._id) === selectedProgram : true
  )

  const onSubmit = async (values: FormValues) => {
    const payload: Record<string, unknown> = {
      firstName: values.firstName,
      lastName: values.lastName || undefined,
      mobile: values.mobile,
      email: values.email || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      source: values.source || undefined,
      programInterest: values.programInterest || undefined,
      cohort: values.cohort || undefined,
      track: values.track,
      customFields: values.customFields,
      ...(values.referralCode || values.partnerName
        ? { referral: { code: values.referralCode || undefined, partnerName: values.partnerName || undefined } }
        : {}),
    }
    if (lead && stageChanged(stageValue, lead)) {
      // the same checks the backend makes, so the picker can point at the field
      const local = validateStage(stageValue, stages)
      if (Object.keys(local).length) return setStageErrors(local)
      Object.assign(payload, stagePayload(stageValue, stages))
    }
    try {
      if (lead) {
        await updateLead({ id: lead._id, body: payload }).unwrap()
        toast.success('Lead updated')
      } else {
        if (values.owner) payload.owner = values.owner
        if (values.autoAssign) payload.autoAssign = true
        await createLead(payload).unwrap()
        toast.success('Lead created')
      }
      onClose()
    } catch (err) {
      // Failed submits keep the drawer open with the user's data intact (SOW §6).
      const { message, errors: fieldErrors } = parseApiError(err)
      const stageIssues: Record<string, string> = {}
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        if (STAGE_ERROR_KEYS.includes(field)) stageIssues[field] = msg
        else if (field in schema.shape) setError(field as keyof FormValues, { message: msg })
      })
      setStageErrors(stageIssues)
      toast.error(message)
    }
  }

  const customFieldDefs = masters?.data.customFields ?? []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Lead ${lead?.leadNo}` : 'Add Lead'}
      description={isEdit ? undefined : 'Walk-ins and phone enquiries go straight into the pipeline'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={creating || updating}>
            {isEdit ? 'Save Changes' : 'Create Lead'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First Name" error={errors.firstName?.message} required>
            <Input aria-invalid={!!errors.firstName} {...register('firstName')} />
          </FormField>
          <FormField label="Last Name">
            <Input {...register('lastName')} />
          </FormField>
          {!hiddenFields.has('mobile') && (
            <FormField label="Mobile" error={errors.mobile?.message} required>
              <Input aria-invalid={!!errors.mobile} placeholder="98XXXXXXXX" {...register('mobile')} />
            </FormField>
          )}
          {!hiddenFields.has('email') && (
            <FormField label="Email" error={errors.email?.message}>
              <Input aria-invalid={!!errors.email} placeholder="name@example.com" {...register('email')} />
            </FormField>
          )}
          <FormField label="City">
            <Input {...register('city')} />
          </FormField>
          <FormField label="State">
            <Input {...register('state')} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Source">
            <Select {...register('source')}>
              <option value="">Select Source</option>
              {masters?.data.sources.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Track">
            <Select {...register('track')}>
              <option value="other">Other</option>
              <option value="ads">Paid Ads</option>
              <option value="partner">Channel Partner</option>
            </Select>
          </FormField>
          <FormField label="Program Interest">
            <Select {...register('programInterest')}>
              <option value="">Select Program</option>
              {masters?.data.programs.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Cohort">
            <Select {...register('cohort')}>
              <option value="">Select Cohort</option>
              {cohorts?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Referral Code">
            <Input placeholder="e.g. CP-204" {...register('referralCode')} />
          </FormField>
          <FormField label="Partner Name">
            <Input {...register('partnerName')} />
          </FormField>
        </div>

        {customFieldDefs.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Additional Fields
            </p>
            <div className="grid grid-cols-2 gap-3">
              {customFieldDefs.map((def) => (
                <FormField key={def.key} label={def.label} required={def.required}>
                  {def.type === 'select' ? (
                    <Select {...register(`customFields.${def.key}` as never)}>
                      <option value="">Select…</option>
                      {def.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  ) : def.type === 'boolean' ? (
                    <label className="flex h-9 items-center gap-2 text-xs text-slate-600">
                      <Checkbox {...register(`customFields.${def.key}` as never)} /> Yes
                    </label>
                  ) : (
                    <Input
                      type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
                      {...register(`customFields.${def.key}` as never, {
                        setValueAs: (v) => (def.type === 'number' && v !== '' ? Number(v) : v || undefined),
                      })}
                    />
                  )}
                </FormField>
              ))}
            </div>
          </div>
        )}

        {lead && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="edit-lead-stage">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Stage</p>
            <p className="mb-3 text-xs text-slate-500">
              Current: <b className="font-medium text-slate-700">{lead.stage?.name ?? '—'}</b>
              {lead.stage?.isSystem ? ' (set by the system)' : ''}. Pick another stage to move the lead; open stages need a next follow-up.
            </p>
            <StageFields
              value={stageValue}
              onChange={(v) => {
                setStageValue(v)
                setStageErrors({})
              }}
              stages={stages}
              followUpTypes={dispositionOptions?.data.followUpTypes ?? []}
              errors={stageErrors}
              required={false}
            />
          </div>
        )}

        {!isEdit && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Checkbox {...register('autoAssign')} />
                Auto-assign via Round Robin
              </label>
              {can(user, 'leads', 'reassign') && (
                <FormField label="Or Assign Directly">
                  <Select {...register('owner')}>
                    <option value="">Leave Unassigned</option>
                    {userOptions?.data
                      .filter((u) => u.canOwnLeads !== false)
                      .map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name}
                        </option>
                      ))}
                  </Select>
                </FormField>
              )}
            </div>
          </div>
        )}
      </form>
    </Drawer>
  )
}
