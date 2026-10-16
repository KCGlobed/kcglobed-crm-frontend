import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Monitor, Save, Send, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../app/hooks'
import { useListMessageTemplatesQuery, useMessagingOptionsQuery, useSaveMessageTemplateMutation, useSendTestEmailMutation } from '../../../services/messagingApi'
import { Button } from '../../../components/ui/Button'
import { Checkbox } from '../../../components/ui/fields'
import { EmptyState, Skeleton } from '../../../components/ui/feedback'
import { EmailEditor } from '../../../components/email/EmailEditor'
import { EmailPreview } from '../../../components/email/EmailPreview'
import { AttachmentList } from '../../../components/email/AttachmentList'
import { fillSamplePlaceholders } from '../../../lib/emailPreview'
import { cn, parseApiError } from '../../../lib/utils'
import type { MessageAsset, MessageTemplate } from '../../../types/models'

/**
 * Communication → email designer (GL-21), laid out like a mail client's compose window: Save / Send test
 * at the top, the name and subject lines, the editor (visual or HTML) filling the page, and a live
 * desktop / phone preview with sample lead values that can be shown or hidden.
 * /app/admin/messaging/email/new or /…/email/<template id>.
 */
export default function EmailDesignerPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { data: templates, isLoading } = useListMessageTemplatesQuery({ channel: 'email' })
  const existing = isNew ? undefined : templates?.data.find((t) => t._id === id)

  if (!isNew && isLoading) return <Skeleton className="h-96 w-full" />
  if (!isNew && !existing) {
    return <EmptyState title="Email template not found" action={<Button variant="outline" onClick={() => navigate('/app/admin/messaging')}>Back to templates</Button>} />
  }
  // keyed by the template, so the form starts from the saved values and a route change starts afresh
  return <Composer key={existing?._id ?? 'new'} template={existing} />
}

const line = 'flex items-center gap-3 border-b border-slate-200 px-4 py-2 text-sm'
const lineLabel = 'w-20 shrink-0 text-slate-500'
const lineInput = 'min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0'

function Composer({ template }: { template?: MessageTemplate }) {
  const navigate = useNavigate()
  const me = useCurrentUser()
  const { data: options } = useMessagingOptionsQuery()
  const [save, { isLoading: saving }] = useSaveMessageTemplateMutation()
  const [sendTest, { isLoading: testing }] = useSendTestEmailMutation()

  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [active, setActive] = useState(template?.isActive ?? true)
  const [attachments, setAttachments] = useState<MessageAsset[]>(template?.attachments ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [showPreview, setShowPreview] = useState(true)
  const [dirty, setDirty] = useState(false)

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setDirty(true)
  }

  const onSave = async () => {
    try {
      const res = await save({
        id: template?._id,
        body: { name, channel: 'email', subject, body, isActive: active, attachments: attachments.map((a) => a._id) },
      }).unwrap()
      setErrors({})
      setDirty(false)
      toast.success('Email template saved')
      if (!template) navigate(`/app/admin/messaging/email/${res.data._id}`, { replace: true })
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }
  const onTest = async () => {
    try {
      const res = await sendTest({ subject, body, attachments: attachments.map((a) => a._id) }).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const problems = [errors.name, errors.subject, errors.body].filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/messaging')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Templates
        </Button>
        <h1 className="truncate text-base font-semibold text-slate-800">{template ? `Email · ${template.name}` : 'New email'}</h1>
        {dirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Unsaved changes</span>}
        <div className="ml-auto flex items-center gap-2">
          <label className="mr-2 flex items-center gap-1.5 text-xs text-slate-600">
            <Checkbox checked={active} onChange={(e) => change(setActive)(e.target.checked)} /> Active
          </label>
          <Button variant="outline" size="sm" onClick={onTest} loading={testing} disabled={!body.trim()} title={me?.email ? `Sends to ${me.email}` : undefined}>
            <Send className="h-3.5 w-3.5" /> Send test to me
          </Button>
          <Button size="sm" onClick={onSave} loading={saving} disabled={!name.trim() || !subject.trim() || !body.trim()}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className={cn('grid gap-3', showPreview && 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
        {/* the compose window */}
        <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className={line}>
            <span className={lineLabel}>Name</span>
            <input className={lineInput} value={name} onChange={(e) => change(setName)(e.target.value)} maxLength={120} placeholder="Template name, e.g. Welcome email" aria-label="Template name" />
          </div>
          <div className={line}>
            <span className={lineLabel}>Subject</span>
            <input className={lineInput} value={subject} onChange={(e) => change(setSubject)(e.target.value)} maxLength={200} placeholder="Add a subject — placeholders like {first_name} work here" aria-label="Subject" />
          </div>
          <div className="border-b border-slate-200 px-3 py-1">
            <AttachmentList attachments={attachments} onChange={change(setAttachments)} />
          </div>
          <EmailEditor frameless value={body} onChange={change(setBody)} placeholders={options?.data.placeholders ?? []} height="calc(100vh - 17rem)" />
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-500">
            <span>{problems.length ? <span className="text-red-600">{problems.join(' · ')}</span> : 'Placeholders are filled from the lead when the email is sent; the unsubscribe line is added automatically.'}</span>
            <button type="button" className="inline-flex shrink-0 items-center gap-1 font-medium text-brand-600 hover:underline" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview · sample lead</p>
              <div className="flex overflow-hidden rounded-md border border-slate-300 text-[11px] font-medium">
                {(
                  [
                    ['desktop', 'Desktop', Monitor],
                    ['mobile', 'Phone', Smartphone],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDevice(key)}
                    className={cn('inline-flex items-center gap-1 px-2 py-1', device === key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100')}
                  >
                    <Icon className="h-3 w-3" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
              <span className="text-slate-400">Subject · </span>
              {fillSamplePlaceholders(subject) || '—'}
            </p>
            <AttachmentList attachments={attachments} readOnly />
            <EmailPreview html={body} sample height="calc(100vh - 15rem)" width={device === 'mobile' ? '375px' : '100%'} />
          </div>
        )}
      </div>
    </div>
  )
}
