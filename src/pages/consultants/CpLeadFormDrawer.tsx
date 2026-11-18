import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useCpCreateLeadMutation, useCpMetaQuery, useCpUpdateLeadMutation, useLazyCpCheckDuplicateQuery } from '../../services/consultantsApi'
import { useCurrentUser } from '../../app/hooks'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { FieldGroup, FormField, Input, Select } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { CpDuplicateCheck, CpLeadDetail } from '../../types/consultants'
import { cpLeadPath, localInputToIso } from './cpShared'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** the backend's MobileField: 7–16 characters of digits, spaces and hyphens, an optional leading + */
const validPhone = (v: string) => v.length >= 7 && v.length <= 16 && /^[+\d][\d\s-]+$/.test(v) && v.replace(/\D/g, '').length >= 7
const COUNT = /^\d+$/
const validCount = (v: string) => !v || (COUNT.test(v) && Number(v) <= 1_000_000)

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Max 120 characters'),
  mobile: z.string().trim().min(1, 'Mobile is required').refine(validPhone, 'Enter a valid mobile number'),
  email: z.string().trim().max(254, 'Max 254 characters').refine((v) => !v || EMAIL.test(v), 'Enter a valid email'),
  altMobile: z.string().trim().refine((v) => !v || validPhone(v), 'Enter a valid mobile number'),
  firmName: z.string().trim().max(200, 'Max 200 characters'),
  city: z.string().trim().max(100, 'Max 100 characters'),
  state: z.string().trim().max(100, 'Max 100 characters'),
  businessType: z.string(),
  teamSize: z.string().trim().refine(validCount, 'A whole number, 0 or more'),
  studentsPerYear: z.string().trim().refine(validCount, 'A whole number, 0 or more'),
  website: z.string().trim().max(200, 'Max 200 characters'),
  source: z.string(),
  owner: z.string(),
  nextFollowUpAt: z.string().refine((v) => !v || new Date(v).getTime() > Date.now(), 'Pick a date and time in the future'),
})
type FormValues = z.infer<typeof schema>
type FieldName = keyof FormValues

/** the API field a server error may name → the form field it belongs under */
const ERROR_FIELDS: Record<string, FieldName> = {
  name: 'name', mobile: 'mobile', email: 'email', altMobile: 'altMobile', firmName: 'firmName', city: 'city',
  state: 'state', businessType: 'businessType', teamSize: 'teamSize', studentsPerYear: 'studentsPerYear',
  website: 'website', source: 'source', owner: 'owner', nextFollowUpAt: 'nextFollowUpAt', dueAt: 'nextFollowUpAt',
}
/** the details an edit may change (owner goes through Assign, the follow-up through Log Call) */
const DETAIL_KEYS = [
  'name', 'mobile', 'email', 'altMobile', 'firmName', 'city', 'state', 'businessType', 'teamSize', 'studentsPerYear',
  'website', 'source',
] as const

function defaultsOf(lead: CpLeadDetail | null): FormValues {
  return {
    name: lead?.name ?? '',
    mobile: lead?.mobile ?? '',
    email: lead?.email ?? '',
    altMobile: lead?.altMobile ?? '',
    firmName: lead?.firmName ?? '',
    city: lead?.city ?? '',
    state: lead?.state ?? '',
    businessType: lead?.businessType ?? '',
    teamSize: lead?.teamSize != null ? String(lead.teamSize) : '',
    studentsPerYear: lead?.studentsPerYear != null ? String(lead.studentsPerYear) : '',
    website: lead?.website ?? '',
    source: lead?.source?._id ?? '',
    owner: '',
    nextFollowUpAt: '',
  }
}

/** The API body for the details: empty text → null, counts as numbers. */
function detailsOf(v: FormValues): Record<(typeof DETAIL_KEYS)[number], string | number | null> {
  const text = (s: string) => s.trim() || null
  const count = (s: string) => (s.trim() ? Number(s.trim()) : null)
  return {
    name: v.name.trim(),
    mobile: v.mobile.trim(),
    email: text(v.email),
    altMobile: text(v.altMobile),
    firmName: text(v.firmName),
    city: text(v.city),
    state: text(v.state),
    businessType: text(v.businessType),
    teamSize: count(v.teamSize),
    studentsPerYear: count(v.studentsPerYear),
    website: text(v.website),
    source: v.source || null,
  }
}

interface Props {
  open: boolean
  onClose: () => void
  /** given: Edit that lead; left out: Add a new one */
  lead?: CpLeadDetail | null
}

/**
 * Add or edit a Channel Partners (consultant) lead. Mounted fresh on every open, so the form always starts from the
 * lead as it is now; a refetch while the drawer is open leaves what the user typed alone.
 */
export default function CpLeadFormDrawer({ open, onClose, lead }: Props) {
  if (!open) return null
  return <CpLeadForm key={lead?._id ?? 'new'} lead={lead ?? null} onClose={onClose} />
}

