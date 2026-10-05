import { useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useBulkUploadLeadsMutation, useImportPreviewMutation } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Checkbox, FormField, Select } from '../../components/ui/fields'
import { cn, parseApiError } from '../../lib/utils'
import { authorizedDownload } from '../../lib/download'
import type { ImportPreview, ImportResult } from '../../types/models'
import { useCounsellors } from './leadSelection'

const MAX_BYTES = 10 * 1024 * 1024

/**
 * GL-11 / GL-37 bulk upload: template → file → column mapping (auto-matched)
 * → source, assignment and duplicate handling → preview of the first 20 rows
 * → result with a downloadable error file. A "Lead ID" column updates leads.
 */
export function BulkUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: masters } = useMasterBootstrapQuery()
  const counsellors = useCounsellors()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [source, setSource] = useState('')
  const [assignMode, setAssignMode] = useState<'unassigned' | 'one' | 'split'>('unassigned')
  const [owners, setOwners] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<'skip' | 'update_empty'>('skip')
  const [sendWelcome, setSendWelcome] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [runPreview, { isLoading: previewing }] = useImportPreviewMutation()
  const [upload, { isLoading: uploading }] = useBulkUploadLeadsMutation()

  const form = (extra: Record<string, unknown> = {}) => {
    const fd = new FormData()
    fd.append('file', file!)
    fd.append('mapping', JSON.stringify(mapping))
    Object.entries(extra).forEach(([k, v]) => fd.append(k, JSON.stringify(v)))
    return fd
  }

  const pick = async (f: File | undefined) => {
    setResult(null)
    setPreview(null)
    if (!f) return
    if (f.size > MAX_BYTES) return toast.error('The file is larger than 10 MB')
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) return toast.error('Only .xlsx, .xls or .csv files')
    setFile(f)
    const fd = new FormData()
    fd.append('file', f)
    try {
      const res = await runPreview(fd).unwrap()
      setPreview(res.data)
      setMapping(res.data.mapping)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const refreshPreview = async () => {
    try {
      setPreview((await runPreview(form()).unwrap()).data)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const onUpload = async () => {
    try {
      const res = await upload(
        form({ options: { source, assignMode, owners: assignMode === 'one' ? owners.slice(0, 1) : owners, duplicates, sendWelcome } })
      ).unwrap()
      setResult(res.data)
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const ownersOk = assignMode === 'unassigned' || (assignMode === 'one' ? owners.length >= 1 : owners.length >= 2)
  const updating = !!mapping.leadNo

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Bulk upload leads"
      description="Excel or CSV · max 20,000 rows · 10 MB. Bulk-uploaded leads get no welcome message unless you tick it."
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onUpload} loading={uploading} disabled={!preview || !source || !ownersOk}>
              <Upload className="h-3.5 w-3.5" /> Upload {preview ? `${preview.totalRows} rows` : ''}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ['Rows', result.total, 'text-slate-800'],
                ['Created', result.created, 'text-emerald-700'],
                ['Updated', result.updated, 'text-sky-700'],
                ['Skipped (duplicate)', result.skipped, 'text-amber-700'],
                ['Failed', result.failed, 'text-red-700'],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="rounded-lg border border-slate-200 p-3 text-center">
                <p className={cn('text-xl font-semibold', tone)}>{value}</p>
                <p className="text-[11px] text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          {result.perCounsellor.some((p) => p.count) && (
            <p className="text-xs text-slate-600">
              Assigned: {result.perCounsellor.map((p) => `${p.name} ${p.count}`).join(' · ')}
            </p>
          )}
          {result.errorFile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                authorizedDownload(`/leads/import/errors/${result.errorFile}`, 'upload-errors.xlsx').catch((e) =>
                  toast.error(parseApiError(e).message)
                )
              }
            >
              <Download className="h-3.5 w-3.5" /> Download error file ({result.skipped + result.failed} rows)
            </Button>
          )}
          {result.errors.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {result.errors.map((e, i) => (
                    <tr key={i}>
                      <td className="w-16 px-3 py-1.5 text-slate-500">Row {e.row}</td>
                      <td className="px-3 py-1.5 text-slate-700">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => authorizedDownload('/leads/import/template', 'lead-upload-template.xlsx').catch((e) => toast.error(parseApiError(e).message))}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Download sample template
            </Button>
            <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              {file ? file.name : 'Choose file…'}
            </label>
            {previewing && <span className="text-xs text-slate-500">Reading file…</span>}
          </div>

          {preview && (
            <>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Map columns</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {preview.fields.map((f) => (
                    <FormField key={f.key} label={f.label} required={f.required && !updating}>
                      <Select
                        value={mapping[f.key] ?? ''}
                        onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                        onBlur={refreshPreview}
                      >
                        <option value="">— not in file —</option>
                        {preview.headers.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </Select>
                    </FormField>
                  ))}
                </div>
                {updating && (
                  <p className="mt-1 text-[11px] text-sky-700">
                    A Lead ID column is mapped: matching leads update only the mapped columns. Owner changes only via “Owner Email”.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Source for this file" required>
                  <Select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="">Choose…</option>
                    {masters?.data.sources.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Assign to" required>
                  <Select value={assignMode} onChange={(e) => { setAssignMode(e.target.value as typeof assignMode); setOwners([]) }}>
                    <option value="unassigned">Unassigned pool</option>
                    <option value="one">One counsellor</option>
                    <option value="split">Split equally among…</option>
                  </Select>
                </FormField>
                <FormField label="Duplicates" required>
                  <Select value={duplicates} onChange={(e) => setDuplicates(e.target.value as typeof duplicates)}>
                    <option value="skip">Skip (default)</option>
                    <option value="update_empty">Update empty fields</option>
                  </Select>
                </FormField>
              </div>
              {assignMode === 'one' && (
                <Select value={owners[0] ?? ''} onChange={(e) => setOwners(e.target.value ? [e.target.value] : [])}>
                  <option value="">Choose counsellor…</option>
                  {counsellors.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              )}
              {assignMode === 'split' && (
                <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-2">
                  {counsellors.map((u) => (
                    <label key={u._id} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Checkbox
                        checked={owners.includes(u._id)}
                        onChange={(e) => setOwners((o) => (e.target.checked ? [...o, u._id] : o.filter((x) => x !== u._id)))}
                      />
                      {u.name}
                    </label>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />
                Send welcome message (SMS + email) to the new leads
              </label>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preview · first {preview.rows.length} of {preview.totalRows} rows
                </p>
                <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Row</th>
                        {preview.headers.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left">
                            {h}
                          </th>
                        ))}
                        <th className="px-2 py-1.5 text-left">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.map((r) => (
                        <tr key={r.row} className={r.error ? 'bg-red-50' : r.duplicateOf ? 'bg-amber-50' : undefined}>
                          <td className="px-2 py-1 text-slate-400">{r.row}</td>
                          {preview.headers.map((h) => (
                            <td key={h} className="px-2 py-1 text-slate-700">
                              {r.values[h]}
                            </td>
                          ))}
                          <td className={cn('px-2 py-1', r.error ? 'font-medium text-red-700' : r.duplicateOf ? 'text-amber-700' : 'text-emerald-700')}>
                            {r.error ?? (r.duplicateOf ? `Duplicate of ${r.duplicateOf}` : 'OK')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
