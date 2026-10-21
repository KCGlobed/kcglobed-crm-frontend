import { useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Bold, Braces, Code, FileText, Image, Italic, Pencil, Plus, Save, Send, Strikethrough, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  useListMessageTemplatesQuery,
  useMessagingOptionsQuery,
  useSaveMessageTemplateMutation,
  useSubmitWhatsAppTemplateMutation,
  useUploadMessageAssetMutation,
  useUploadMessageAttachmentMutation,
} from '../../../services/messagingApi'
import { Button } from '../../../components/ui/Button'
import { Checkbox, FormField, Input, Select, Textarea } from '../../../components/ui/fields'
import { ConfirmDialog, EmptyState, Skeleton } from '../../../components/ui/feedback'
import { WhatsAppTemplatePreview } from '../../../components/whatsapp/TemplatePreview'
import { WhatsAppStatusBadge } from '../../../components/whatsapp/TemplateStatusBadge'
import { fillWaVariables, insertNextVariable, toWaTemplateName, waBodyProblem, waVariableCount, wrapSelection } from '../../../lib/whatsappFormat'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import type { MessageAsset, MessageTemplate, WhatsAppButtonType, WhatsAppHeaderFormat, WhatsAppTemplateButton, WhatsAppTemplateSpec } from '../../../types/models'

type Category = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  { key: 'MARKETING', label: 'Marketing', hint: 'Admission campaigns, offers, events, announcements. Meta limits how many one person receives.' },
  { key: 'UTILITY', label: 'Utility', hint: 'Updates on something the lead started: confirmations, reminders, results. Promotional text moves it to Marketing.' },
  { key: 'AUTHENTICATION', label: 'Authentication', hint: 'One-time passcodes. Meta fixes the text; you choose the extras.' },
]
const HEADER_FORMATS: [WhatsAppHeaderFormat, string][] = [
  ['NONE', 'None'],
  ['TEXT', 'Text'],
  ['IMAGE', 'Image'],
  ['DOCUMENT', 'PDF'],
]
const BUTTON_LABELS: Record<WhatsAppButtonType, string> = { QUICK_REPLY: 'Quick reply', URL: 'Visit website', PHONE_NUMBER: 'Call phone number' }
const LIMITS = { header: 60, body: 1024, footer: 60, button: 25, buttons: 10, urlButtons: 2, phoneButtons: 1 }
const AUTH_BODY = '*{{1}}* is your verification code.'
const AUTH_SECURITY = ' For your security, do not share this code.'
const SAMPLE_CODE = '123456'
const MEDIA: WhatsAppHeaderFormat[] = ['IMAGE', 'DOCUMENT']

/**
 * Communication → Templates → WhatsApp builder: a template is built here (category, name, language, header text /
 * image / PDF, body with {{n}} variables and their sample values, footer, buttons — or Meta's passcode format),
 * saved as a draft, submitted to Meta for review, and shows Meta's verdict. Live phone preview on the right.
 * A saved template opens read-only; Edit switches it to editing. Changing a submitted template sends the
 * changes to Meta for review again (Meta's rule), so that save asks for a confirmation first.
 * /app/admin/messaging/whatsapp/new or /…/whatsapp/<template id>.
 */
export default function WhatsAppTemplateBuilderPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const { data: templates, isLoading, isFetching } = useListMessageTemplatesQuery({ channel: 'whatsapp' })
  const existing = isNew ? undefined : templates?.data.find((t) => t._id === id)
  // editing is remembered per template id: a new template stays in editing after its first save moved the URL
  // to its id, while opening another template starts read-only. Cancel bumps `session`, which remounts the form
  // from the saved values — that is how it discards the changes.
  const [edit, setEdit] = useState({ id, on: isNew })
  const [session, setSession] = useState(0)
  const editing = edit.id === id ? edit.on : isNew
  const onEdit = (forId = id) => setEdit({ id: forId, on: true })
  const onView = (forId = id, discard = false) => {
    setEdit({ id: forId, on: false })
    if (discard) setSession((s) => s + 1)
  }

  if (!isNew && !existing) {
    // right after the first save the list is still refetching
    if (isLoading || isFetching) return <Skeleton className="h-96 w-full" />
    return <EmptyState title="WhatsApp template not found" action={<Button variant="outline" onClick={() => navigate('/app/admin/messaging')}>Back to templates</Button>} />
  }
  // keyed by the template, so the form starts from the saved values and a route change starts afresh
  return <Builder key={`${existing?._id ?? 'new'}-${session}`} template={existing} editing={editing} onEdit={onEdit} onView={onView} />
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-b border-slate-100 px-4 py-4 last:border-0">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {hint && <p className="text-[11px] leading-4 text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn('text-[11px]', value.length > max ? 'text-red-600' : 'text-slate-400')}>{value.length}/{max}</span>
}

