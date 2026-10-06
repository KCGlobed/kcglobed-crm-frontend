import { useState } from 'react'
import { Lightbulb, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useDispositionOptionsQuery, useSaveDispositionMutation } from '../../services/leadsApi'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { Lead } from '../../types/models'
import { toLocalInput } from '../tasks/taskMeta'
import { CounsellorDiscussion } from './CounsellorDiscussion'

const CALL_STATUSES = [
  { value: 'answered', label: 'Connected' },
  { value: 'not_answered', label: 'Not answered' },
  { value: 'busy', label: 'Busy' },
  { value: 'failed', label: 'Failed / unreachable' },
]

/**
 * "Log Call / Update" (GL-16..20, GL-40): stage + disposition, a mandatory
 * future follow-up for every open stage, a reason for closing stages, an
 * optional note and call duration. The Counsellor Discussion stays open on
 * the right while the call is logged.
 */
export function DispositionDrawer({ lead, mode, onClose }: { lead: Lead; mode: 'call' | 'update'; onClose: () => void }) {
  const { data } = useDispositionOptionsQuery()
  const [save, { isLoading }] = useSaveDispositionMutation()
  const stages = data?.data.stages ?? []
  const [stageId, setStageId] = useState(lead.stage?._id ?? '')
  const [subStage, setSubStage] = useState('')
  const [reason, setReason] = useState('')
  const [followUpAt, setFollowUpAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600_000)))
  const [followUpType, setFollowUpType] = useState('follow_up_call')
  const [followUpNote, setFollowUpNote] = useState('')
  const [note, setNote] = useState('')
  const [callStatus, setCallStatus] = useState('answered')
  const [minutes, setMinutes] = useState('')
  const [seconds, setSeconds] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const stage = stages.find((s) => s._id === stageId)
  const subStagePick = stage?.subStages.find((s) => s._id === subStage)

  const onSave = async () => {
    const duration = minutes || seconds ? Number(minutes || 0) * 60 + Number(seconds || 0) : undefined
    const body: Record<string, unknown> = {
      stage: stageId,
      subStage: subStage || null,
      reason: reason || undefined,
      note: note || undefined,
      interaction: mode,
      ...(stage?.requiresFollowUp
        ? { followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null, followUpType, followUpNote: followUpNote || undefined }
        : {}),
      ...(mode === 'call' ? { call: { status: callStatus, durationSeconds: duration ?? null } } : {}),
    }
    try {
      await save({ id: lead._id, body }).unwrap()
      toast.success(mode === 'call' ? 'Call logged' : 'Lead updated')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(Object.values(parsed.errors)[0] ?? parsed.message)
    }
  }

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={mode === 'call' ? 'Log call' : 'Update lead'}
      description={`${lead.firstName} ${lead.lastName ?? ''} · ${lead.leadNo} · now ${lead.stage?.name ?? '—'}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isLoading} disabled={!stageId}>
            Save disposition
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {mode === 'call' && (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <FormField label="Call result">
                <Select value={callStatus} onChange={(e) => setCallStatus(e.target.value)}>
                  {CALL_STATUSES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Duration (optional)">
                <div className="flex items-center gap-1">
                  <Input className="!w-16" type="number" min={0} placeholder="mm" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                  <span className="text-slate-400">:</span>
                  <Input className="!w-16" type="number" min={0} max={59} placeholder="ss" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
                </div>
              </FormField>
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
              <Select value={subStage} onChange={(e) => setSubStage(e.target.value)} aria-invalid={!!errors.subStage}>
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
          {stage?.requiresFollowUp && (
            <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
              <p className="text-xs font-semibold text-brand-800">Next follow-up (required for open stages)</p>
              <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr]">
                <FormField label="Date & time" required error={errors.followUpAt}>
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
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <Input placeholder="Follow-up note (optional)" value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} maxLength={500} />
            </div>
          )}
          <FormField label={mode === 'call' ? 'Call note' : 'Note'}>
            <Textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
        <div className="border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Counsellor discussion</p>
          <CounsellorDiscussion leadId={lead._id} compact />
        </div>
      </div>
    </Drawer>
  )
}
