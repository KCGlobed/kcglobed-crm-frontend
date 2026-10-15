import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  Mail,
  MessageCircle,
  MessageSquareText,
  Milestone,
  NotebookPen,
  Pencil,
  Phone,
  PhoneCall,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteLeadMutation, useGetLeadQuery, useLeadCallsQuery, useLeadNotesQuery } from '../../services/leadsApi'
import { useLeadMessagesQuery } from '../../services/messagingApi'
import { useLeadTasksQuery } from '../../services/tasksApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { isAdminLike } from '../../lib/roles'
import { Badge, StageBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ProgressRing } from '../../components/ui/ProgressRing'
import { ConfirmDialog, ErrorState, Skeleton } from '../../components/ui/feedback'
import { Tabs } from '../../components/ui/misc'
import { cn, formatDateTime, fullName, initials, parseApiError, timeAgo } from '../../lib/utils'
import { LeadFormDrawer } from './LeadFormDrawer'
import { formatCustomValue } from './leadColumns'
import { LeadTimeline } from './LeadTimeline'
import { LeadNotes } from './LeadNotes'
import { LeadProfileTab } from './profile/LeadProfileTab'
import { LeadFollowUps } from './LeadFollowUps'
import { LeadHistory } from './LeadHistory'
import { CounsellorDiscussion } from './CounsellorDiscussion'
import { CustomInformation } from './CustomInformation'
import { DispositionDrawer } from './DispositionDrawer'
import { ChangeStageModal } from './ChangeStageModal'
import { AddNoteModal, AssignLeadModal, SendMessageModal } from './LeadActionModals'
import { WhatsAppChat } from './WhatsAppChat'
import { FollowUpFormModal } from '../tasks/FollowUpFormModal'
import { subStageOf } from '../../lib/stages'
import type { CustomFieldDef, Lead, LeadMessage } from '../../types/models'

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-xs">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value ?? '—'}</span>
    </div>
  )
}

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

function OverviewTab({ lead, onEditCustom, onViewNotes }: { lead: Lead; onEditCustom?: () => void; onViewNotes?: () => void }) {
  const { data: calls } = useLeadCallsQuery(lead._id)
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
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4">
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
        {infoDefs.length > 0 && (
          <Card title="Additional Lead Information">
            {infoDefs.map((def) => (
              <DetailRow key={def.key} label={def.label} value={formatCustomValue(lead.customFields?.[def.key], def)} />
            ))}
            {onEditCustom && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onEditCustom}>
                <Pencil className="h-3.5 w-3.5" /> Edit additional information
              </Button>
            )}
          </Card>
        )}
        {/* Notes section beside the lead information: the remark captured with the lead first, then the latest notes (newest first) */}
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
      </div>
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
      <div className="space-y-4">
        <Card title="Recent Calls">
          {!calls?.data.length && <p className="text-xs text-slate-400">No Calls Logged Yet</p>}
          {calls?.data.slice(0, 5).map((c) => (
            <div key={c._id} className="border-b border-slate-50 py-1.5 text-xs last:border-0">
              <p className="font-medium text-slate-700">
                {c.subStage ?? c.stage} {c.durationSeconds
                  ? `· ${c.durationSeconds >= 3600 ? `${Math.floor(c.durationSeconds / 3600)}h ` : ''}${Math.floor((c.durationSeconds % 3600) / 60)}m ${c.durationSeconds % 60}s`
                  : ''}
              </p>
              <p className="text-slate-400">
                {c.user?.name} · {formatDateTime(c.createdAt)}
              </p>
            </div>
          ))}
        </Card>
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
      </div>
    </div>
  )
}

/** A number we can message: 10 digits (or country-coded); a missing or masked number has fewer. */
const hasUsableMobile = (mobile?: string | null) => (mobile ?? '').replace(/\D/g, '').length >= 10

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
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState<'edit' | 'assign' | 'delete' | 'call' | 'update' | 'stage' | 'followup' | 'note' | 'sms' | 'email' | 'whatsapp' | null>(null)

  const { data, isLoading, isError, error, refetch } = useGetLeadQuery(id, { skip: !id })
  const [deleteLead, { isLoading: deleting }] = useDeleteLeadMutation()
  // also feeds the Follow-ups tab — one fetch, shown as the count in the tab label
  const { data: followUps } = useLeadTasksQuery(id, { skip: !id || !can(user, 'tasks', 'view') })
  const followUpCount = followUps?.data.length
  const lead = data?.data
  const close = () => setModal(null)

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

  const canEdit = can(user, 'leads', 'edit')
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
            {/* the name block is centred on the rings, which are the taller side */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {initials(fullName(lead))}
                </span>
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

              {/* Profile completion and the Lead Score side by side, at the right corner */}
              <div className="flex items-center gap-4" data-testid="lead-scores">
                <ProgressRing
                  value={lead.profileCompletion ?? 0}
                  tone="emerald"
                  label="Profile"
                  testId="profile-completion-ring"
                  title="Student profile completion"
                >
                  <span className="text-sm font-bold tabular-nums text-slate-800">{lead.profileCompletion ?? 0}%</span>
                </ProgressRing>
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
                  {canEdit && lead.mobile && (
                    // Disabled until a dialer is connected
                    <Button variant="outline" size="sm" disabled title="Calling is not available yet">
                      <Phone className="h-3.5 w-3.5" /> Call
                    </Button>
                  )}
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
              {canSend && (
                <div className="flex flex-wrap items-center gap-2" data-testid="lead-messaging-actions">
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
                  <Button variant="ghost" size="sm" title="Open the WhatsApp chat with this lead" onClick={() => setTab('whatsapp')}>
                    Open chat
                  </Button>
                </div>
              )}
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
          { key: 'whatsapp', label: 'WhatsApp' },
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
          <OverviewTab lead={lead} onEditCustom={canEdit ? () => setTab('discussion') : undefined} onViewNotes={() => setTab('notes')} />
        ) : tab === 'profile' ? (
          <LeadProfileTab leadId={lead._id} />
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
        ) : tab === 'history' ? (
          <LeadHistory leadId={lead._id} />
        ) : (
          <LeadNotes leadId={lead._id} />
        )}
      </div>

      {lead && modal === 'edit' && <LeadFormDrawer open onClose={close} lead={lead} />}
      {lead && (modal === 'call' || modal === 'update') && <DispositionDrawer lead={lead} mode={modal} onClose={close} />}
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
