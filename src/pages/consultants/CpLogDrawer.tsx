import { useState, type ReactNode } from 'react'
import { CircleCheck, FileText, GraduationCap, Info, Lock, PhoneCall, PhoneOff, ShieldCheck, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useCpDocumentsQuery, useCpLogMutation, useCpMetaQuery } from '../../services/consultantsApi'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { Skeleton } from '../../components/ui/feedback'
import { cn, parseApiError } from '../../lib/utils'
import type { CpLeadDetail, CpLogBody, CpStage, CpSubStage } from '../../types/consultants'
import { CpStageBadge } from './CpStageBadge'
import { CP_STAGE_TYPES, isoToLocalInput, localInputToIso } from './cpShared'

type Errors = Record<string, string>

/** A datetime-local value later than now. */
const inFuture = (local: string) => new Date(local).getTime() > Date.now()

/** A coloured note under a field: what the chosen stage / sub-stage will do or needs. */
function Note({ tone, icon: Icon, children, testId }: { tone: 'info' | 'warn' | 'ok' | 'danger'; icon: typeof Info; children: ReactNode; testId?: string }) {
  const tones = {
    info: 'bg-sky-50 text-sky-900 ring-sky-100',
    warn: 'bg-amber-50 text-amber-900 ring-amber-100',
    ok: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
    danger: 'bg-red-50 text-red-800 ring-red-100',
  }
  return (
    <div className={cn('flex gap-2 rounded-lg px-3 py-2 text-xs leading-5 ring-1 ring-inset', tones[tone])} data-testid={testId}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** A small flag on a sub-stage option (Remark required, Manager approval, …). */
function Flag({ tone, children }: { tone: 'amber' | 'slate' | 'red' | 'green' | 'sky'; children: ReactNode }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-800 ring-amber-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    red: 'bg-red-50 text-red-700 ring-red-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium ring-1 ring-inset', tones[tone])}>{children}</span>
}

/**
 * Log Call / Update stage on a Channel Partners lead (POST /consultants/leads/:id/log). The form explains the backend's
 * rules before the user saves: the sub-stage a stage needs, a remark, a document already on the lead or a manager's
 * approval a sub-stage needs, the entry sub-stage a stage opens after, the not-connected attempt count, and the next
 * follow-up every Open stage needs (Won / Closed stages need none; the open follow-up is closed either way).
 */
