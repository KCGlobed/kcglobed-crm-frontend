import { useState } from 'react'
import { Lightbulb, Lock, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { toast } from 'sonner'
import { useDispositionOptionsQuery, useSaveDispositionMutation } from '../../services/leadsApi'
import { useDismissCallMutation } from '../../services/telephonyApi'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { formatHms } from '../../lib/durations'
import { formatDateTime, parseApiError } from '../../lib/utils'
import { isFinalStatus, statusLabel, statusTone } from '../../features/telephony/callState'
import { RecordingPlayer } from '../../features/telephony/RecordingPlayer'
import type { CallLog, Lead } from '../../types/models'
import { taskTypeLabel, toLocalInput } from '../tasks/taskMeta'
import { offersFollowUp } from './stageForm'
import { CallProofField, type ProofValue } from './CallProofField'

/**
 * "Log Call / Update" (GL-16..20, GL-40): stage + disposition, a mandatory
 * future follow-up for every open stage, a reason for closing stages, an
 * optional note and, for a call, its duration (mandatory: talk time is summed
 * from it; 00:00:00 for a call that didn't connect), the screenshot(s) of the call
 * time (at least one, so the duration can be checked; several for a call spanning screens) and the recording
 * (optional). Counsellor Discussion and
 * Call Result are intentionally not part of this form — the discussion lives in its own tab.
 *
 * `dialer` mode: the outcome of a call the dialer (Smartflo) placed or received — status, talk time and
 * recording come from the dialer, so no duration or screenshot is asked; the stage / disposition is
 * saved onto that call row (call.callId). Skip leaves the call without an outcome.
 */
export function DispositionDrawer({
  lead,
  mode,
  call,
  onClose,
}: {
  lead: Lead
  mode: 'call' | 'update' | 'dialer'
  /** the dialer call being dispositioned (mode 'dialer') */
  call?: CallLog
  onClose: () => void
}) {
  const { data } = useDispositionOptionsQuery()
  const [save, { isLoading }] = useSaveDispositionMutation()
  const [dismiss, { isLoading: skipping }] = useDismissCallMutation()
  const dialer = mode === 'dialer' ? (call ?? null) : null
  // the dialer has not reported this call yet (webhook pending): the counsellor may type the duration
  const manualDuration = !!dialer && !isFinalStatus(dialer.status)
  const stages = data?.data.stages ?? []
  // the lead's current stage and sub-stage to start with
  const [stageId, setStageId] = useState(lead.stage?._id ?? '')
  const [subStage, setSubStage] = useState(lead.subStage ?? '')
  const [reason, setReason] = useState('')
  // optional: empty until a date is picked, and no follow-up is created then
  const [followUpAt, setFollowUpAt] = useState('')
  const [followUpType, setFollowUpType] = useState('follow_up_call')
  const [followUpNote, setFollowUpNote] = useState('')
  const [note, setNote] = useState('')
  // Call result is hidden in the form for now; every logged call is saved as connected
  const callStatus = 'answered'
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  // proof of the call, uploaded as soon as it is picked (or pasted)
  const [screenshots, setScreenshots] = useState<ProofValue[]>([])
  const [recording, setRecording] = useState<ProofValue[]>([])
  const [shotBusy, setShotBusy] = useState(false)
  const [recBusy, setRecBusy] = useState(false)
  const [pasted, setPasted] = useState<File | null>(null)
  const proofMissing = mode === 'call' && (!screenshots.length || shotBusy || recBusy)

  const stage = stages.find((s) => s._id === stageId)
  const subStagePick = stage?.subStages.find((s) => s._id === subStage)
  // the sub-stage in effect: only one the chosen stage offers (the lead's may since have been switched off)
  const subStageId = subStagePick?._id ?? ''

  // the call's duration: required, whole numbers, minutes and seconds 0–59, at most 6 hours
  const durationEntered = [hours, minutes, seconds].some((v) => v.trim() !== '')
  const part = (value: string, max: number) => (value.trim() === '' ? 0 : /^\d+$/.test(value.trim()) && Number(value) <= max ? Number(value) : NaN)
  const duration = part(hours, 6) * 3600 + part(minutes, 59) * 60 + part(seconds, 59)
  const durationProblem =
    mode === 'call'
      ? !durationEntered
        ? 'Enter the call duration'
        : Number.isNaN(duration)
          ? 'Use whole numbers: hours up to 6, minutes and seconds 0–59'
          : duration > 6 * 3600
            ? 'A call can be at most 6 hours'
            : undefined
      : manualDuration && durationEntered
        ? Number.isNaN(duration)
          ? 'Use whole numbers: hours up to 6, minutes and seconds 0–59'
          : duration > 6 * 3600
            ? 'A call can be at most 6 hours'
            : undefined
        : undefined

  const onSave = async () => {
    if (durationProblem) return
    const body: Record<string, unknown> = {
      stage: stageId,
      subStage: subStageId || null,
      reason: reason || undefined,
      note: note || undefined,
      interaction: mode === 'dialer' ? 'call' : mode,
      ...(offersFollowUp(stage) && followUpAt
        ? { followUpAt: new Date(followUpAt).toISOString(), followUpType, followUpNote: followUpNote || undefined }
        : {}),
      ...(mode === 'call'
        ? { call: { status: callStatus, durationSeconds: duration, screenshotIds: screenshots.map((s) => s.id), recordingId: recording[0]?.id ?? null } }
        : dialer
          ? { call: { callId: dialer._id, ...(manualDuration && durationEntered ? { durationSeconds: duration } : {}) } }
          : {}),
    }
    try {
      await save({ id: lead._id, body }).unwrap()
      toast.success(mode === 'call' ? 'Call logged' : mode === 'dialer' ? 'Call outcome saved' : 'Lead updated')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(Object.values(parsed.errors)[0] ?? parsed.message)
    }
  }

  const onSkip = async () => {
    if (!dialer) return
    try {
      await dismiss(dialer._id).unwrap()
      toast.message('Call left without an outcome')
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={mode === 'call' ? 'Log call' : mode === 'dialer' ? 'Call outcome' : 'Update lead'}
      description={`${lead.firstName} ${lead.lastName ?? ''} · ${lead.leadNo} · now ${lead.stage?.name ?? '—'}`}
      footer={
        <>
          {dialer?.needsDisposition && (
            <Button variant="ghost" className="mr-auto" onClick={onSkip} loading={skipping} data-testid="skip-outcome">
              Skip
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isLoading} disabled={!stageId || !!durationProblem || proofMissing} data-testid="save-outcome">
            {mode === 'dialer' ? 'Save Outcome' : 'Save Disposition'}
          </Button>
        </>
      }
    >
      <div
        onPaste={(e) => {
          // a screenshot pasted anywhere in the drawer becomes the call screenshot
          const image = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
          if (image && mode === 'call') {
            e.preventDefault()
            setPasted(new File([image], image.name || 'call-screenshot.png', { type: image.type }))
          }
        }}
      >
        <div className="space-y-3">
          {dialer && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs" data-testid="dialer-call-summary">
              <div className="flex flex-wrap items-center gap-2">
                {dialer.direction === 'inbound' ? (
                  <PhoneIncoming className="h-4 w-4 text-emerald-600" aria-label="Inbound call" />
                ) : (
                  <PhoneOutgoing className="h-4 w-4 text-brand-600" aria-label="Outbound call" />
                )}
                <span className="font-medium text-slate-700">{dialer.direction === 'inbound' ? 'Incoming call' : 'Outbound call'}</span>
                <Badge tone={statusTone(dialer.status)}>{statusLabel(dialer.status)}</Badge>
                {isFinalStatus(dialer.status) && (
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-800">{formatHms(dialer.durationSeconds)}</span>
                )}
              </div>
              <p className="mt-1 text-slate-500">
                {formatDateTime(dialer.startedAt ?? dialer.createdAt)}
                {dialer.customerNumber ? ` · ${dialer.customerNumber}` : ''}
                {dialer.hangupCause ? ` · ${dialer.hangupCause.toLowerCase().replace(/_/g, ' ')}` : ''}
              </p>
              {(dialer.recording || dialer.recordingUrl) && (
                <RecordingPlayer callId={dialer._id} proofId={dialer.recording?._id} fileName={dialer.recording?.fileName} fallbackUrl={dialer.recordingUrl} className="mt-2" />
              )}
              {manualDuration && (
                <FormField
                  label="Talk time"
                  className="mt-3 border-t border-slate-200 pt-3"
                  error={errors['call.durationSeconds'] ?? durationProblem}
                  hint="The dialer has not reported this call yet — enter the talk time if you know it, or leave it blank"
                >
                  <div className="flex items-center gap-1">
                    <Input className="!w-16" type="number" min={0} placeholder="hh" value={hours} onChange={(e) => setHours(e.target.value)} />
                    <span className="text-slate-400">:</span>
                    <Input className="!w-16" type="number" min={0} max={59} placeholder="mm" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                    <span className="text-slate-400">:</span>
                    <Input className="!w-16" type="number" min={0} max={59} placeholder="ss" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
                  </div>
                </FormField>
              )}
            </div>
          )}
          {mode === 'call' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <FormField
                label="Call Duration"
                required
                error={errors['call.durationSeconds'] ?? (durationEntered ? durationProblem : undefined)}
                hint={durationEntered ? undefined : 'hh : mm : ss · enter 0 for a call that did not connect'}
              >
                <div className="flex items-center gap-1">
                  <Input className="!w-16" type="number" min={0} placeholder="hh" value={hours} onChange={(e) => setHours(e.target.value)} />
                  <span className="text-slate-400">:</span>
                  <Input className="!w-16" type="number" min={0} max={59} placeholder="mm" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                  <span className="text-slate-400">:</span>
                  <Input className="!w-16" type="number" min={0} max={59} placeholder="ss" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
                </div>
              </FormField>
              <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                <CallProofField
                  kind="screenshot"
                  required
                  value={screenshots}
                  onChange={setScreenshots}
                  onBusy={setShotBusy}
                  pasted={pasted}
                  error={errors['call.screenshotId'] ?? errors['call.screenshotIds']}
                />
                <CallProofField kind="recording" value={recording} onChange={setRecording} onBusy={setRecBusy} error={errors['call.recordingId']} />
              </div>
            </div>
          )}
          <FormField label="Stage" required error={errors.stage}>
            <Select
              value={stageId}
              onChange={(e) => {
                setStageId(e.target.value)
                setSubStage('')
                setErrors({})
              }}
            >
              <option value="">Choose…</option>
              {stages.map((s) => (
                <option key={s._id} value={s._id} disabled={s.locked && s._id !== lead.stage?._id}>
                  {s.name}
                  {s.locked ? ' (set by system)' : ''}
                </option>
              ))}
            </Select>
          </FormField>
          {stage?.locked && (
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <Lock className="h-3 w-3" /> This stage is set by the system and cannot be chosen manually.
            </p>
          )}
          {!!stage?.subStages.length && (
            <FormField label={stage.requiresReason ? 'Reason (sub-stage)' : 'Sub-stage (disposition)'} required error={errors.subStage}>
              <Select value={subStageId} onChange={(e) => setSubStage(e.target.value)} aria-invalid={!!errors.subStage}>
                <option value="">Choose…</option>
                {stage.subStages.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {subStagePick?.counsellorAction && (
            <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                <b>Counsellor action:</b> {subStagePick.counsellorAction}
              </p>
            </div>
          )}
          {stage?.requiresReason && !stage.subStages.length && (
            <FormField label="Reason" required error={errors.subStage}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            </FormField>
          )}
          {offersFollowUp(stage) && (
            <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
              <p className="text-xs font-semibold text-brand-800">Next follow-up (optional)</p>
              <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr]">
                <FormField label="Date & Time" error={errors.followUpAt}>
                  <Input
                    type="datetime-local"
                    min={toLocalInput(new Date())}
                    value={followUpAt}
                    onChange={(e) => setFollowUpAt(e.target.value)}
                    aria-invalid={!!errors.followUpAt}
                  />
                </FormField>
                <FormField label="Type" error={errors.followUpType}>
                  <Select value={followUpType} onChange={(e) => setFollowUpType(e.target.value)}>
                    {data?.data.followUpTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {taskTypeLabel(t.value, t.label)}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <Input placeholder="Follow-up note (optional)" value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} maxLength={500} />
            </div>
          )}
          <FormField label={mode === 'update' ? 'Note' : 'Call Note'}>
            <Textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
      </div>
    </Drawer>
  )
}
