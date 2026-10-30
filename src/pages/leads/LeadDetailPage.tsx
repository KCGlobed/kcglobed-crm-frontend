import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  Eye,
  Mail,
  MessageCircle,
  MessageSquareText,
  Milestone,
  NotebookPen,
  Pencil,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteLeadMutation, useGetLeadQuery, useLeadCallsQuery, useLeadDocumentsQuery, useLeadNotesQuery } from '../../services/leadsApi'
import { useLeadMessagesQuery } from '../../services/messagingApi'
import { useLeadTasksQuery } from '../../services/tasksApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { isAdminLike, isCounsellor } from '../../lib/roles'
import { Badge, StageBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { ConfirmDialog, ErrorState, Skeleton } from '../../components/ui/feedback'
import { Tabs } from '../../components/ui/misc'
import { cn, formatDateTime, fullName, initials, parseApiError, timeAgo } from '../../lib/utils'
import { useAuthorizedObjectUrl } from '../../lib/download'
import { LeadFormDrawer } from './LeadFormDrawer'
import { ExportLeadButton } from './ExportLeadButton'
import { formatCustomValue } from './leadColumns'
import { LeadTimeline } from './LeadTimeline'
import { LeadNotes } from './LeadNotes'
import { LeadProfileTab } from './profile/LeadProfileTab'
import { documentPath, isImageDocument } from './profile/documentFiles'
import { LeadFollowUps } from './LeadFollowUps'
import { LeadHistory } from './LeadHistory'
import { CounsellorDiscussion } from './CounsellorDiscussion'
import { CustomInformation } from './CustomInformation'
import { DispositionDrawer } from './DispositionDrawer'
import { CallProofPreview, ReuploadCallProofs } from './CallProofDialogs'
import { callScreenshots } from './callProofFiles'
import { ChangeStageModal } from './ChangeStageModal'
import { AddNoteModal, AssignLeadModal, SendMessageModal } from './LeadActionModals'
import { WhatsAppChat } from './WhatsAppChat'
import { MessageHistory } from './MessageHistory'
import { FollowUpFormModal } from '../tasks/FollowUpFormModal'
import { subStageOf } from '../../lib/stages'
import { formatHms } from '../../lib/durations'
import { CallButton } from '../../features/telephony/CallButton'
import { RecordingPlayer } from '../../features/telephony/RecordingPlayer'
import { OPEN_DISPOSITION_EVENT, type OpenDispositionDetail } from '../../features/telephony/events'
import { usePhone } from '../../features/telephony/softphone'
import { isFinalStatus, statusLabel, statusTone } from '../../features/telephony/callState'
import { useLiveCalls, useStartCall } from '../../features/telephony/useLiveCalls'
import type { CallLog, CustomFieldDef, Lead, LeadMessage } from '../../types/models'

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-xs">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 break-all text-right font-medium text-slate-700">{value || '—'}</span>
    </div>
  )
}

const TRACK_LABELS: Record<string, string> = { ads: 'Ads', partner: 'Partner', other: 'Other' }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  )
}

/**
 * Console providers only log the message, so their "sent" / "delivered" is not a real delivery
 * status; a backend that does not report the provider yet cannot confirm it either. Failed and
 * bounced are real outcomes whatever the provider.
 */
const isSimulatedStatus = (m: LeadMessage) =>
  (m.status === 'sent' || m.status === 'delivered') && (!m.provider || m.provider.startsWith('console'))

/** Masters custom fields that hold the remark captured with the lead (label like "Remarks"). */
const isRemarkField = (def: CustomFieldDef) => /remark/i.test(def.label) || /remark/i.test(def.key)

/**
 * The lead's Overview. A counsellor (`compact`) sees two rows: Contact | Additional Lead Information | Notes, then
 * Recent Calls | Recent Communications. Super Admin and Admin keep the full three columns, with the System Fields
 * and Source & Tracking cards.
 */
