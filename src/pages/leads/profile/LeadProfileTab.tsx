import { useState, type FormEvent } from 'react'
import { Check, Lock, LockOpen, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  useAcceptLeadProfileDeclarationMutation,
  useLeadProfileQuery,
  useSaveLeadProfileStepMutation,
  useUnlockLeadProfileMutation,
} from '../../../services/leadsApi'
import { useCurrentUser } from '../../../app/hooks'
import { can } from '../../../constants/permissions'
import { Badge } from '../../../components/ui/Badge'
import { Checkbox, FormField, Textarea } from '../../../components/ui/fields'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { ErrorState, Skeleton } from '../../../components/ui/feedback'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import type { LeadProfile, ProfileStepKey } from '../../../types/models'
import { PersonalStep } from './PersonalStep'
import { AcademicStep } from './AcademicStep'
import { WorkStep } from './WorkStep'
import { DocumentsStep } from './DocumentsStep'
import { Section, PROFILE_STEP_FORM, PROFILE_STEP_SAVE } from './ProfileFields'

const STEPS: { key: ProfileStepKey | 'documents' | 'declaration'; label: string }[] = [
  { key: 'personal', label: 'Personal & Guardian' },
  { key: 'academic', label: 'Academic' },
  { key: 'work', label: 'Work Experience' },
  { key: 'documents', label: 'Documents' },
  { key: 'declaration', label: 'Declaration' },
]

function DeclarationStep({
  leadId,
  profile,
  readOnly,
}: {
  leadId: string
  profile: LeadProfile
  readOnly: boolean
}) {
  const [accept] = useAcceptLeadProfileDeclarationMutation({ fixedCacheKey: PROFILE_STEP_SAVE })
  const [checked, setChecked] = useState(profile.declaration.accepted)
  const [error, setError] = useState<string | null>(null)
  const pending = STEPS.filter((s) => s.key !== 'declaration' && !profile.steps[s.key as ProfileStepKey | 'documents'])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!checked) {
      setError('Accept the declaration to continue')
      return
    }
    try {
      const res = await accept(leadId).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <form id={PROFILE_STEP_FORM} onSubmit={onSubmit} noValidate className="space-y-4">
      <Section title="Declaration">
        {pending.length > 0 && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Complete {pending.map((s) => s.label).join(', ')} before accepting the declaration.
          </p>
        )}
        {profile.declaration.accepted ? (
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <Badge tone="green">
              <Check className="h-3 w-3" /> Accepted
            </Badge>
            on {formatDateTime(profile.declaration.acceptedAt)}
            {profile.declaration.textVersion && <span className="text-xs text-slate-400">(text {profile.declaration.textVersion})</span>}
          </p>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <Checkbox
                className="mt-0.5"
                checked={checked}
                disabled={readOnly}
                aria-invalid={!!error}
                onChange={(e) => {
                  setChecked(e.target.checked)
                  setError(null)
                }}
              />
              {profile.declarationText}
            </label>
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </>
        )}
      </Section>
    </form>
  )
}

/** Candidate profile form (User Profile Form Fields doc) on the lead page. */
function UnlockModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [unlock, { isLoading }] = useUnlockLeadProfileMutation()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const onSubmit = async () => {
    if (reason.trim().length < 3) return setError('Enter a reason for unlocking')
    try {
      const res = await unlock({ id: leadId, reason: reason.trim() }).unwrap()
      toast.success(res.message)
      onClose()
    } catch (err) {
      const { message, errors } = parseApiError(err)
      setError(errors.reason ?? message)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Unlock Profile"
      description="The declaration is withdrawn and the profile becomes editable again."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isLoading}>
            Unlock
          </Button>
        </>
      }
    >
      <FormField label="Reason" required error={error ?? undefined}>
        <Textarea rows={3} maxLength={500} value={reason} aria-invalid={!!error} onChange={(e) => setReason(e.target.value)} />
      </FormField>
    </Modal>
  )
}

export function LeadProfileTab({ leadId }: { leadId: string }) {
  const user = useCurrentUser()
  const { data, isLoading, isError, error, refetch } = useLeadProfileQuery(leadId)
  const [step, setStep] = useState(0)
  const [unlockOpen, setUnlockOpen] = useState(false)
  // like the Counsellor Discussion: read-only until Edit is pressed, so nothing changes by accident
  const [editing, setEditing] = useState(false)
  // bumped on Cancel so every step remounts and drops what was typed but not saved
  const [resetKey, setResetKey] = useState(0)
  const [, { isLoading: savingStep }] = useSaveLeadProfileStepMutation({ fixedCacheKey: PROFILE_STEP_SAVE })
  const [, { isLoading: accepting }] = useAcceptLeadProfileDeclarationMutation({ fixedCacheKey: PROFILE_STEP_SAVE })
  const saving = savingStep || accepting

  if (isError) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />
  if (isLoading || !data) return <Skeleton className="h-96 w-full" />

  const profile = data.data
  // LM-17: locked after the declaration until an admin unlocks it
  const canEdit = can(user, 'leads', 'edit') && !profile.locked
  const readOnly = !canEdit || !editing
  const cancelEdit = () => {
    setEditing(false)
    setResetKey((k) => k + 1)
  }
  const isDone = (key: (typeof STEPS)[number]['key']) =>
    key === 'declaration' ? profile.declaration.accepted : profile.steps[key]
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const current = STEPS[step].key
  const props = { leadId, profile, readOnly }
  const formKey = `${profile.updatedAt ?? 'new'}-${resetKey}`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-48 flex-1 items-center gap-3">
          <span className="text-xs font-medium text-slate-600">Profile Completion</span>
          <div className="h-2 max-w-64 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={profile.completionPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${profile.completionPercent}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-700">{profile.completionPercent}%</span>
        </div>
        {profile.locked ? (
          <div className="flex items-center gap-2">
            <Badge tone="violet">
              <Lock className="h-3 w-3" /> Locked After Declaration
            </Badge>
            {(user?.isSuperAdmin || user?.role === 'admin') && (
              <Button variant="outline" size="sm" onClick={() => setUnlockOpen(true)}>
                <LockOpen className="h-3.5 w-3.5" /> Unlock
              </Button>
            )}
          </div>
        ) : (
          canEdit && (
            <div className="flex items-center gap-2" data-testid="profile-edit-actions">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  {current === 'documents' ? (
                    <Button size="sm" onClick={next}>
                      Next
                    </Button>
                  ) : current === 'declaration' ? (
                    !profile.declaration.accepted && (
                      <Button size="sm" type="submit" form={PROFILE_STEP_FORM} loading={saving}>
                        Submit
                      </Button>
                    )
                  ) : (
                    <Button size="sm" type="submit" form={PROFILE_STEP_FORM} loading={saving}>
                      Save & Next
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </div>
          )
        )}
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={step === i ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                step === i ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  isDone(s.key) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                )}
              >
                {isDone(s.key) ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">Step {i + 1}</span>
                <span className="block truncate text-xs font-medium text-slate-700">{s.label}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* key: remount with fresh defaults whenever the saved profile changes, or editing is cancelled */}
      {step === 0 && <PersonalStep key={formKey} {...props} onSaved={next} />}
      {step === 1 && <AcademicStep key={formKey} {...props} onSaved={next} />}
      {step === 2 && <WorkStep key={formKey} {...props} onSaved={next} />}
      {step === 3 && <DocumentsStep leadId={leadId} readOnly={readOnly} />}
      {step === 4 && <DeclarationStep key={formKey} {...props} />}
      {unlockOpen && <UnlockModal leadId={leadId} onClose={() => setUnlockOpen(false)} />}
    </div>
  )
}
