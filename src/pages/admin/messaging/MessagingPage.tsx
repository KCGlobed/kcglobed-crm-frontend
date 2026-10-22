import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCancelCampaignMutation,
  useDeleteMessageTemplateMutation,
  useGetCampaignQuery,
  useListCampaignsQuery,
  useListMessageTemplatesQuery,
  useMessagingOptionsQuery,
  useSaveMessageTemplateMutation,
  useSyncWhatsAppTemplatesMutation,
} from '../../../services/messagingApi'
import { useCurrentUser } from '../../../app/hooks'
import { ConfirmDialog } from '../../../components/ui/feedback'
import { PageHeader, Tabs } from '../../../components/ui/misc'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Checkbox, FormField, Input, Select, Textarea } from '../../../components/ui/fields'
import { Drawer } from '../../../components/ui/Drawer'
import { Modal } from '../../../components/ui/Modal'
import { EmptyState, Skeleton } from '../../../components/ui/feedback'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import type { CampaignRow, MessageTemplate } from '../../../types/models'
import { AutomationsTab } from './AutomationsTab'
import { TextsTab } from './TextsTab'

function TemplateDrawer({ template, onClose }: { template?: MessageTemplate; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: options } = useMessagingOptionsQuery()
  const [save, { isLoading }] = useSaveMessageTemplateMutation()
  const [channel, setChannel] = useState<'sms' | 'email' | 'whatsapp'>(template?.channel ?? 'sms')
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [dlt, setDlt] = useState(template?.dltTemplateId ?? '')
  const [sender, setSender] = useState(template?.senderId ?? '')
  const [dltType, setDltType] = useState<'implicit' | 'explicit'>(template?.dltType ?? 'implicit')
  const [waName, setWaName] = useState(template?.waTemplateName ?? '')
  const [waLang, setWaLang] = useState(template?.waLanguage ?? 'en')
  const [active, setActive] = useState(template?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onSave = async () => {
    try {
      await save({
        id: template?._id,
        body: {
          name,
          channel,
          body,
          isActive: active,
          ...(channel === 'sms'
            ? { dltTemplateId: dlt, senderId: sender, dltType }
            : channel === 'whatsapp'
              ? { waTemplateName: waName, waLanguage: waLang }
              : { subject }),
        },
      }).unwrap()
      toast.success('Template saved')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  const insert = (p: string) => setBody((b) => `${b}{${p}}`)

  return (
    <Drawer
      open
      wide
      onClose={onClose}
      title={template ? `Edit template · ${template.name}` : 'New template'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isLoading}>
            Save template
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name" required error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </FormField>
          <FormField label="Channel" required error={errors.channel}>
            <Select value={channel} disabled={!!template} onChange={(e) => setChannel(e.target.value as 'sms' | 'email' | 'whatsapp')}>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>
          </FormField>
        </div>
        {channel === 'sms' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField label="DLT Template ID" required error={errors.dltTemplateId} hint="From the DLT portal (TRAI)">
              <Input value={dlt} onChange={(e) => setDlt(e.target.value.replace(/\D/g, ''))} />
            </FormField>
            <FormField label="Sender ID" required error={errors.senderId} hint="6-letter DLT header, e.g. GCCSCH">
              <Input value={sender} maxLength={6} onChange={(e) => setSender(e.target.value.toUpperCase())} />
            </FormField>
            <FormField
              label="DLT Template Type"
              required
              error={errors.dltType}
              hint={dltType === 'explicit' ? 'Promotional channel · delivered 10 am – 9 pm, not to DND numbers' : 'Service / OTP · any time, DND numbers too'}
            >
              <Select value={dltType} onChange={(e) => setDltType(e.target.value as 'implicit' | 'explicit')}>
                <option value="implicit">Implicit</option>
                <option value="explicit">Explicit</option>
              </Select>
            </FormField>
          </div>
        ) : channel === 'whatsapp' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField label="WhatsApp template name" required error={errors.waTemplateName} hint="Exactly as in WhatsApp Manager, e.g. repostregistration">
              <Input value={waName} onChange={(e) => setWaName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} maxLength={120} />
            </FormField>
            <FormField label="Language" required error={errors.waLanguage} hint="Template language code, e.g. en, en_US, hi">
              <Input value={waLang} onChange={(e) => setWaLang(e.target.value.trim())} maxLength={15} />
            </FormField>
            <FormField label="WhatsApp review" hint={template?.waStatus ? `${template.waCategory ?? ''} · from the last sync` : 'Use "Sync from WhatsApp" to pull approved templates'}>
              <div className="pt-1.5">
                <Badge tone={template?.waStatus === 'APPROVED' ? 'green' : template?.waStatus ? 'amber' : 'slate'}>{template?.waStatus ?? 'Manual'}</Badge>
              </div>
            </FormField>
          </div>
        ) : (
          <FormField label="Subject" required error={errors.subject}>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </FormField>
        )}
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
          Placeholders:
          {options?.data.placeholders.map((p) => (
            <button key={p} type="button" onClick={() => insert(p)} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700 hover:bg-brand-50">
              {`{${p}}`}
            </button>
          ))}
          {channel === 'sms' && (
            <button type="button" onClick={() => setBody((b) => `${b}{#var#}`)} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700 hover:bg-brand-50">
              {'{#var#}'}
            </button>
          )}
          {channel === 'whatsapp' && (
            <button
              type="button"
              onClick={() => setBody((b) => `${b}{{${(b.match(/\{\{\d+\}\}/g)?.length ?? 0) + 1}}}`)}
              className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700 hover:bg-brand-50"
            >
              {'{{n}}'}
            </button>
          )}
          <span>
            · a missing value is removed, never sent raw
            {channel === 'sms' && ' · {#var#} is a DLT variable typed when sending (max 30 characters)'}
            {channel === 'whatsapp' && ' · {{1}}, {{2}} … are the template parameters typed or picked from the lead when sending'}
          </span>
        </div>
        <FormField
          label={channel === 'sms' ? 'SMS text (must match the DLT-approved format)' : channel === 'whatsapp' ? 'WhatsApp body (must match the approved template)' : 'Email body'}
          required
          error={errors.body}
        >
          {channel === 'sms' ? (
            <Textarea rows={5} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          ) : channel === 'whatsapp' ? (
            <Textarea rows={6} maxLength={1024} value={body} onChange={(e) => setBody(e.target.value)} />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              Emails are built in the email designer: visual editor or pasted HTML, images, call-to-action buttons and a live desktop / phone preview.
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => navigate(template ? `/app/admin/messaging/email/${template._id}` : '/app/admin/messaging/email/new')}>
                  <Mail className="h-3.5 w-3.5" /> Open the email designer
                </Button>
              </div>
            </div>
          )}
        </FormField>
        {channel !== 'email' && <p className="text-right text-[11px] text-slate-400">{body.length} characters</p>}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>
    </Drawer>
  )
}

