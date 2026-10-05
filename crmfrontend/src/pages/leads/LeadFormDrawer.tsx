import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreateLeadMutation, useUpdateLeadMutation } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { useUserOptionsQuery } from '../../services/adminApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { Checkbox, FormField, Input, Select } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { Lead } from '../../types/models'

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
  const [createLead, { isLoading: creating }] = useCreateLeadMutation()
  const [updateLead, { isLoading: updating }] = useUpdateLeadMutation()

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
    try {
      if (isEdit) {
        await updateLead({ id: lead!._id, body: payload }).unwrap()
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
      Object.entries(fieldErrors).forEach(([field, msg]) => {
        if (field in schema.shape) setError(field as keyof FormValues, { message: msg })
      })
      toast.error(message)
    }
  }

  const customFieldDefs = masters?.data.customFields ?? []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit lead ${lead?.leadNo}` : 'Add lead'}
      description={isEdit ? undefined : 'Walk-ins and phone enquiries go straight into the pipeline'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={creating || updating}>
            {isEdit ? 'Save changes' : 'Create lead'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" error={errors.firstName?.message} required>
            <Input aria-invalid={!!errors.firstName} {...register('firstName')} />
          </FormField>
          <FormField label="Last name">
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
              <option value="">Select source</option>
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
              <option value="ads">Paid ads</option>
              <option value="partner">Channel partner</option>
            </Select>
          </FormField>
          <FormField label="Program interest">
            <Select {...register('programInterest')}>
              <option value="">Select program</option>
              {masters?.data.programs.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Cohort">
            <Select {...register('cohort')}>
              <option value="">Select cohort</option>
              {cohorts?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Referral code">
            <Input placeholder="e.g. CP-204" {...register('referralCode')} />
          </FormField>
          <FormField label="Partner name">
            <Input {...register('partnerName')} />
          </FormField>
        </div>

        {customFieldDefs.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Additional fields
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

        {!isEdit && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Checkbox {...register('autoAssign')} />
                Auto-assign via round-robin
              </label>
              {can(user, 'leads', 'reassign') && (
                <FormField label="Or assign directly">
                  <Select {...register('owner')}>
                    <option value="">Leave unassigned</option>
                    {userOptions?.data.map((u) => (
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
