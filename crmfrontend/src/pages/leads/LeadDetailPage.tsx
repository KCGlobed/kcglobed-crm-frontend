import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarPlus,
  Lightbulb,
  Mail,
  MessageSquareText,
  NotebookPen,
  Pencil,
  Phone,
  PhoneCall,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteLeadMutation, useGetLeadQuery, useLeadCallsQuery } from '../../services/leadsApi'
import { useLeadMessagesQuery } from '../../services/messagingApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { isAdminLike } from '../../lib/roles'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog, ErrorState, Skeleton } from '../../components/ui/feedback'
import { Tabs } from '../../components/ui/misc'
import { cn, formatDateTime, fullName, initials, parseApiError, timeAgo } from '../../lib/utils'
import { LeadFormDrawer } from './LeadFormDrawer'
import { LeadTimeline } from './LeadTimeline'
import { LeadNotes } from './LeadNotes'
import { LeadProfileTab } from './profile/LeadProfileTab'
import { LeadFollowUps } from './LeadFollowUps'
import { LeadHistory } from './LeadHistory'
import { CounsellorDiscussion } from './CounsellorDiscussion'
import { DispositionDrawer } from './DispositionDrawer'
import { AddNoteModal, AssignLeadModal, SendMessageModal } from './LeadActionModals'
import { FollowUpFormModal } from '../tasks/FollowUpFormModal'
import { subStageOf } from '../../lib/stages'
import type { Lead } from '../../types/models'

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

