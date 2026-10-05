import { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  useMetaDailyCheckQuery,
  useMetaEventsQuery,
  useMetaFormsQuery,
  useRetryMetaEventMutation,
  useSaveMetaFormMutation,
} from '../../services/messagingApi'
import { PageHeader, Tabs } from '../../components/ui/misc'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox, Input, Select } from '../../components/ui/fields'
import { EmptyState, Skeleton } from '../../components/ui/feedback'
import { formatDateTime, parseApiError } from '../../lib/utils'
import type { MetaFormMappingRow } from '../../types/models'

function FormMapping({ form, fields }: { form: MetaFormMappingRow; fields: { value: string; label: string }[] }) {
  const [mapping, setMapping] = useState(form.mapping)
  const [active, setActive] = useState(form.isActive)
  const [extra, setExtra] = useState('')
  const [save, { isLoading }] = useSaveMetaFormMutation()
  const questions = [...new Set([...Object.keys(mapping), ...form.questions])]

  const onSave = async () => {
    try {
      await save({ formId: form.formId, body: { mapping, isActive: active } }).unwrap()
      toast.success('Mapping saved')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800">{form.formName ?? 'Unnamed form'}</p>
          <p className="text-[11px] text-slate-400">
            Form ID {form.formId} {form.pageId ? `· Page ${form.pageId}` : ''}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} /> Import leads from this form
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map((q) => (
          <div key={q} className="grid grid-cols-2 items-center gap-2">
            <span className="truncate font-mono text-xs text-slate-600" title={q}>
              {q}
            </span>
            <Select className="!h-8 text-xs" value={mapping[q] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [q]: e.target.value }))}>
              <option value="">Not mapped → "Meta answers" note</option>
              {fields.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Input className="!h-8 !w-56 text-xs" placeholder="Add a question key…" value={extra} onChange={(e) => setExtra(e.target.value)} />
          <Button
            variant="outline"
            size="sm"
            disabled={!extra.trim()}
            onClick={() => {
              setMapping((m) => ({ ...m, [extra.trim()]: '' }))
              setExtra('')
            }}
          >
            Add
          </Button>
        </div>
        <Button size="sm" onClick={onSave} loading={isLoading}>
          Save mapping
        </Button>
      </div>
    </div>
  )
}

function MappingTab() {
  const { data, isLoading } = useMetaFormsQuery()
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!data?.data.forms.length)
    return <EmptyState title="No Meta forms yet" description="Forms appear here as soon as the first lead from them arrives through the webhook." />
  return (
    <div className="space-y-3">
      {data.data.forms.map((f) => (
        <FormMapping key={f._id} form={f} fields={data.data.fields} />
      ))}
    </div>
  )
}

function ErrorsTab() {
  const { data, isLoading } = useMetaEventsQuery('errors', { pollingInterval: 30000 })
  const [retry, { isLoading: retrying }] = useRetryMetaEventMutation()
  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (!data?.data.length) return <EmptyState title="No integration errors" description="Failed fetches retry after 1, 5, 15 and 60 minutes before they land here." />
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Meta lead ID</th>
            <th className="px-4 py-2">Form</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Attempts</th>
            <th className="px-4 py-2">Error</th>
            <th className="px-4 py-2">Received</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.data.map((e) => (
            <tr key={e._id}>
              <td className="px-4 py-2 font-mono text-xs">{e.leadgenId}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{e.formId}</td>
              <td className="px-4 py-2">
                <Badge tone={e.status === 'error' ? 'red' : 'amber'}>{e.status === 'error' ? 'Gave up' : `Retrying ${formatDateTime(e.nextAttemptAt)}`}</Badge>
              </td>
              <td className="px-4 py-2 text-xs">{e.attempts}</td>
              <td className="max-w-72 px-4 py-2 text-xs text-red-600">{e.lastError}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{formatDateTime(e.createdAt)}</td>
              <td className="px-4 py-2 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  loading={retrying}
                  onClick={async () => {
                    try {
                      const res = await retry(e._id).unwrap()
                      toast[res.data.outcome === 'created' || res.data.outcome === 're_enquiry' ? 'success' : 'error'](
                        res.data.outcome === 'created' ? 'Lead created' : res.data.outcome === 're_enquiry' ? 'Re-enquiry recorded' : res.data.lastError ?? 'Still failing'
                      )
                    } catch (err) {
                      toast.error(parseApiError(err).message)
                    }
                  }}
                >
                  <RotateCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DailyCheckTab() {
  const [date, setDate] = useState('')
  const { data, isLoading } = useMetaDailyCheckQuery(date || undefined)
  return (
    <div className="space-y-3">
      <Input type="date" className="!w-48" value={date} onChange={(e) => setDate(e.target.value)} />
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !data?.data.forms.length ? (
        <EmptyState title="No Meta leads that day" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Form</th>
                <th className="px-4 py-2">Meta count</th>
                <th className="px-4 py-2">In CRM</th>
                <th className="px-4 py-2">New leads</th>
                <th className="px-4 py-2">Check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.forms.map((f) => (
                <tr key={f.formId}>
                  <td className="px-4 py-2 text-slate-700">{f.formName ?? f.formId}</td>
                  <td className="px-4 py-2">{f.metaCount ?? '—'}</td>
                  <td className="px-4 py-2">{f.crmCount}</td>
                  <td className="px-4 py-2">{f.newLeads}</td>
                  <td className="px-4 py-2">
                    <Badge tone={f.match ? 'green' : 'red'}>{f.match ? 'Match' : 'Mismatch'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Super Admin: Meta Lead Ads (GL-09). */
export default function IntegrationsPage() {
  const [tab, setTab] = useState('mapping')
  return (
    <>
      <PageHeader
        title="Meta Lead Ads"
        description="Webhook: /api/v1/webhooks/meta-leads (leadgen). Leads are fetched within seconds, mapped per form, and routed round-robin."
      />
      <Tabs
        tabs={[
          { key: 'mapping', label: 'Form mapping' },
          { key: 'errors', label: 'Integration errors' },
          { key: 'daily', label: 'Daily check' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="mt-4">{tab === 'mapping' ? <MappingTab /> : tab === 'errors' ? <ErrorsTab /> : <DailyCheckTab />}</div>
    </>
  )
}