function StatusBanner({ template, editing }: { template?: MessageTemplate; editing: boolean }) {
  const status = template?.waStatus
  const reason = template?.waRejectedReason
  // what a change means for a submitted template: Meta reviews every change (read-only: how to start one)
  const review = !template
    ? ''
    : editing
      ? ' Saving sends the changes to Meta for review; it cannot be sent until Meta approves them.'
      : ' Press Edit to change it — every change goes back to Meta for review.'
  const [tone, text]: [string, string] = !template || status === 'DRAFT'
    ? ['border-slate-200 bg-slate-50 text-slate-600', template && !editing
        ? 'Draft: saved in the CRM only. Press Edit to change it, or submit it for review when it is ready (Meta usually answers within minutes, at most 24 hours).'
        : 'Draft: saved in the CRM only. Submit it for review when it is ready; Meta usually answers within minutes, at most 24 hours.']
    : !status
      ? ['border-slate-200 bg-slate-50 text-slate-600', 'Added by hand before the builder and not checked with Meta. If it is in WhatsApp Manager, "Sync from WhatsApp" on the Templates tab brings in its status.']
      : status === 'PENDING'
        ? ['border-amber-200 bg-amber-50 text-amber-800', `Meta is reviewing this template${template.waSubmittedAt ? ` (submitted ${formatDateTime(template.waSubmittedAt)})` : ''}. It cannot be changed or sent until Meta answers; you get a notification then.`]
        : status === 'APPROVED'
          ? ['border-emerald-200 bg-emerald-50 text-emerald-800', `Approved by Meta: it can be sent${template.waQuality && template.waQuality !== 'UNKNOWN' ? ` · quality ${template.waQuality.toLowerCase()}` : ''}.${review}`]
          : status === 'REJECTED'
            ? ['border-red-200 bg-red-50 text-red-700', `Rejected by Meta${reason ? `: ${reason}` : ''}.${editing ? ' Saving sends the fixed template to Meta for review again.' : ' Press Edit to fix it and send it for review again.'}`]
            : status === 'FLAGGED'
              ? ['border-amber-200 bg-amber-50 text-amber-800', `Flagged for low quality${reason ? `: ${reason}` : ''}. It can still be sent; Meta pauses it if the quality does not improve.${review}`]
              : ['border-slate-200 bg-slate-50 text-slate-600', `${status.charAt(0)}${status.slice(1).toLowerCase().replace(/_/g, ' ')} at Meta${reason ? `: ${reason}` : ''}. It cannot be sent.${review}`]
  return <p className={cn('rounded-lg border px-3 py-2 text-xs', tone)}>{text}</p>
}