function OverviewTab({ lead }: { lead: Lead }) {
  const { data: calls } = useLeadCallsQuery(lead._id)
  const { data: messages } = useLeadMessagesQuery(lead._id)
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Contact">
        <DetailRow label="Mobile" value={lead.mobile} />
        <DetailRow label="Email" value={lead.email} />
        <DetailRow label="City" value={lead.city} />
        <DetailRow label="State" value={lead.state} />
        <DetailRow label="Program interest" value={lead.programInterest?.name} />
        <DetailRow
          label="Opted out"
          value={[lead.optedOut?.sms ? 'SMS' : null, lead.optedOut?.email ? 'Email' : null].filter(Boolean).join(', ') || 'No'}
        />
      </Card>
      <Card title="System fields">
        <DetailRow label="Lead ID" value={lead.leadNo} />
        <DetailRow label="Created on" value={formatDateTime(lead.createdAt)} />
        <DetailRow label="Created via" value={lead.createdViaLabel ?? lead.createdVia} />
        <DetailRow label="Created by" value={lead.createdBy?.name ?? 'System'} />
        <DetailRow label="First source" value={lead.firstSource?.name} />
        <DetailRow label="Latest source" value={lead.source?.name} />
        {lead.meta?.campaignName && <DetailRow label="Meta campaign" value={lead.meta.campaignName} />}
        {lead.meta?.adsetName && <DetailRow label="Meta ad set" value={lead.meta.adsetName} />}
        {lead.meta?.adName && <DetailRow label="Meta ad" value={lead.meta.adName} />}
        {lead.meta?.formName && <DetailRow label="Meta form" value={lead.meta.formName} />}
        {lead.uploadFileName && <DetailRow label="Upload file" value={lead.uploadFileName} />}
        <DetailRow label="Owner" value={lead.owner?.name ?? 'Unassigned'} />
        <DetailRow label="Assigned on" value={formatDateTime(lead.assignedAt)} />
        <DetailRow label="Re-enquiry count" value={lead.reEnquiryCount ?? 0} />
        <DetailRow label="Profile completion" value={`${lead.profileCompletion ?? 0}%`} />
        <DetailRow label="Custom fields completion" value={`${lead.customFieldsCompletion ?? 0}%`} />
      </Card>
      <div className="space-y-4">
        <Card title="Recent calls">
          {!calls?.data.length && <p className="text-xs text-slate-400">No calls logged yet</p>}
          {calls?.data.slice(0, 5).map((c) => (
            <div key={c._id} className="border-b border-slate-50 py-1.5 text-xs last:border-0">
              <p className="font-medium text-slate-700">
                {c.subStage ?? c.stage} {c.durationSeconds ? `· ${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : ''}
              </p>
              <p className="text-slate-400">
                {c.user?.name} · {formatDateTime(c.createdAt)}
              </p>
            </div>
          ))}
        </Card>
        <Card title="SMS & email">
          {!messages?.data.length && <p className="text-xs text-slate-400">Nothing sent yet</p>}
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
              <Badge tone={m.status === 'delivered' ? 'green' : m.status === 'failed' || m.status === 'bounced' ? 'red' : 'blue'}>{m.status}</Badge>
            </div>
          ))}
        </Card>
      </div>
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
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState<'edit' | 'assign' | 'delete' | 'call' | 'update' | 'followup' | 'note' | 'sms' | 'email' | null>(null)

  const { data, isLoading, isError, error, refetch } = useGetLeadQuery(id, { skip: !id })
  const [deleteLead, { isLoading: deleting }] = useDeleteLeadMutation()
  const lead = data?.data
  const close = () => setModal(null)

  if (isError) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/leads')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to leads
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {initials(fullName(lead))}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold text-slate-800">{fullName(lead)}</h1>
                    <span className="text-xs text-slate-400">{lead.leadNo}</span>
                    {lead.stage && (
                      <Badge color={lead.stage.color}>
                        {lead.stage.name}
                        {subStageOf(lead) && <span className="font-normal opacity-80">· {subStageOf(lead)!.name}</span>}
                      </Badge>
                    )}
                    {!!lead.reEnquiryCount && <Badge tone="blue">Re-enquired ×{lead.reEnquiryCount}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {lead.mobile ?? '—'} · {lead.email ?? 'no email'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEdit && lead.mobile && (
                  // GL-40: until a dialer is connected, Call opens the phone's dialler, then the disposition popup
                  <a href={`tel:${lead.mobile}`} onClick={() => setTimeout(() => setModal('call'), 300)}>
                    <Button variant="outline" size="sm">
                      <Phone className="h-3.5 w-3.5" /> Call
                    </Button>
                  </a>
                )}
                {canEdit && (
                  <Button size="sm" onClick={() => setModal('call')}>
                    <PhoneCall className="h-3.5 w-3.5" /> Log Call / Update
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
                {canSend && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setModal('sms')}>
                      <MessageSquareText className="h-3.5 w-3.5" /> Send SMS
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setModal('email')}>
                      <Mail className="h-3.5 w-3.5" /> Send Email
                    </Button>
                  </>
                )}
                {can(user, 'leads', 'reassign') && (
                  <Button variant="outline" size="sm" onClick={() => setModal('assign')}>
                    <UserPlus className="h-3.5 w-3.5" /> {lead.owner ? 'Reassign' : 'Assign'}
                  </Button>
                )}
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => setModal('edit')} title="Edit lead fields">
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
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3 lg:grid-cols-6">
              <HeaderFact label="Owner">{lead.owner?.name ?? 'Unassigned'}</HeaderFact>
              <HeaderFact label="First source">{lead.firstSource?.name ?? '—'}</HeaderFact>
              <HeaderFact label="Latest source">{lead.source?.name ?? '—'}</HeaderFact>
              <HeaderFact label="Next follow-up" danger={lead.isOverdue}>
                {lead.nextFollowUpAt ? `${lead.isOverdue ? 'Overdue · ' : ''}${formatDateTime(lead.nextFollowUpAt)}` : 'None'}
              </HeaderFact>
              <HeaderFact label="Last activity">{timeAgo(lead.lastActivityAt)}</HeaderFact>
              <HeaderFact label="Program">{lead.programInterest?.name ?? '—'}</HeaderFact>
            </div>
          </>
        )}
      </div>

      {lead && subStageOf(lead)?.counsellorAction && (
        <div className="-mt-2 mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <b>Counsellor action:</b> {subStageOf(lead)!.counsellorAction}
          </p>
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'profile', label: 'Student Profile' },
          { key: 'discussion', label: 'Counsellor Discussion' },
          { key: 'timeline', label: 'Timeline' },
          ...(can(user, 'tasks', 'view') ? [{ key: 'followups', label: 'Follow-ups' }] : []),
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
          <OverviewTab lead={lead} />
        ) : tab === 'profile' ? (
          <LeadProfileTab leadId={lead._id} />
        ) : tab === 'discussion' ? (
          <CounsellorDiscussion leadId={lead._id} readOnly={!canEdit} />
        ) : tab === 'followups' ? (
          <LeadFollowUps leadId={lead._id} />
        ) : tab === 'timeline' ? (
          <LeadTimeline leadId={lead._id} />
        ) : tab === 'history' ? (
          <LeadHistory leadId={lead._id} />
        ) : (
          <LeadNotes leadId={lead._id} />
        )}
      </div>

      {lead && modal === 'edit' && <LeadFormDrawer open onClose={close} lead={lead} />}
      {lead && (modal === 'call' || modal === 'update') && <DispositionDrawer lead={lead} mode={modal} onClose={close} />}
      {lead && modal === 'followup' && <FollowUpFormModal leadId={lead._id} ownerId={lead.owner?._id} onClose={close} />}
      {lead && modal === 'assign' && <AssignLeadModal lead={lead} onClose={close} />}
      {lead && modal === 'note' && <AddNoteModal lead={lead} onClose={close} />}
      {lead && (modal === 'sms' || modal === 'email') && <SendMessageModal lead={lead} channel={modal} onClose={close} />}

      <ConfirmDialog
        open={modal === 'delete'}
        onClose={close}
        onConfirm={onDelete}
        title="Delete lead"
        message={`Delete ${lead ? fullName(lead) : 'this lead'} (${lead?.leadNo})? The record is soft-deleted and kept in the audit trail.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </>
  )
}