type DupField = 'mobile' | 'email'
/** a duplicate-check answer, tagged with the value it was for so a stale answer never shows */
type DupAnswer = { value: string; result: CpDuplicateCheck }

function CpLeadForm({ lead, onClose }: { lead: CpLeadDetail | null; onClose: () => void }) {
  const isEdit = !!lead
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { data: meta, isLoading: metaLoading } = useCpMetaQuery()
  const [createLead, { isLoading: creating }] = useCpCreateLeadMutation()
  const [updateLead, { isLoading: updating }] = useCpUpdateLeadMutation()
  const [checkDuplicate] = useLazyCpCheckDuplicateQuery()
  const [dupes, setDupes] = useState<Partial<Record<DupField, DupAnswer>>>({})

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaultsOf(lead) })
  const [mobile, email] = useWatch({ control, name: ['mobile', 'email'] })

  const runCheck = (field: DupField, raw: string) => {
    const value = raw.trim()
    const checkable = field === 'mobile' ? validPhone(value) : EMAIL.test(value)
    // the lead's own number or email needs no check: it is already this lead
    const own = !!lead && value.toLowerCase() === (lead[field] ?? '').toLowerCase()
    if (!checkable || own) {
      setDupes((d) => ({ ...d, [field]: undefined }))
      return
    }
    checkDuplicate({ ...(field === 'mobile' ? { mobile: value } : { email: value }), exclude: lead?._id })
      .unwrap()
      .then((r) => setDupes((d) => ({ ...d, [field]: { value, result: r.data } })))
      .catch(() => setDupes((d) => ({ ...d, [field]: undefined })))
  }
  const answerFor = (field: DupField, current: string | undefined) => {
    const answer = dupes[field]
    return answer && answer.value === (current ?? '').trim() ? answer.result : null
  }
  const mobileDup = answerFor('mobile', mobile)
  const emailDup = answerFor('email', email)
  const blocked = !!(mobileDup?.consultant || emailDup?.consultant)

  // a value already on the lead stays choosable even when Masters no longer lists it
  const businessTypes = [...(meta?.data.businessTypes ?? [])]
  if (lead?.businessType && !businessTypes.includes(lead.businessType)) businessTypes.push(lead.businessType)
  const sources = [...(meta?.data.sources ?? [])]
  if (lead?.source && !sources.some((s) => s._id === lead.source?._id)) sources.push(lead.source)
  const owners = meta?.data.owners ?? []

  const openLead = (id: string) => {
    onClose()
    navigate(cpLeadPath(id))
  }

  const onSubmit = async (values: FormValues) => {
    if (blocked) return
    const details = detailsOf(values)
    try {
      if (lead) {
        const before = detailsOf(defaultsOf(lead))
        const body = Object.fromEntries(DETAIL_KEYS.filter((k) => details[k] !== before[k]).map((k) => [k, details[k]]))
        if (!Object.keys(body).length) {
          toast.info('Nothing changed')
          onClose()
          return
        }
        const res = await updateLead({ id: lead._id, body }).unwrap()
        toast.success(`${res.data.leadNo} updated`)
        if (res.data.studentDuplicate && res.data.studentDuplicate.leadNo !== lead.studentDuplicate?.leadNo) {
          toast.warning(`Also a student lead ${res.data.studentDuplicate.leadNo} — flagged, not merged`)
        }
      } else {
        const body: Record<string, unknown> = Object.fromEntries(Object.entries(details).filter(([, v]) => v !== null))
        if (values.owner) body.owner = values.owner
        const due = localInputToIso(values.nextFollowUpAt)
        if (due) body.nextFollowUpAt = due
        const res = await createLead(body).unwrap()
        const created = res.data
        toast.success(`Lead ${created.leadNo} added${created.owner ? ` · owner ${created.owner.name}` : ' · unassigned'}`, {
          action: { label: 'Open', onClick: () => navigate(cpLeadPath(created._id)) },
        })
        if (created.studentDuplicate) {
          toast.warning(`Also a student lead ${created.studentDuplicate.leadNo} — flagged, not merged`)
        }
      }
      onClose()
    } catch (err) {
      // a failed save keeps the drawer open with what was typed
      const { message, errors: fieldErrors } = parseApiError(err)
      Object.entries(fieldErrors).forEach(([key, msg]) => {
        const field = ERROR_FIELDS[key]
        if (field) setError(field, { message: String(msg) })
      })
      toast.error(message)
    }
  }

  const dupNotice = (dup: CpDuplicateCheck | null) => {
    if (!dup) return null
    return (
      <>
        {dup.consultant && (
          <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">
                Already Channel Partners lead {dup.consultant.leadNo} ({dup.consultant.name}, {dup.consultant.stage},{' '}
                {dup.consultant.owner || 'Unassigned'})
              </p>
              <button type="button" className="mt-0.5 font-medium underline" onClick={() => openLead(dup.consultant!._id)}>
                Open {dup.consultant.leadNo}
              </button>
            </div>
          </div>
        )}
        {dup.student && (
          <div role="status" className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Also a student lead {dup.student.leadNo} — it will be flagged, not merged</p>
          </div>
        )}
      </>
    )
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={lead ? `Edit ${lead.leadNo}` : 'Add Partner Lead'}
      description={
        lead
          ? 'Contact and business details. The owner changes through Assign, the stage through Log Call.'
          : 'A consultant or agency who may become a Channel Partner. Starts in the first open stage.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            loading={creating || updating}
            disabled={blocked}
            title={blocked ? 'This mobile or email is already on another Channel Partners lead' : undefined}
            data-testid="cp-lead-save"
          >
            {isEdit ? 'Save Changes' : 'Save Lead'}
          </Button>
        </>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate data-testid="cp-lead-form">
        <FieldGroup title="Contact">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Name" error={errors.name?.message} required className="sm:col-span-2">
              <Input {...register('name')} placeholder="Contact person, e.g. Rohit Mehta" autoFocus aria-invalid={!!errors.name} />
            </FormField>
            <div className="space-y-1.5">
              <FormField label="Mobile" error={errors.mobile?.message} required hint="Add the country code for a number outside India">
                <Input
                  type="tel"
                  inputMode="tel"
                  placeholder="98765 43210"
                  aria-invalid={!!errors.mobile || !!mobileDup?.consultant}
                  {...register('mobile', { onBlur: (e) => runCheck('mobile', e.target.value) })}
                />
              </FormField>
              {dupNotice(mobileDup)}
            </div>
            <div className="space-y-1.5">
              <FormField label="Email" error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  aria-invalid={!!errors.email || !!emailDup?.consultant}
                  {...register('email', { onBlur: (e) => runCheck('email', e.target.value) })}
                />
              </FormField>
              {dupNotice(emailDup)}
            </div>
            <FormField label="Alternate Mobile" error={errors.altMobile?.message}>
              <Input type="tel" inputMode="tel" aria-invalid={!!errors.altMobile} {...register('altMobile')} />
            </FormField>
          </div>
        </FieldGroup>

        <FieldGroup title="Business">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Firm Name" error={errors.firmName?.message}>
              <Input placeholder="e.g. Mehta Overseas Consultants" aria-invalid={!!errors.firmName} {...register('firmName')} />
            </FormField>
            <FormField label="Business Type" error={errors.businessType?.message}>
              <Select {...register('businessType')} aria-invalid={!!errors.businessType}>
                <option value="">—</option>
                {businessTypes.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="City" error={errors.city?.message}>
              <Input aria-invalid={!!errors.city} {...register('city')} />
            </FormField>
            <FormField label="State" error={errors.state?.message}>
              <Input aria-invalid={!!errors.state} {...register('state')} />
            </FormField>
            <FormField label="Team Size" error={errors.teamSize?.message}>
              <Input type="number" min={0} step={1} inputMode="numeric" aria-invalid={!!errors.teamSize} {...register('teamSize')} />
            </FormField>
            <FormField label="Students a Year" error={errors.studentsPerYear?.message} hint="Roughly how many students they send a year">
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                aria-invalid={!!errors.studentsPerYear}
                {...register('studentsPerYear')}
              />
            </FormField>
            <FormField label="Website" error={errors.website?.message}>
              <Input inputMode="url" placeholder="e.g. mehtaoverseas.in" aria-invalid={!!errors.website} {...register('website')} />
            </FormField>
            <FormField label="Source" error={errors.source?.message}>
              <Select {...register('source')} aria-invalid={!!errors.source} disabled={metaLoading}>
                <option value="">{metaLoading ? 'Loading…' : '—'}</option>
                {sources.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </FieldGroup>

        {!isEdit && (
          <FieldGroup title="Assignment & follow-up">
            <div className="grid gap-3 sm:grid-cols-2">
              {owners.length > 0 && (
                <FormField
                  label="Assign To"
                  error={errors.owner?.message}
                  hint={user?.dataScope === 'own' && !user.isSuperAdmin ? 'Leave empty and it is yours' : 'Leave empty to keep it unassigned'}
                >
                  <Select {...register('owner')} aria-invalid={!!errors.owner}>
                    <option value="">—</option>
                    {owners.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              <FormField label="Next Follow-up" error={errors.nextFollowUpAt?.message} hint="Optional · a call follow-up for the owner">
                <Input type="datetime-local" aria-invalid={!!errors.nextFollowUpAt} {...register('nextFollowUpAt')} />
              </FormField>
            </div>
          </FieldGroup>
        )}
      </form>
    </Drawer>
  )
}