function OverviewTab({
  lead,
  compact,
  onEditCustom,
  onViewNotes,
}: {
  lead: Lead
  compact?: boolean
  onEditCustom?: () => void
  onViewNotes?: () => void
}) {
  const user = useCurrentUser()
  const { data: calls } = useLeadCallsQuery(lead._id)
  const [preview, setPreview] = useState<CallLog | null>(null)
  const [reupload, setReupload] = useState<CallLog | null>(null)
  const { data: notes } = useLeadNotesQuery(lead._id)
  const { data: messages } = useLeadMessagesQuery(lead._id)
  const { data: masters } = useMasterBootstrapQuery()
  const customDefs = masters?.data.customFields ?? []
  // The remark moves out of Additional Lead Information and into the Notes card below it
  const infoDefs = customDefs.filter((def) => !isRemarkField(def))
  const remarks = customDefs
    .filter(isRemarkField)
    .map((def) => ({ def, text: formatCustomValue(lead.customFields?.[def.key], def) }))
    .filter((r) => r.text !== null && r.text !== undefined && r.text !== '')
  // only the custom fields that actually hold a value; empty defs stay hidden
  const filled = infoDefs
    .map((def) => ({ def, value: formatCustomValue(lead.customFields?.[def.key], def) }))
    .filter(({ value }) => value !== null && value !== undefined && value !== '')

  const contact = (
    <Card title="Contact">
      <DetailRow label="Mobile" value={lead.mobile} />
      <DetailRow label="Email" value={lead.email} />
      <DetailRow label="City" value={lead.city} />
      <DetailRow label="State" value={lead.state} />
      <DetailRow label="Program Interest" value={lead.programInterest?.name} />
      {/* <DetailRow
        label="Opted Out"
        value={[lead.optedOut?.sms ? 'SMS' : null, lead.optedOut?.email ? 'Email' : null].filter(Boolean).join(', ') || 'No'}
      /> */}
    </Card>
  )
  const additional = (
    <Card title="Additional Lead Information">
      {filled.map(({ def, value }) => (
        <DetailRow key={def.key} label={def.label} value={value} />
      ))}
      {!filled.length && <p className="text-xs text-slate-400">No Additional Information Yet</p>}
      {onEditCustom && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onEditCustom}>
          <Pencil className="h-3.5 w-3.5" /> Edit additional information
        </Button>
      )}
    </Card>
  )
  // the remark captured with the lead first, then the latest notes (newest first)
  const notesCard = (
    <Card title="Notes">
      {remarks.map(({ def, text }) => (
        <div key={def.key} className="border-b border-slate-50 py-1.5 text-xs last:border-0" data-testid={`overview-remark-${def.key}`}>
          <p className="whitespace-pre-wrap text-slate-700">{text}</p>
          <p className="mt-0.5 text-slate-400">{def.label} · captured with the lead</p>
        </div>
      ))}
      {!remarks.length && !notes?.data.length && <p className="text-xs text-slate-400">No Notes Yet</p>}
      {notes?.data.slice(0, 5).map((n) => (
        <div key={n._id} className="border-b border-slate-50 py-1.5 text-xs last:border-0" data-testid="overview-note">
          <p className="line-clamp-3 whitespace-pre-wrap text-slate-700">{n.body}</p>
          <p className="mt-0.5 text-slate-400">
            {n.createdBy?.name ?? 'System'}
            {n.category ? ` · ${n.category}` : ''} · {formatDateTime(n.createdAt)}
          </p>
        </div>
      ))}
      {onViewNotes && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onViewNotes}>
          <NotebookPen className="h-3.5 w-3.5" /> View All Notes{notes?.data.length ? ` (${notes.data.length})` : ''}
        </Button>
      )}
    </Card>
  )
  // the counsellor who logged a call re-uploads its files; Super Admin / Admin those of any logged call
  const canReupload = (c: CallLog) => c.source === 'manual' && can(user, 'leads', 'edit') && (isAdminLike(user) || c.user?._id === user?._id)
  const recentCalls = (
    <Card title={`Recent Calls${calls?.data.length ? ` (${calls.data.length})` : ''}`}>
      {!calls?.data.length && <p className="text-xs text-slate-400">No Calls Logged Yet</p>}
      {/* every call, in a box that keeps its height and scrolls */}
      <div className="-mr-2 max-h-96 overflow-y-auto pr-2" data-testid="recent-calls">
        {calls?.data.map((c) => {
          const shots = callScreenshots(c)
          const files = [shots.length ? `${shots.length} screenshot${shots.length > 1 ? 's' : ''}` : null, c.recording ? 'recording' : null].filter(Boolean).join(' · ')
          return (
            <div key={c._id} className="border-b border-slate-50 py-1.5 text-xs last:border-0" data-testid="recent-call">
              <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-700">
                {c.direction === 'inbound' ? (
                  <PhoneIncoming className="h-3 w-3 shrink-0 text-emerald-600" aria-label="Inbound" />
                ) : (
                  <PhoneOutgoing className="h-3 w-3 shrink-0 text-brand-600" aria-label="Outbound" />
                )}
                <span>{c.subStage ?? c.stage ?? (c.source === 'dialer' ? (c.needsDisposition ? 'Outcome pending' : 'No outcome') : '—')}</span>
                {c.source === 'dialer' && <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>}
                {!!c.durationSeconds && <span className="font-mono font-normal tabular-nums text-slate-500">{formatHms(c.durationSeconds)}</span>}
              </p>
              <p className="text-slate-400">
                {c.user?.name ?? (c.source === 'dialer' ? 'Dialer' : 'System')} · {formatDateTime(c.createdAt)}
              </p>
              {c.source === 'dialer' ? (
                (c.recording || c.recordingPending) && (
                  <RecordingPlayer callId={c._id} proofId={c.recording?._id} fileName={c.recording?.fileName} pending={c.recordingPending} compact className="mt-1" />
                )
              ) : (
                (files || canReupload(c)) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {files && <span className="mr-1 text-[11px] text-slate-400">{files}</span>}
                    {files && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-brand-700" onClick={() => setPreview(c)} data-testid="preview-call-files">
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </Button>
                    )}
                    {canReupload(c) && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-600" onClick={() => setReupload(c)} data-testid="reupload-call-files">
                        <Upload className="h-3.5 w-3.5" /> Re-upload
                      </Button>
                    )}
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>
      {preview && (
        <CallProofPreview
          call={preview}
          title={`Call by ${preview.user?.name ?? 'the counsellor'}`}
          description={`${fullName(lead)} · ${lead.leadNo} · ${formatDateTime(preview.createdAt)}`}
          actions={
            canReupload(preview) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReupload(preview)
                  setPreview(null)
                }}
              >
                <Upload className="h-3.5 w-3.5" /> Re-upload
              </Button>
            )
          }
          onClose={() => setPreview(null)}
        />
      )}
      {reupload && <ReuploadCallProofs call={reupload} leadId={lead._id} onClose={() => setReupload(null)} />}
    </Card>
  )
  const recentMessages = (
    <Card title="Recent Communications">
      {!messages?.data.length && <p className="text-xs text-slate-400">Nothing Sent Yet</p>}
      {messages?.data.slice(0, 5).map((m) => (
        <div key={m._id} className="flex items-start justify-between gap-2 border-b border-slate-50 py-1.5 text-xs last:border-0">
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-700">
              {m.channel.toUpperCase()} · {m.template ?? 'custom'}
            </span>
            <span className="text-slate-400">
              {m.sentBy} · {timeAgo(m.createdAt)}
            </span>
          </span>
          {!isSimulatedStatus(m) && (
            <Badge tone={m.status === 'delivered' ? 'green' : m.status === 'failed' || m.status === 'bounced' ? 'red' : 'blue'}>{m.status}</Badge>
          )}
        </div>
      ))}
    </Card>
  )

  if (compact) {
    // grid items stretch to their row's height, so the cards of a row line up
    return (
      <div className="space-y-4">
        {/* Row 1: Contact | Additional Lead Information (always shown, so the row keeps its three columns) | Notes */}
        <div className="grid gap-4 lg:grid-cols-3">
          {contact}
          {additional}
          {notesCard}
        </div>
        {/* Row 2: Recent Calls | Recent Communications */}
        <div className="grid gap-4 lg:grid-cols-2">
          {recentCalls}
          {recentMessages}
        </div>
      </div>
    )
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4">
        {contact}
        {(filled.length > 0 || !!onEditCustom) && additional}
        {notesCard}
      </div>
      <div className="space-y-4">
        <Card title="System Fields">
          <DetailRow label="Lead ID" value={lead.leadNo} />
          <DetailRow label="Created On" value={formatDateTime(lead.createdAt)} />
          <DetailRow label="Created Via" value={lead.createdViaLabel ?? lead.createdVia} />
          <DetailRow label="Created By" value={lead.createdBy?.name ?? 'System'} />
          <DetailRow label="First Source" value={lead.firstSource?.name} />
          <DetailRow label="Latest Source" value={lead.source?.name} />
          {lead.meta?.campaignName && <DetailRow label="Meta Campaign" value={lead.meta.campaignName} />}
          {lead.meta?.adsetName && <DetailRow label="Meta Ad Set" value={lead.meta.adsetName} />}
          {lead.meta?.adName && <DetailRow label="Meta Ad" value={lead.meta.adName} />}
          {lead.meta?.formName && <DetailRow label="Meta Form" value={lead.meta.formName} />}
          {lead.uploadFileName && <DetailRow label="Upload File" value={lead.uploadFileName} />}
          <DetailRow label="Owner" value={lead.owner?.name ?? 'Unassigned'} />
          <DetailRow label="Assigned On" value={formatDateTime(lead.assignedAt)} />
          <DetailRow label="Re-enquiry Count" value={lead.reEnquiryCount ?? 0} />
          <DetailRow label="Student Profile Completion" value={`${lead.profileCompletion ?? 0}%`} />
          {/* only from the new backend; the old one had no discussion % (it sent it as customFieldsCompletion) */}
          {lead.discussionCompletion !== undefined && <DetailRow label="Counsellor Discussion Completion" value={`${lead.discussionCompletion}%`} />}
        </Card>
        {/* Everything the capture API records about where the lead came from (utm block + referral block + track) */}
        <Card title="Source & Tracking">
          <DetailRow label="UTM Source" value={lead.utm?.source} />
          <DetailRow label="UTM Medium" value={lead.utm?.medium} />
          <DetailRow label="UTM Campaign" value={lead.utm?.campaign} />
          <DetailRow label="UTM Term" value={lead.utm?.term} />
          <DetailRow label="UTM Content" value={lead.utm?.content} />
          <DetailRow label="Landing Page" value={lead.utm?.landingPage} />
          <DetailRow label="Referrer" value={lead.utm?.referrer} />
          {lead.referral?.code && <DetailRow label="Referral Code" value={lead.referral.code} />}
          {lead.referral?.partnerName && <DetailRow label="Partner Name" value={lead.referral.partnerName} />}
          {lead.referral?.partnerLink && <DetailRow label="Partner Link" value={lead.referral.partnerLink} />}
          <DetailRow label="Track" value={TRACK_LABELS[lead.track] ?? lead.track} />
        </Card>
      </div>
      <div className="space-y-4">
        {recentCalls}
        {recentMessages}
      </div>
    </div>
  )
}