function CpLogForm({ lead, withCall, onClose }: { lead: CpLeadDetail; withCall: boolean; onClose: () => void }) {
  const { data: metaRes, isLoading: metaLoading } = useCpMetaQuery()
  const { data: docsRes } = useCpDocumentsQuery(lead._id)
  const [logUpdate, { isLoading: saving }] = useCpLogMutation()
  const meta = metaRes?.data
  const stages = meta?.stages ?? []

  const [call, setCall] = useState(withCall)
  // the lead's current stage and sub-stage to start with
  const [stageId, setStageId] = useState(lead.stage._id)
  const [subStageId, setSubStageId] = useState(lead.subStage?._id ?? '')
  const [remark, setRemark] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [followUpType, setFollowUpType] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const stage = stages.find((s) => s._id === stageId)
  // the sub-stage in effect: only one the chosen stage offers
  const sub = stage?.subStages.find((s) => s._id === subStageId)
  const isOpenStage = stage?.type === 'open'
  const followUpTypes = meta?.followUpTypes ?? []
  const fuType = followUpType || followUpTypes[0]?.value || 'call'
  const maxAttempts = meta?.settings.maxAttempts ?? 0
  const nextAttempt = lead.attempts + 1

  const docTypes = docsRes?.data.types ?? []
  const docLabel = (key: string) => docTypes.find((t) => t.type === key)?.label ?? key
  const hasDoc = (key: string) => !!docsRes?.data.documents.some((d) => d.type === key && !d.deletedAt)
  const subStageName = (id: string) => stages.flatMap((s) => s.subStages).find((s) => s._id === id)?.name
  const dropSub = meta?.settings.dropSubStage ?? null
  const dropStage = dropSub ? stages.find((s) => s.subStages.some((x) => x._id === dropSub)) : undefined
  const isCurrentSub = (s: CpSubStage) => s._id === lead.subStage?._id
  // the backend lets anyone keep the lead's current sub-stage; a new approval sub-stage needs Approve
  const approvalBlocked = (s: CpSubStage) => s.needsApproval && !meta?.canApprove && !isCurrentSub(s)
  // the stage opens only after its entry sub-stage was recorded; the server checks the full history
  const gateOf = (s: CpStage) =>
    s.entrySubStage && s._id !== lead.stage._id && lead.subStage?._id !== s.entrySubStage
      ? (subStageName(s.entrySubStage) ?? 'its entry sub-stage')
      : null

  const clear = (...keys: string[]) =>
    setErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev
      const next = { ...prev }
      keys.forEach((k) => delete next[k])
      return next
    })

  const pickStage = (s: CpStage) => {
    setStageId(s._id)
    // keep the lead's sub-stage when going back to its own stage
    setSubStageId(s._id === lead.stage._id ? (lead.subStage?._id ?? '') : '')
    setErrors({})
  }

  const validate = (): Errors => {
    const found: Errors = {}
    if (!stage) {
      found.stage = 'Pick a stage'
      return found
    }
    if (stage.subStages.length && !sub) found.subStage = 'Pick a sub-stage'
    if (sub && approvalBlocked(sub)) found.subStage = `Only a manager with Approve on Channel Partners leads can record "${sub.name}"`
    else if (sub?.requiredDocument && docsRes && !hasDoc(sub.requiredDocument)) {
      found.subStage = `Upload the ${docLabel(sub.requiredDocument)} on this lead before recording "${sub.name}"`
    }
    if (sub?.requiresRemark && !remark.trim()) found.remark = `A remark is required for "${sub.name}"`
    if (isOpenStage) {
      if (!followUpAt) found.nextFollowUpAt = 'Set the next follow-up date and time'
      else if (!inFuture(followUpAt)) found.nextFollowUpAt = 'The next follow-up must be in the future'
    }
    return found
  }

  const onSave = async () => {
    if (lead.locked) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) {
      toast.error(Object.values(found)[0])
      return
    }
    const body: CpLogBody = {
      call,
      stage: stageId,
      subStage: sub?._id ?? null,
      remark: remark.trim() || undefined,
      ...(isOpenStage
        ? { nextFollowUpAt: localInputToIso(followUpAt), followUpType: fuType, followUpNotes: followUpNotes.trim() || undefined }
        : {}),
    }
    try {
      const res = await logUpdate({ id: lead._id, body }).unwrap()
      const after = res.data
      toast.success(call ? 'Call logged' : 'Stage updated')
      // the attempt limit moved the lead somewhere else than picked
      if (after && after.stage._id !== stageId) {
        toast.message(`Moved to ${after.stage.name}${after.subStage ? ` · ${after.subStage.name}` : ''} after ${after.attempts || nextAttempt} attempts`)
      }
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  // Open stages first, then Won, then Closed (each in its Lead Stages order)
  const groups = CP_STAGE_TYPES.map((t) => ({ ...t, stages: stages.filter((s) => s.type === t.value) })).filter((g) => g.stages.length)
  const gate = stage ? gateOf(stage) : null
  const remarkRequired = !!sub?.requiresRemark
  const nowInput = isoToLocalInput(new Date().toISOString())

  return (
    <Drawer
      open
      onClose={onClose}
      title={call ? 'Log call' : 'Update stage'}
      description={`${lead.name}${lead.firmName ? ` · ${lead.firmName}` : ''} · ${lead.leadNo} · now ${lead.stage.name}${lead.subStage ? ` · ${lead.subStage.name}` : ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving} disabled={lead.locked || metaLoading || !stage} data-testid="cp-log-save">
            {call ? 'Log Call' : 'Update Stage'}
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-testid="cp-log-drawer">
        {lead.locked && (
          <Note tone="ok" icon={Lock} testId="cp-log-locked">
            <b>Onboarded — locked.</b> This partner is onboarded; the lead's stage can no longer change.
          </Note>
        )}

        {/* a call was made, or only the stage changes */}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="What happened">
          {[
            { value: true, label: 'Call made', hint: 'Logged as a call on the lead', icon: PhoneCall, testId: 'cp-log-mode-call' },
            { value: false, label: 'Update stage without a call', hint: 'No call is logged', icon: PhoneOff, testId: 'cp-log-mode-update' },
          ].map((m) => (
            <button
              key={m.testId}
              type="button"
              role="radio"
              aria-checked={call === m.value}
              data-testid={m.testId}
              onClick={() => setCall(m.value)}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                call === m.value ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              <m.icon className={cn('mt-0.5 h-4 w-4 shrink-0', call === m.value ? 'text-brand-600' : 'text-slate-400')} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-800">{m.label}</span>
                <span className="block text-[11px] text-slate-500">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {/* stage: a compact grid, grouped Open → Won → Closed, in the stages' own colours */}
        <FormField label="Stage" required error={errors.stage}>
          {metaLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <div className="space-y-2.5" role="radiogroup" aria-label="Stage" data-testid="cp-log-stage">
              {groups.map((g) => (
                <div key={g.value}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400" title={g.hint}>
                    {g.label} stages
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {g.stages.map((s) => {
                      const selected = s._id === stageId
                      const opensAfter = gateOf(s)
                      return (
                        <button
                          key={s._id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={s.name}
                          data-testid={`cp-log-stage-${s._id}`}
                          onClick={() => pickStage(s)}
                          title={opensAfter ? `Opens after ${opensAfter}` : undefined}
                          className={cn(
                            'flex min-w-0 flex-col items-start gap-1 rounded-lg border px-2 py-1.5 text-left transition',
                            selected ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <CpStageBadge stage={s} className="max-w-full truncate" />
                          {(s._id === lead.stage._id || s.countsAsAttempt || opensAfter) && (
                            <span className="flex flex-wrap gap-1 text-[10px] leading-4 text-slate-500">
                              {s._id === lead.stage._id && <span className="font-medium text-brand-700">Current</span>}
                              {s.countsAsAttempt && <span>Counts as attempt</span>}
                              {opensAfter && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Lock className="h-2.5 w-2.5" /> Gated
                                </span>
                              )}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              {!groups.length && <p className="text-xs text-slate-400">No active stages. Add them in Channel Partners → Lead Stages.</p>}
            </div>
          )}
        </FormField>

        {stage && (
          <div className="space-y-2" data-testid="cp-log-stage-notes">
            {gate && (
              <Note tone="warn" icon={Lock} testId="cp-log-gate">
                Opens after <b>{gate}</b>. {stage.name} can be chosen only once that sub-stage was recorded on this lead.
              </Note>
            )}
            {stage.countsAsAttempt &&
              (call ? (
                <Note tone={maxAttempts && nextAttempt >= maxAttempts ? 'danger' : 'warn'} icon={PhoneOff} testId="cp-log-attempt">
                  A not-connected call: <b>Attempt {nextAttempt} of {maxAttempts || '—'}</b> — at the limit the lead moves to{' '}
                  {dropStage ? <b>{dropStage.name}</b> : 'Dropped'}
                  {maxAttempts && nextAttempt >= maxAttempts ? '. This call reaches the limit.' : '.'}
                </Note>
              ) : (
                <Note tone="info" icon={Info} testId="cp-log-attempt">
                  Without a call no attempt is counted (now {lead.attempts} of {maxAttempts || '—'}).
                </Note>
              ))}
            {stage.type === 'won' && (
              <Note tone="ok" icon={ShieldCheck}>
                {stage.name} is a Won stage: saving locks the lead, its stage can no longer change. The open follow-up is closed; none is
                needed.
              </Note>
            )}
            {stage.type === 'closed' && (
              <Note tone="info" icon={Info}>
                {stage.name} closes the lead: the open follow-up is closed and no new one is needed.
              </Note>
            )}
          </div>
        )}

        {/* sub-stage: the chosen stage's active sub-stages, with what each needs */}
        {!!stage?.subStages.length && (
          <FormField label="Sub-stage" required error={errors.subStage}>
            <div className="space-y-1" role="radiogroup" aria-label="Sub-stage" data-testid="cp-log-substage">
              {stage.subStages.map((s) => {
                const blocked = approvalBlocked(s)
                const docOk = s.requiredDocument ? hasDoc(s.requiredDocument) : true
                return (
                  <label
                    key={s._id}
                    data-testid={`cp-log-substage-${s._id}`}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
                      blocked ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400' : 'cursor-pointer',
                      !blocked && (s._id === subStageId ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300')
                    )}
                  >
                    <input
                      type="radio"
                      name="cp-log-substage"
                      value={s._id}
                      checked={s._id === subStageId}
                      disabled={blocked}
                      onChange={() => {
                        setSubStageId(s._id)
                        clear('subStage', 'remark')
                      }}
                      className="mt-0.5 h-3.5 w-3.5 accent-brand-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn('font-medium', blocked ? 'text-slate-400' : 'text-slate-800')}>{s.name}</span>
                      {isCurrentSub(s) && <span className="ml-1.5 text-[10px] font-medium text-brand-700">Current</span>}
                      {(s.requiresRemark || s.requiredDocument || s.needsApproval || s.movesToStudent) && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {s.requiresRemark && <Flag tone="amber">Remark required</Flag>}
                          {s.requiredDocument && (
                            <Flag tone={!docsRes ? 'slate' : docOk ? 'green' : 'red'}>
                              <FileText className="h-2.5 w-2.5" /> Needs {docLabel(s.requiredDocument)}
                              {docsRes && (docOk ? ' · on file' : ' · not uploaded')}
                            </Flag>
                          )}
                          {s.needsApproval && (
                            <Flag tone={blocked ? 'slate' : 'sky'}>
                              {blocked ? <Lock className="h-2.5 w-2.5" /> : <ShieldCheck className="h-2.5 w-2.5" />} Manager approval
                            </Flag>
                          )}
                          {s.movesToStudent && (
                            <Flag tone="slate">
                              <GraduationCap className="h-2.5 w-2.5" /> Student
                            </Flag>
                          )}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </FormField>
        )}

        {sub && (
          <div className="space-y-2" data-testid="cp-log-substage-notes">
            {sub.needsApproval &&
              (approvalBlocked(sub) ? (
                <Note tone="danger" icon={Lock}>
                  Manager approval: only a manager with Approve on Channel Partners leads can record "{sub.name}".
                </Note>
              ) : (
                <Note tone="info" icon={ShieldCheck}>
                  Manager approval: "{sub.name}" is recorded with your approval.
                </Note>
              ))}
            {sub.requiredDocument &&
              (!docsRes || hasDoc(sub.requiredDocument) ? (
                <Note tone="ok" icon={CircleCheck} testId="cp-log-doc-hint">
                  "{sub.name}" needs the <b>{docLabel(sub.requiredDocument)}</b> on this lead{docsRes ? ' — it is on file.' : '.'}
                </Note>
              ) : (
                <Note tone="warn" icon={FileText} testId="cp-log-doc-hint">
                  "{sub.name}" needs the <b>{docLabel(sub.requiredDocument)}</b> on this lead. Upload it in the Documents tab first.
                </Note>
              ))}
            {sub.movesToStudent && (
              <Note tone="info" icon={GraduationCap} testId="cp-log-student-note">
                Move to student Leads comes in phase 2; the lead will be closed here.
              </Note>
            )}
          </div>
        )}

        <FormField
          label="Remark"
          required={remarkRequired}
          error={errors.remark}
          hint={remarkRequired ? 'Remark required' : call ? 'What was discussed on the call' : 'Why the stage changes'}
        >
          <Textarea
            rows={3}
            maxLength={2000}
            value={remark}
            onChange={(e) => {
              setRemark(e.target.value)
              clear('remark')
            }}
            aria-invalid={!!errors.remark}
            data-testid="cp-log-remark"
          />
        </FormField>

        {isOpenStage ? (
          <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
            <p className="text-xs font-semibold text-brand-800">Next follow-up (required for an Open stage)</p>
            <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr]">
              <FormField label="Date & Time" required error={errors.nextFollowUpAt}>
                <Input
                  type="datetime-local"
                  min={nowInput}
                  value={followUpAt}
                  onChange={(e) => {
                    setFollowUpAt(e.target.value)
                    clear('nextFollowUpAt')
                  }}
                  aria-invalid={!!errors.nextFollowUpAt}
                  data-testid="cp-log-followup"
                />
              </FormField>
              <FormField label="Type" error={errors.followUpType}>
                <Select value={fuType} onChange={(e) => setFollowUpType(e.target.value)} data-testid="cp-log-followup-type">
                  {followUpTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                  {!followUpTypes.length && <option value="call">Call</option>}
                </Select>
              </FormField>
            </div>
            <FormField label="Follow-up notes" error={errors.followUpNotes}>
              <Input
                placeholder="Optional"
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                maxLength={500}
                data-testid="cp-log-followup-notes"
              />
            </FormField>
            <p className="text-[11px] text-slate-500">The lead's open follow-up is closed when you save and this one replaces it.</p>
          </div>
        ) : stage ? (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <TriangleAlert className="h-3 w-3" /> No follow-up for a {stage.type === 'won' ? 'Won' : 'Closed'} stage; the open one is closed.
          </p>
        ) : null}
      </div>
    </Drawer>
  )
}

/** Log Call (`withCall`) or Update stage without a call; the form starts fresh every time it opens. */
export default function CpLogDrawer({
  open,
  onClose,
  lead,
  withCall,
}: {
  open: boolean
  onClose: () => void
  lead: CpLeadDetail
  withCall: boolean
}) {
  if (!open) return null
  return <CpLogForm lead={lead} withCall={withCall} onClose={onClose} />
}
