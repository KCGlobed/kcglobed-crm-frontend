import { useRef, useState } from 'react'
import { Bold, Image, Link2, List, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCancelCampaignMutation,
  useGetCampaignQuery,
  useListAutomationsQuery,
  useListCampaignsQuery,
  useListMessageTemplatesQuery,
  useMessagingOptionsQuery,
  useSaveMessageTemplateMutation,
  useUpdateAutomationMutation,
} from '../../../services/messagingApi'
import { PageHeader, Tabs } from '../../../components/ui/misc'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Checkbox, FormField, Input, Select, Textarea } from '../../../components/ui/fields'
import { Drawer } from '../../../components/ui/Drawer'
import { Modal } from '../../../components/ui/Modal'
import { EmptyState, Skeleton } from '../../../components/ui/feedback'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import type { CampaignRow, MessageTemplate } from '../../../types/models'

/** Minimal rich-text editor for email templates: bold, links, bullet lists, logo image (GL-21). */
function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }
  return (
    <div className="rounded-lg border border-slate-300">
      <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => exec('bold')} title="Bold">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => exec('insertUnorderedList')} title="Bullet list">
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { const url = prompt('Link URL'); if (url) exec('createLink', url) }} title="Link">
          <Link2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { const url = prompt('Logo image URL (https://…)'); if (url) exec('insertImage', url) }} title="Logo image">
          <Image className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-40 p-3 text-sm text-slate-800 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-brand-600 [&_a]:underline"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  )
}

function TemplateDrawer({ template, onClose }: { template?: MessageTemplate; onClose: () => void }) {
  const { data: options } = useMessagingOptionsQuery()
  const [save, { isLoading }] = useSaveMessageTemplateMutation()
  const [channel, setChannel] = useState<'sms' | 'email'>((template?.channel as 'sms' | 'email') ?? 'sms')
  const [name, setName] = useState(template?.name ?? '')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [dlt, setDlt] = useState(template?.dltTemplateId ?? '')
  const [sender, setSender] = useState(template?.senderId ?? '')
  const [active, setActive] = useState(template?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onSave = async () => {
    try {
      await save({
        id: template?._id,
        body: { name, channel, body, isActive: active, ...(channel === 'sms' ? { dltTemplateId: dlt, senderId: sender } : { subject }) },
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
            <Select value={channel} disabled={!!template} onChange={(e) => setChannel(e.target.value as 'sms' | 'email')}>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="whatsapp" disabled>
                WhatsApp (after vendor onboarding)
              </option>
            </Select>
          </FormField>
        </div>
        {channel === 'sms' ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="DLT Template ID" required error={errors.dltTemplateId} hint="From the DLT portal (TRAI)">
              <Input value={dlt} onChange={(e) => setDlt(e.target.value.replace(/\D/g, ''))} />
            </FormField>
            <FormField label="Sender ID" required error={errors.senderId} hint="6-letter DLT header, e.g. GCCSCH">
              <Input value={sender} maxLength={6} onChange={(e) => setSender(e.target.value.toUpperCase())} />
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
          <span>· a missing value is removed, never sent raw</span>
        </div>
        <FormField label={channel === 'sms' ? 'SMS text (must match the DLT-approved format)' : 'Email body'} required error={errors.body}>
          {channel === 'sms' ? (
            <Textarea rows={5} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          ) : (
            <RichText key={template?._id ?? 'new'} value={body} onChange={setBody} />
          )}
        </FormField>
        {channel === 'sms' && <p className="text-right text-[11px] text-slate-400">{body.length} characters</p>}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>
    </Drawer>
  )
}

function TemplatesTab() {
  const { data, isLoading } = useListMessageTemplatesQuery({})
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null)
  return (
    <>
      <div className="mb-3 flex justify-end">
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
                <th className="px-4 py-2">DLT / Subject</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((t) => (
                <tr key={t._id} className="cursor-pointer hover:bg-slate-50" onClick={() => setEditing(t)}>
                  <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-2">
                    <Badge tone={t.channel === 'sms' ? 'blue' : 'violet'}>{t.channel.toUpperCase()}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">{t.channel === 'sms' ? `${t.dltTemplateId} · ${t.senderId}` : t.subject}</td>
                  <td className="px-4 py-2">
                    <Badge tone={t.isActive ? 'green' : 'slate'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{formatDateTime(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <TemplateDrawer template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function AutomationsTab() {
  const { data, isLoading } = useListAutomationsQuery()
  const { data: sms } = useListMessageTemplatesQuery({ channel: 'sms', active: true })
  const { data: email } = useListMessageTemplatesQuery({ channel: 'email', active: true })
  const [update] = useUpdateAutomationMutation()
  const change = async (id: string, body: { isActive?: boolean; template?: string | null }) => {
    try {
      await update({ id, body }).unwrap()
      toast.success('Automation updated')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  if (isLoading) return <Skeleton className="h-40 w-full" />
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Automations never fire for Junk / Invalid leads, skip opted-out channels and never repeat the same trigger on a lead within 24 hours.
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Trigger</th>
              <th className="px-4 py-2">Channel</th>
              <th className="px-4 py-2">Template</th>
              <th className="px-4 py-2">On</th>
              <th className="px-4 py-2">Last change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.data.map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-2 text-slate-700">{r.triggerLabel}</td>
                <td className="px-4 py-2">
                  <Badge tone={r.channel === 'sms' ? 'blue' : 'violet'}>{r.channel.toUpperCase()}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Select className="!h-8 text-xs" value={r.template?._id ?? ''} onChange={(e) => change(r._id, { template: e.target.value || null })}>
                    <option value="">— none —</option>
                    {(r.channel === 'sms' ? sms : email)?.data.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-2">
                  <Checkbox checked={r.isActive} onChange={(e) => change(r._id, { isActive: e.target.checked })} />
                </td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{r.updatedBy ? `${r.updatedBy} · ${formatDateTime(r.updatedAt)}` : 'Default'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

/** Admin: SMS / email templates, automations and bulk-send reports (Go-live §8). */
export default function MessagingPage() {
  const [tab, setTab] = useState('templates')
  return (
    <>
      <PageHeader title="SMS & Email" description="Templates, trigger-based automations and bulk-send reports. WhatsApp plugs in as a third channel later." />
      <Tabs
        tabs={[
          { key: 'templates', label: 'Templates' },
          { key: 'automations', label: 'Automations' },
          { key: 'campaigns', label: 'Bulk sends' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === 'templates' ? <TemplatesTab /> : tab === 'automations' ? <AutomationsTab /> : <CampaignsTab />}
      </div>
    </>
  )
}