/**
 * A number we can message: 10 digits (or country-coded), or one the user's role masks ("******1010") — the
 * server always sends to the real number on record, so a masked number does not block a send.
 */
const hasUsableMobile = (mobile?: string | null) => {
  const value = mobile ?? ''
  return value.replace(/\D/g, '').length >= 10 || (value.includes('*') && value.length >= 10)
}

/**
 * The lead's profile photo (the Documents tab's "Photograph", or initials until one is uploaded) inside the
 * profile-completion arc, with the % pinned to the bottom edge of the ring.
 */
function LeadAvatar({ lead }: { lead: Lead }) {
  const { data: docs } = useLeadDocumentsQuery(lead._id)
  const photo = docs?.data.documents.find((d) => d.type === 'photo')?.current ?? null
  const image = useAuthorizedObjectUrl(photo && isImageDocument(photo) ? `${documentPath(lead._id, photo._id)}?inline=1` : null)
  const pct = lead.profileCompletion ?? 0
  return (
    <div className="relative shrink-0" title={`Student profile completion: ${pct}%`}>
      <ProgressRing value={pct} size={80} stroke={5} tone="emerald" testId="profile-completion-ring">
        {image.url ? (
          <img src={image.url} alt={fullName(lead)} className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
            {initials(fullName(lead))}
          </span>
        )}
      </ProgressRing>
      <span
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-emerald-500 px-1.5 py-px text-[10px] font-bold leading-4 tabular-nums text-white"
        data-testid="profile-completion-pct"
      >
        {pct}%
      </span>
    </div>
  )
}