function TemplatesTab() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { data, isLoading } = useListMessageTemplatesQuery({})
  const { data: options } = useMessagingOptionsQuery()
  const [sync, { isLoading: syncing }] = useSyncWhatsAppTemplatesMutation()
  const [remove, { isLoading: removing }] = useDeleteMessageTemplateMutation()
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null)
  const onDelete = async () => {
    if (!deleting) return
    try {
      const res = await remove(deleting._id).unwrap()
      toast.success(res.message)
      setDeleting(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
      setDeleting(null)
    }
  }
  const syncWhatsApp = async () => {
    try {
      const res = await sync().unwrap()
      const c = res.data
      toast.success(
        `WhatsApp templates synced: ${c.created} new, ${c.updated} updated, ${c.approved} approved${c.removed ? `, ${c.removed} removed (not in the connected account)` : ''}${c.skipped ? `, ${c.skipped} skipped (no text body)` : ''}`
      )
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  return (
    <>
      <div className="mb-3 flex justify-end gap-2">
        {options?.data.whatsappProvider === 'meta' && (
          <Button size="sm" variant="outline" onClick={syncWhatsApp} loading={syncing} title="Pull the templates approved in WhatsApp Manager">
            <RefreshCw className="h-3.5 w-3.5" /> Sync from WhatsApp
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => navigate('/app/admin/messaging/email/new')} title="Email designer: visual editor, HTML, images, preview">
          <Mail className="h-3.5 w-3.5" /> New email
        </Button>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" /> New template
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data?.data.length ? (
        <EmptyState title="No templates yet" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">DLT / WhatsApp / Subject</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Updated</th>
                {user?.isSuperAdmin && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((t) => (
                <tr key={t._id} className="cursor-pointer hover:bg-slate-50" onClick={() => (t.channel === 'email' ? navigate(`/app/admin/messaging/email/${t._id}`) : setEditing(t))}>
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-2">
                    <Badge tone={t.channel === 'sms' ? 'blue' : t.channel === 'whatsapp' ? 'green' : 'violet'}>{t.channel.toUpperCase()}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {t.channel === 'sms'
                      ? `${t.dltTemplateId} · ${t.senderId}`
                      : t.channel === 'whatsapp'
                        ? `${t.waTemplateName} · ${t.waLanguage}${t.waStatus ? ` · ${t.waStatus}` : ''}`
                        : t.subject}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={t.isActive ? 'green' : 'slate'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{formatDateTime(t.updatedAt)}</td>
                  {user?.isSuperAdmin && (
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        title="Delete template (Super Admin)"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleting(t)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <TemplateDrawer template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        title="Delete Template"
        message={`Delete "${deleting?.name}" (${deleting?.channel.toUpperCase()}) permanently? If campaigns or automations use it, the delete is refused — deactivate it instead.`}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </>
  )
}

function CampaignReport({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useGetCampaignQuery(id, { pollingInterval: 5000 })
  const c = data?.data
  return (
    <Modal open onClose={onClose} size="lg" title={c?.name ?? 'Campaign'} description={c ? `${c.channel.toUpperCase()} · ${c.template} · ${c.status}` : undefined}>
      {!c ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {(['queued', 'sent', 'delivered', 'failed', 'bounced'] as const).map((k) => (
              <div key={k} className="rounded-lg border border-slate-200 p-2 text-center">
                <p className="text-lg font-semibold text-slate-800">{c.report[k]}</p>
                <p className="text-[11px] capitalize text-slate-500">{k}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Selected {c.counts.selected} · excluded {c.counts.excluded?.optedOut ?? 0} opted out, {c.counts.excluded?.invalid ?? 0} invalid,{' '}
            {c.counts.excluded?.duplicate ?? 0} duplicate · final {c.counts.final}
          </p>
          {!!c.failures?.length && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {c.failures.map((f, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 text-slate-500">{f.lead}</td>
                      <td className="px-3 py-1.5 text-slate-700">{f.name}</td>
                      <td className="px-3 py-1.5 text-slate-500">{f.to}</td>
                      <td className="px-3 py-1.5 text-red-600">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function CampaignsTab() {
  const { data, isLoading } = useListCampaignsQuery(undefined, { pollingInterval: 15000 })
  const [cancel] = useCancelCampaignMutation()
  const [open, setOpen] = useState<string | null>(null)
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!data?.data.length)
    return <EmptyState title="No bulk sends yet" description="Select leads on the lead list, then Bulk SMS or Bulk Email." />
  const delivered = (c: CampaignRow) => c.report.sent + c.report.delivered
  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Campaign</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Scheduled</th>
              <th className="px-4 py-2">Sent / Final</th>
              <th className="px-4 py-2">Failed</th>
              <th className="px-4 py-2">By</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.data.map((c) => (
              <tr key={c._id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(c._id)}>
                <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-2">
                  <Badge tone={c.status === 'done' ? 'green' : c.status === 'cancelled' ? 'slate' : 'blue'}>{c.status}</Badge>
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">{formatDateTime(c.scheduledAt)}</td>
                <td className="px-4 py-2 text-xs text-slate-700">
                  {delivered(c)} / {c.counts.final}
                </td>
                <td className="px-4 py-2 text-xs text-red-600">{c.report.failed + c.report.bounced || ''}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{c.createdBy}</td>
                <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  {c.status === 'scheduled' && (
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => cancel(c._id)}>
                      Cancel
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <CampaignReport id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

// each tab with the one line that says what it is for
const PAGE_TABS = [
  { key: 'templates', label: 'Templates', hint: 'The SMS, email and WhatsApp messages you can send to leads.' },
  { key: 'automations', label: 'Automation', hint: 'Messages that go out on their own, and the alerts your team gets.' },
  { key: 'campaigns', label: 'Bulk sends', hint: 'Messages sent to many leads at once, with how each one went.' },
  { key: 'texts', label: 'Texts', hint: 'Saved values — a link, a date, a venue — to fill in template variables.' },
] as const

/** Admin: SMS / email / WhatsApp templates, automations and bulk-send reports (Go-live §8, GL-39). */
export default function MessagingPage() {
  // the open tab lives in the URL (?tab=automations), so a refresh or a shared link opens the same tab
  const [params, setParams] = useSearchParams()
  const tab = PAGE_TABS.find((t) => t.key === params.get('tab'))?.key ?? 'templates'
  const setTab = (key: string) => setParams(key === 'templates' ? {} : { tab: key }, { replace: true })
  return (
    <>
      <PageHeader title="SMS, Email & WhatsApp" description="Message templates, automatic messages and bulk sends to your leads." />
      <Tabs tabs={PAGE_TABS.map(({ key, label }) => ({ key, label }))} active={tab} onChange={setTab} />
      <p className="mt-3 text-xs text-slate-500">{PAGE_TABS.find((t) => t.key === tab)?.hint}</p>
      <div className="mt-3">
        {tab === 'templates' ? <TemplatesTab /> : tab === 'automations' ? <AutomationsTab /> : tab === 'texts' ? <TextsTab /> : <CampaignsTab />}
      </div>
    </>
  )
}