function Builder({
  template,
  editing,
  onEdit,
  onView,
}: {
  template?: MessageTemplate
  editing: boolean
  onEdit: (id?: string) => void
  onView: (id?: string, discard?: boolean) => void
}) {
  const navigate = useNavigate()
  const { data: options } = useMessagingOptionsQuery()
  const [save, { isLoading: saving }] = useSaveMessageTemplateMutation()
  const [submit, { isLoading: submitting }] = useSubmitWhatsAppTemplateMutation()
  const [uploadImage, { isLoading: uploadingImage }] = useUploadMessageAssetMutation()
  const [uploadFile, { isLoading: uploadingFile }] = useUploadMessageAttachmentMutation()
  const spec = template?.waSpec
  const startCategory = CATEGORIES.some((c) => c.key === template?.waCategory) ? (template?.waCategory as Category) : 'MARKETING'

  const [category, setCategory] = useState<Category>(startCategory)
  const [name, setName] = useState(template?.waTemplateName ?? '')
  const [language, setLanguage] = useState(template?.waLanguage ?? 'en')
  const [headerFormat, setHeaderFormat] = useState<WhatsAppHeaderFormat>(spec?.header.format ?? 'NONE')
  const [headerText, setHeaderText] = useState(spec?.header.text ?? '')
  const [headerAsset, setHeaderAsset] = useState<MessageAsset | null>(template?.waHeaderAsset ?? null)
  const [body, setBody] = useState(spec?.body ?? template?.body ?? '')
  const [examples, setExamples] = useState<string[]>(spec?.examples ?? [])
  const [footer, setFooter] = useState(spec?.footer ?? '')
  const [buttons, setButtons] = useState<WhatsAppTemplateButton[]>(spec?.buttons ?? [])
  const [security, setSecurity] = useState(spec?.auth?.securityRecommendation ?? true)
  const [expiry, setExpiry] = useState(spec?.auth ? String(spec.auth.codeExpirationMinutes ?? '') : '10')
  const [copyText, setCopyText] = useState(spec?.auth?.copyCodeText ?? 'Copy code')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const auth = category === 'AUTHENTICATION'
  const submitted = !!template?.waTemplateId
  const unsupported = !!spec && (['VIDEO', 'LOCATION'].includes(spec.header.format) || spec.buttons.some((b) => !BUTTON_LABELS[b.type]))
  // no changes while Meta reviews, or when the template uses something the builder cannot edit
  const editable = template?.waStatus !== 'PENDING' && !unsupported
  const readOnly = !editing || !editable
  const count = waVariableCount(body)
  const bodyProblem = body.trim() ? waBodyProblem(body) : null
  const languages = options?.data.whatsappLanguages ?? [{ value: 'en', label: 'English' }]
  const languageOptions = languages.some((l) => l.value === language) ? languages : [...languages, { value: language, label: language }]
  const urlButtons = buttons.filter((b) => b.type === 'URL').length
  const phoneButtons = buttons.filter((b) => b.type === 'PHONE_NUMBER').length

  const touched = () => setDirty(true)
  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    touched()
  }

  const buildSpec = (): WhatsAppTemplateSpec =>
    auth
      ? {
          header: { format: 'NONE' },
          body: '',
          examples: [],
          buttons: [],
          auth: { securityRecommendation: security, codeExpirationMinutes: expiry.trim() ? Number(expiry) : null, copyCodeText: copyText },
        }
      : {
          header: {
            format: headerFormat,
            ...(headerFormat === 'TEXT' ? { text: headerText } : {}),
            ...(MEDIA.includes(headerFormat) && headerAsset ? { assetId: headerAsset._id } : {}),
          },
          body,
          examples: Array.from({ length: count }, (_, i) => examples[i] ?? ''),
          footer,
          buttons,
        }

  /** Save: a draft stays in the CRM; a submitted template's changes go to Meta for review again. */
  const persist = async (): Promise<MessageTemplate | null> => {
    try {
      const res = await save({
        id: template?._id,
        body: { channel: 'whatsapp', waTemplateName: name, waLanguage: language, waCategory: category, waSpec: buildSpec() },
      }).unwrap()
      setErrors({})
      setDirty(false)
      return res.data
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
      return null
    }
  }
  /** Save draft: keeps editing. On a submitted template the changes went to Meta (or nothing changed for it): back to viewing. */
  const onSave = async () => {
    const saved = await persist()
    setConfirming(false)
    if (!saved) return
    if (submitted) {
      toast.success(saved.resubmitted ? 'Changes sent to Meta for review' : 'Saved — nothing changed for Meta')
      return onView()
    }
    toast.success('Draft saved')
    if (!template) {
      onEdit(saved._id)
      navigate(`/app/admin/messaging/whatsapp/${saved._id}`, { replace: true })
    }
  }
  /** Submit for review: back to viewing once Meta has it; on a refusal the draft is saved and stays open for fixing. */
  const onSubmit = async () => {
    const saved = dirty || !template ? await persist() : template
    if (!saved) return setConfirming(false)
    let accepted = false
    try {
      const res = await submit(saved._id).unwrap()
      toast.success(res.message)
      accepted = true
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
    setConfirming(false)
    if (accepted) onView(saved._id)
    else onEdit(saved._id)
    if (!template) navigate(`/app/admin/messaging/whatsapp/${saved._id}`, { replace: true }) // the draft is saved either way
  }
  const cancel = () => (dirty ? setDiscarding(true) : onView())
  const toggleActive = async (value: boolean) => {
    if (!template) return
    try {
      await save({ id: template._id, body: { isActive: value } }).unwrap()
      toast.success(value ? 'Template switched on' : 'Template switched off: it is not offered when sending')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  // ---------------------------------------------------------------- body toolbar
  const applyBody = ({ text, caret }: { text: string; caret: number }) => {
    setBody(text.slice(0, LIMITS.body))
    touched()
    requestAnimationFrame(() => {
      bodyRef.current?.focus()
      bodyRef.current?.setSelectionRange(caret, caret)
    })
  }
  const wrap = (marker: string) => {
    const el = bodyRef.current
    applyBody(wrapSelection(body, el?.selectionStart ?? body.length, el?.selectionEnd ?? body.length, marker))
  }
  const addVariable = () => applyBody(insertNextVariable(body, bodyRef.current?.selectionStart ?? body.length))
  const setExample = (i: number, value: string) => {
    setExamples((xs) => Array.from({ length: Math.max(xs.length, count) }, (_, j) => (j === i ? value : (xs[j] ?? ''))))
    touched()
  }

  // ---------------------------------------------------------------- header
  const chooseHeader = (format: WhatsAppHeaderFormat) => {
    setHeaderFormat(format)
    const fits = headerAsset && (format === 'IMAGE' ? headerAsset.contentType.startsWith('image/') : headerAsset.contentType === 'application/pdf')
    if (!fits) setHeaderAsset(null)
    touched()
  }
  const onUpload = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    const image = headerFormat === 'IMAGE'
    if (image ? !['image/png', 'image/jpeg'].includes(file.type) : file.type !== 'application/pdf') {
      return toast.error(image ? 'The header image must be a JPG or PNG' : 'The header document must be a PDF')
    }
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await (image ? uploadImage(form) : uploadFile(form)).unwrap()
      setHeaderAsset(res.data)
      setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'waSpec.header.assetId')))
      touched()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  // ---------------------------------------------------------------- buttons
  const addButton = (type: WhatsAppButtonType) => {
    setButtons((bs) => [...bs, { type, text: '', ...(type === 'URL' ? { url: 'https://' } : type === 'PHONE_NUMBER' ? { phone: '+91' } : {}) }])
    touched()
  }
  const updateButton = (i: number, patch: Partial<WhatsAppTemplateButton>) => {
    setButtons((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)))
    touched()
  }
  const removeButton = (i: number) => {
    setButtons((bs) => bs.filter((_, j) => j !== i))
    touched()
  }

  // ---------------------------------------------------------------- preview
  const preview = auth
    ? {
        body: fillWaVariables(AUTH_BODY + (security ? AUTH_SECURITY : ''), [SAMPLE_CODE]),
        footer: expiry.trim() ? `This code expires in ${expiry.trim()} minutes.` : null,
        buttons: [{ type: 'OTP', text: copyText || 'Copy code' }],
      }
    : { body: fillWaVariables(body, examples), footer, buttons }

  const ready = !!name.trim() && (auth || !!body.trim())
  const busy = saving || submitting

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/messaging')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Templates
        </Button>
        <h1 className="truncate text-base font-semibold text-slate-800">{template ? `WhatsApp · ${template.name}` : 'New WhatsApp template'}</h1>
        {template && <WhatsAppStatusBadge status={template.waStatus} reason={template.waRejectedReason} />}
        {dirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">Unsaved changes</span>}
        <div className="ml-auto flex items-center gap-2">
          {template && ['APPROVED', 'FLAGGED'].includes(template.waStatus ?? '') && (
            <label className="mr-2 flex items-center gap-1.5 text-xs text-slate-600" title="Switched off, it is not offered when sending">
              <Checkbox checked={template.isActive} disabled={busy} onChange={(e) => toggleActive(e.target.checked)} /> Active
            </label>
          )}
          {!editing && template && editable && (
            <Button size="sm" onClick={() => onEdit()} title={submitted ? 'Changes go to Meta for review again' : 'Change this draft'}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {editing && template && (
            <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          )}
          {!readOnly && !submitted && (
            <>
              <Button variant="outline" size="sm" onClick={onSave} loading={saving && !confirming} disabled={!ready || busy}>
                <Save className="h-3.5 w-3.5" /> Save draft
              </Button>
              <Button size="sm" onClick={() => setConfirming(true)} disabled={!ready || busy}>
                <Send className="h-3.5 w-3.5" /> Submit for review
              </Button>
            </>
          )}
          {!readOnly && submitted && (
            <Button size="sm" onClick={() => setConfirming(true)} disabled={!dirty || busy} title="Meta reviews every change to a submitted template">
              <Send className="h-3.5 w-3.5" /> Save &amp; send for review
            </Button>
          )}
        </div>
      </div>

      <StatusBanner template={template} editing={editing} />
      {unsupported && (
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> This template uses something the builder cannot edit (a video or location header, or a
          special button). Change it in WhatsApp Manager.
        </p>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <fieldset disabled={readOnly} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <Section title="Category" hint={submitted ? 'Fixed once submitted; Meta can move a template to another category.' : 'Meta checks that the content fits it, and prices each message by it.'}>
            <div className="grid gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={submitted}
                  onClick={() => change(setCategory)(c.key)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed',
                    category === c.key ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300',
                    submitted && category !== c.key && 'opacity-50'
                  )}
                >
                  <p className="text-sm font-semibold text-slate-800">{c.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{c.hint}</p>
                </button>
              ))}
            </div>
            {errors.waCategory && <p className="text-[11px] font-medium text-red-600">{errors.waCategory}</p>}
          </Section>

          <Section title="Name and language">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <FormField label="Template name" required error={errors.waTemplateName ?? errors.name} hint="Lowercase letters, digits and _ — fixed once submitted">
                <Input value={name} disabled={submitted} onChange={(e) => change(setName)(toWaTemplateName(e.target.value))} placeholder="e.g. counselling_reminder" />
              </FormField>
              <FormField label="Language" required error={errors.waLanguage}>
                <Select value={language} disabled={submitted} onChange={(e) => change(setLanguage)(e.target.value)}>
                  {languageOptions.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label} ({l.value})
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </Section>

          {auth ? (
            <Section title="Passcode message" hint="Meta's fixed format: the code is the one value typed when sending, and the button copies it.">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={security} onChange={(e) => change(setSecurity)(e.target.checked)} /> Add the security line "For your security, do not share this code."
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Code expires after (minutes)" error={errors['waSpec.auth.codeExpirationMinutes']} hint="1 to 90; leave empty for no expiry line">
                  <Input type="number" min={1} max={90} value={expiry} onChange={(e) => change(setExpiry)(e.target.value)} />
                </FormField>
                <FormField label="Copy-code button text" error={errors['waSpec.auth.copyCodeText']}>
                  <Input value={copyText} maxLength={LIMITS.button} onChange={(e) => change(setCopyText)(e.target.value)} />
                </FormField>
              </div>
            </Section>
          ) : (
            <>
              <Section title="Header" hint="Optional: a title line, or an image / PDF shown above the text. The file uploaded here is sent with every message.">
                <div className="flex w-fit overflow-hidden rounded-md border border-slate-300 text-xs font-medium">
                  {HEADER_FORMATS.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => chooseHeader(key)}
                      className={cn('px-3 py-1.5', headerFormat === key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {headerFormat === 'TEXT' && (
                  <FormField label="Header text" error={errors['waSpec.header.text']} hint="One line, no variables or formatting">
                    <div className="flex items-center gap-2">
                      <Input value={headerText} maxLength={LIMITS.header} onChange={(e) => change(setHeaderText)(e.target.value.replace(/\n/g, ' '))} />
                      <Counter value={headerText} max={LIMITS.header} />
                    </div>
                  </FormField>
                )}
                {MEDIA.includes(headerFormat) && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept={headerFormat === 'IMAGE' ? 'image/png,image/jpeg' : 'application/pdf'}
                        onChange={(e) => onUpload(e.target.files?.[0])}
                      />
                      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={uploadingImage || uploadingFile}>
                        <Upload className="h-3.5 w-3.5" /> {headerAsset ? 'Replace' : 'Upload'} {headerFormat === 'IMAGE' ? 'image' : 'PDF'}
                      </Button>
                      {headerAsset && (
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
                          {headerFormat === 'IMAGE' ? <Image className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{headerAsset.name}</span>
                          <span className="text-slate-400">· {Math.max(1, Math.round(headerAsset.size / 1024))} KB</span>
                        </span>
                      )}
                    </div>
                    <p className={cn('text-[11px]', errors['waSpec.header.assetId'] ? 'font-medium text-red-600' : 'text-slate-500')}>
                      {errors['waSpec.header.assetId'] ?? (headerFormat === 'IMAGE' ? 'JPG or PNG, up to 5 MB' : 'PDF, up to 8 MB')}
                    </p>
                  </div>
                )}
              </Section>

              <Section title="Message text" hint="Up to 1,024 characters. {{1}}, {{2}} … are filled when sending: typed, or from the lead's fields.">
                <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
                  <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
                    {(
                      [
                        ['*', Bold, 'Bold'],
                        ['_', Italic, 'Italic'],
                        ['~', Strikethrough, 'Strikethrough'],
                        ['```', Code, 'Monospace'],
                      ] as const
                    ).map(([marker, Icon, label]) => (
                      <button key={label} type="button" title={label} aria-label={label} onClick={() => wrap(marker)} className="rounded p-1.5 text-slate-600 hover:bg-slate-200">
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                    <span className="mx-1 h-4 w-px bg-slate-300" />
                    <button type="button" onClick={addVariable} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                      <Braces className="h-3.5 w-3.5" /> Add variable
                    </button>
                    <span className="ml-auto pr-1">
                      <Counter value={body} max={LIMITS.body} />
                    </span>
                  </div>
                  <Textarea
                    ref={bodyRef}
                    rows={7}
                    value={body}
                    maxLength={LIMITS.body}
                    onChange={(e) => change(setBody)(e.target.value)}
                    placeholder="Hi {{1}}, your counselling session is on {{2}}. Reply to confirm."
                    className="rounded-none border-0 shadow-none focus:ring-0"
                  />
                </div>
                {(errors['waSpec.body'] || bodyProblem) && <p className="text-[11px] font-medium text-red-600">{errors['waSpec.body'] ?? bodyProblem}</p>}
                {count > 0 && (
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Sample values: Meta reviews the template with them. They are not sent to leads.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Array.from({ length: count }, (_, i) => (
                        <FormField key={i} label={`{{${i + 1}}}`} required error={errors[`waSpec.examples.${i}`]}>
                          <Input value={examples[i] ?? ''} maxLength={200} onChange={(e) => setExample(i, e.target.value)} placeholder={i === 0 ? 'e.g. Asha' : 'e.g. 12 Nov, 4 pm'} />
                        </FormField>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Footer" hint="Optional: a short grey line under the text, e.g. the school name. No variables.">
                <FormField label="Footer text" error={errors['waSpec.footer']}>
                  <div className="flex items-center gap-2">
                    <Input value={footer} maxLength={LIMITS.footer} onChange={(e) => change(setFooter)(e.target.value)} />
                    <Counter value={footer} max={LIMITS.footer} />
                  </div>
                </FormField>
              </Section>

              <Section title="Buttons" hint="Optional, up to 10: quick replies, up to 2 website links and 1 call button. Quick replies are shown first.">
                {buttons.map((b, i) => (
                  <div key={i} className="grid items-start gap-2 rounded-lg border border-slate-200 p-2.5 sm:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
                    <span className="pt-2 text-xs font-medium text-slate-600">{BUTTON_LABELS[b.type] ?? b.type}</span>
                    <FormField label="Button text" error={errors[`waSpec.buttons.${i}.text`]}>
                      <Input value={b.text} maxLength={LIMITS.button} onChange={(e) => updateButton(i, { text: e.target.value })} />
                    </FormField>
                    {b.type === 'URL' ? (
                      <FormField label="Website address" error={errors[`waSpec.buttons.${i}.url`]}>
                        <Input value={b.url ?? ''} onChange={(e) => updateButton(i, { url: e.target.value.trim() })} placeholder="https://gccschool.com" />
                      </FormField>
                    ) : b.type === 'PHONE_NUMBER' ? (
                      <FormField label="Phone number" error={errors[`waSpec.buttons.${i}.phone`]}>
                        <Input value={b.phone ?? ''} onChange={(e) => updateButton(i, { phone: e.target.value })} placeholder="+919876543210" />
                      </FormField>
                    ) : (
                      <span />
                    )}
                    <Button variant="ghost" size="icon" className="mt-5 text-red-600" title="Remove button" aria-label="Remove button" onClick={() => removeButton(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {errors['waSpec.buttons'] && <p className="text-[11px] font-medium text-red-600">{errors['waSpec.buttons']}</p>}
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(BUTTON_LABELS) as WhatsAppButtonType[]).map((type) => {
                    const full =
                      buttons.length >= LIMITS.buttons ||
                      (type === 'URL' && urlButtons >= LIMITS.urlButtons) ||
                      (type === 'PHONE_NUMBER' && phoneButtons >= LIMITS.phoneButtons)
                    return (
                      <Button key={type} variant="outline" size="sm" disabled={full} onClick={() => addButton(type)}>
                        <Plus className="h-3.5 w-3.5" /> {BUTTON_LABELS[type]}
                      </Button>
                    )
                  })}
                </div>
              </Section>
            </>
          )}
        </fieldset>

        <div className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-4 xl:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Preview · with the sample values</p>
          <WhatsAppTemplatePreview
            headerFormat={auth ? 'NONE' : headerFormat}
            headerText={headerText}
            headerImageUrl={headerFormat === 'IMAGE' ? headerAsset?.url : undefined}
            headerFileName={headerFormat === 'DOCUMENT' ? headerAsset?.name : undefined}
            body={preview.body}
            footer={preview.footer}
            buttons={preview.buttons}
            className="min-h-[18rem]"
          />
          <p className="text-[11px] leading-4 text-slate-500">
            {auth
              ? 'Meta writes the passcode text itself; this is how it looks with a sample code.'
              : 'WhatsApp shows at most three buttons in the chat; more fold into "See all options".'}
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submitted ? onSave : onSubmit}
        title={submitted ? 'Send the changes to Meta for review?' : 'Submit for review?'}
        message={
          submitted
            ? 'Meta reviews every change to a submitted template. After this, the template goes back to Pending and cannot be sent until Meta approves it again (usually within minutes, at most 24 hours); you get a notification. Meta allows changing an approved template once a day, up to 10 times a month.'
            : `"${name}" goes to Meta for review, usually answered within minutes (at most 24 hours); you get a notification. Its name, language and category cannot change after this.`
        }
        confirmLabel={submitted ? 'Send for review' : 'Submit'}
        loading={busy}
      />
      <ConfirmDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => onView(undefined, true)}
        title="Discard changes?"
        message="Your unsaved changes to this template will be lost."
        confirmLabel="Discard"
        danger
      />
    </div>
  )
}