function HeaderFact({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('truncate text-xs font-medium', danger ? 'text-red-600' : 'text-slate-700')}>{children}</p>
    </div>
  )
}

export default function LeadDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const admin = isAdminLike(user)
  const [searchParams, setSearchParams] = useSearchParams()
  // ?tab=whatsapp (a WhatsApp reply notification) opens straight on that tab
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'overview')
  const [modal, setModal] = useState<'edit' | 'assign' | 'delete' | 'call' | 'update' | 'dialer' | 'stage' | 'followup' | 'note' | 'sms' | 'email' | 'whatsapp' | null>(null)

  const { data, isLoading, isError, error, refetch } = useGetLeadQuery(id, { skip: !id })
  const [deleteLead, { isLoading: deleting }] = useDeleteLeadMutation()
  // also feeds the Follow-ups tab — one fetch, shown as the count in the tab label
  const { data: followUps } = useLeadTasksQuery(id, { skip: !id || !can(user, 'tasks', 'view') })
  const followUpCount = followUps?.data.length
  const lead = data?.data
  const canEdit = can(user, 'leads', 'edit')

  // --- dialer: the outcome drawer for a call that ended — asked for by ?disposition=<callId> (a notification,
  // the popover from another page), by the popover's button on this page (window event), or found by the
  // live feed (a pending outcome of this lead) — and ?dial=1 from the "Start calling" list
  const { pending, enabled: dialerEnabled } = useLiveCalls()
  // on a call in the CRM phone: the lead page stays as it is; the outcome opens once the call ends
  const phone = usePhone()
  const onPhone = !!(phone.ringing || phone.inCall)
  const { startCall } = useStartCall()
  const { data: callRows } = useLeadCallsQuery(id, { skip: !id })
  const [dialerCall, setDialerCall] = useState<CallLog | null>(null)
  // calls whose drawer this page already showed (saved, skipped or closed): never re-opened by the poll
  const [handledCalls, setHandledCalls] = useState<string[]>([])
  const dialled = useRef(false)
  const requestedCallId = searchParams.get('disposition')
  const findCall = useCallback(
    (callId: string): CallLog | undefined => pending.find((c) => c._id === callId) ?? callRows?.data.find((c) => c._id === callId),
    [pending, callRows]
  )
  // the call whose outcome is due without anyone clicking: the one in the URL, else this lead's pending one
  const dueCall = useMemo(() => {
    if (!lead || !canEdit || modal !== null || onPhone) return null
    const fromUrl = requestedCallId ? findCall(requestedCallId) : undefined
    const due = fromUrl ?? pending.find((c) => c.lead?._id === lead._id && c.needsDisposition)
    return due && isFinalStatus(due.status) && !handledCalls.includes(due._id) ? due : null
  }, [lead, canEdit, modal, onPhone, requestedCallId, findCall, pending, handledCalls])
  const openDialer = modal === 'dialer' ? dialerCall : dueCall
  const close = () => {
    if (openDialer) setHandledCalls((h) => [...h, openDialer._id])
    setModal(null)
    setDialerCall(null)
  }
  // the URL parameter has done its job once the call is known (or cannot be found in the loaded calls)
  useEffect(() => {
    if (!requestedCallId || !lead) return
    const call = findCall(requestedCallId)
    if (!call && !callRows) return
    const next = new URLSearchParams(searchParams)
    next.delete('disposition')
    setSearchParams(next, { replace: true })
    if (call && !isFinalStatus(call.status)) toast.message('The call is still in progress — its outcome can be saved once it ends')
  }, [requestedCallId, lead, callRows, findCall, searchParams, setSearchParams])
  useEffect(() => {
    if (searchParams.get('dial') !== '1' || !lead || dialled.current) return
    const next = new URLSearchParams(searchParams)
    next.delete('dial')
    setSearchParams(next, { replace: true })
    if (!dialerEnabled || !canEdit) return
    dialled.current = true
    void startCall(lead._id)
  }, [searchParams, setSearchParams, lead, dialerEnabled, canEdit, startCall])
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenDispositionDetail>).detail
      if (detail?.leadId !== id) return
      const call = findCall(detail.callId)
      if (!call) return
      if (!isFinalStatus(call.status)) {
        toast.message('The call is still in progress — its outcome can be saved once it ends')
        return
      }
      setDialerCall(call)
      setModal('dialer')
    }
    window.addEventListener(OPEN_DISPOSITION_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_DISPOSITION_EVENT, onOpen)
  }, [id, findCall])

  if (isError) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/leads')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Leads
        </Button>
        <ErrorState message={parseApiError(error).message} onRetry={refetch} />
      </>
    )
  }

  const onDelete = async () => {
    if (!lead) return
    try {
      await deleteLead(lead._id).unwrap()
      toast.success('Lead deleted')
      navigate('/app/leads')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const canSend = can(user, 'communications', 'create')

  return (
    <>
      <div className="mb-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading || !lead ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        ) : (
          <>
            {/* the name block is centred on the avatar ring and the score ring, which are the taller sides */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <LeadAvatar lead={lead} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold text-slate-800">{fullName(lead)}</h1>
                    <span className="text-xs text-slate-400">{lead.leadNo}</span>
                    {lead.stage && (
                      <StageBadge stage={lead.stage}>
                        {lead.stage.name}
                        {subStageOf(lead) && <span className="font-normal opacity-90">· {subStageOf(lead)!.name}</span>}
                      </StageBadge>
                    )}
                    <span
                      className="text-xs text-slate-400"
                      data-testid="lead-last-updated"
                      title={lead.stageChangedAt ? `In this stage since ${formatDateTime(lead.stageChangedAt)}` : undefined}
                    >
                      Last Updated: {formatDateTime(lead.updatedAt)}
                    </span>
                    {!!lead.reEnquiryCount && <Badge tone="blue">Re-enquired ×{lead.reEnquiryCount}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {lead.mobile ?? '—'} · {lead.email ?? 'no email'}
                  </p>
                </div>
              </div>

              {/* Lead Score alone at the right corner; profile completion lives on the avatar */}
              <div className="flex items-center gap-4" data-testid="lead-scores">
                <ProgressRing
                  value={lead.score ?? 0}
                  tone="brand"
                  label="Lead Score"
                  testId="lead-score-ring"
                  title={`Profile ${lead.profileCompletion ?? 0}% × ${(lead.scoreWeights ?? { profile: 50, discussion: 50 }).profile}% + Discussion ${lead.discussionCompletion ?? 0}% × ${(lead.scoreWeights ?? { profile: 50, discussion: 50 }).discussion}%`}
                >
                  <span className="text-lg font-bold tabular-nums text-slate-800">{lead.score ?? 0}</span>
                </ProgressRing>
              </div>
            </div>

            {/* line one: lead work on the left, assignment / edit / delete on the right; line two: messaging */}
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3" data-testid="lead-actions">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2" data-testid="lead-primary-actions">
                  {canEdit && lead.mobile && <CallButton leadId={lead._id} mobile={lead.mobile} showWhenDisabled />}
                  {canEdit && (
                    <Button size="sm" onClick={() => setModal('call')}>
                      <PhoneCall className="h-3.5 w-3.5" /> Log Call / Update
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setModal('stage')}>
                      <Milestone className="h-3.5 w-3.5" /> Change Stage
                    </Button>
                  )}
                  {can(user, 'tasks', 'create') && (
                    <Button variant="outline" size="sm" onClick={() => setModal('followup')}>
                      <CalendarPlus className="h-3.5 w-3.5" /> Add Follow-up
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setModal('note')}>
                    <NotebookPen className="h-3.5 w-3.5" /> Add Note
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto" data-testid="lead-admin-actions">
                  {can(user, 'leads', 'reassign') && (
                    <Button variant="outline" size="sm" onClick={() => setModal('assign')}>
                      <UserPlus className="h-3.5 w-3.5" /> {lead.owner ? 'Reassign' : 'Assign'}
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => setModal('edit')} title="Edit Lead Fields">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {can(user, 'leads', 'delete') && (
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setModal('delete')}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              {/* the send buttons need communications.create; Export Details only needs to see the lead */}
              <div className="flex flex-wrap items-center gap-2" data-testid="lead-messaging-actions">
                {canSend && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasUsableMobile(lead.mobile)}
                      title={hasUsableMobile(lead.mobile) ? 'Send a DLT-approved SMS to this lead' : 'No valid mobile number'}
                      onClick={() => setModal('sms')}
                    >
                      <MessageSquareText className="h-3.5 w-3.5" /> Send SMS
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setModal('email')}>
                      <Mail className="h-3.5 w-3.5" /> Send Email
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasUsableMobile(lead.mobile)}
                      title={hasUsableMobile(lead.mobile) ? 'Send an approved WhatsApp template to this lead' : 'No valid mobile number'}
                      onClick={() => setModal('whatsapp')}
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp
                    </Button>
                  </>
                )}
                <ExportLeadButton leadId={lead._id} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3 lg:grid-cols-6">
              <HeaderFact label="Owner">{lead.owner?.name ?? 'Unassigned'}</HeaderFact>
              <HeaderFact label="First Source">{lead.firstSource?.name ?? '—'}</HeaderFact>
              <HeaderFact label="Latest Source">{lead.source?.name ?? '—'}</HeaderFact>
              <HeaderFact label="Next Follow-up" danger={lead.isOverdue}>
                {lead.nextFollowUpAt ? `${lead.isOverdue ? 'Overdue · ' : ''}${formatDateTime(lead.nextFollowUpAt)}` : 'None'}
              </HeaderFact>
              <HeaderFact label="Last Activity">{timeAgo(lead.lastActivityAt)}</HeaderFact>
              <HeaderFact label="Program">{lead.programInterest?.name ?? '—'}</HeaderFact>
            </div>
          </>
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'profile', label: 'Student Profile' },
          { key: 'discussion', label: 'Counsellor Discussion' },
          { key: 'timeline', label: 'Timeline' },
          { key: 'whatsapp', label: 'WhatsApp History' },
          { key: 'sms', label: 'SMS History' },
          { key: 'email', label: 'Email History' },
          ...(can(user, 'tasks', 'view')
            ? [{ key: 'followups', label: `Follow-ups${followUpCount !== undefined ? ` (${followUpCount})` : ''}` }]
            : []),
          { key: 'notes', label: 'Notes' },
          ...(admin ? [{ key: 'history', label: 'History' }] : []),
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {isLoading || !lead ? (
          <Skeleton className="h-48 w-full" />
        ) : tab === 'overview' ? (
          <OverviewTab lead={lead} compact={isCounsellor(user)} onEditCustom={canEdit ? () => setTab('discussion') : undefined} onViewNotes={() => setTab('notes')} />
        ) : tab === 'profile' ? (
          <LeadProfileTab leadId={lead._id} actions={canEdit && lead.mobile ? <CallButton leadId={lead._id} mobile={lead.mobile} /> : undefined} />
        ) : tab === 'discussion' ? (
          <div className="space-y-4">
            <CounsellorDiscussion leadId={lead._id} readOnly={!canEdit} />
            <CustomInformation lead={lead} readOnly={!canEdit} />
          </div>
        ) : tab === 'followups' ? (
          <LeadFollowUps leadId={lead._id} />
        ) : tab === 'timeline' ? (
          <LeadTimeline leadId={lead._id} />
        ) : tab === 'whatsapp' ? (
          <WhatsAppChat lead={lead} canSend={canSend} />
        ) : tab === 'sms' || tab === 'email' ? (
          <MessageHistory lead={lead} channel={tab} canSend={canSend} />
        ) : tab === 'history' ? (
          <LeadHistory leadId={lead._id} />
        ) : (
          <LeadNotes leadId={lead._id} />
        )}
      </div>

      {lead && modal === 'edit' && <LeadFormDrawer open onClose={close} lead={lead} />}
      {lead && (modal === 'call' || modal === 'update') && <DispositionDrawer lead={lead} mode={modal} onClose={close} />}
      {lead && openDialer && <DispositionDrawer key={openDialer._id} lead={lead} mode="dialer" call={openDialer} onClose={close} />}
      {lead && modal === 'stage' && <ChangeStageModal open lead={lead} onClose={close} />}
      {lead && modal === 'followup' && <FollowUpFormModal leadId={lead._id} ownerId={lead.owner?._id} onClose={close} />}
      {lead && modal === 'assign' && <AssignLeadModal lead={lead} onClose={close} />}
      {lead && modal === 'note' && <AddNoteModal lead={lead} onClose={close} />}
      {lead && (modal === 'sms' || modal === 'email' || modal === 'whatsapp') && <SendMessageModal lead={lead} channel={modal} onClose={close} />}

      <ConfirmDialog
        open={modal === 'delete'}
        onClose={close}
        onConfirm={onDelete}
        title="Delete Lead"
        message={`Delete ${lead ? fullName(lead) : 'this lead'} (${lead?.leadNo})? The record is soft-deleted and kept in the audit trail.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </>
  )
}
