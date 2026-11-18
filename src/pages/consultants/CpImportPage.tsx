import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cpTemplatePath, useCpImportMutation, useCpMetaQuery } from '../../services/consultantsApi'
import { Button } from '../../components/ui/Button'
import { FormField, Select } from '../../components/ui/fields'
import { Card, PageHeader } from '../../components/ui/misc'
import { authorizedDownload } from '../../lib/download'
import { cn, parseApiError } from '../../lib/utils'
import type { CpImportResult } from '../../types/consultants'
import { CP_LEADS_PATH } from './cpShared'

const ACCEPT = ['.xlsx', '.xls', '.csv']
const MAX_ROWS = 5000

/** Channel Partners › Leads › Bulk Upload: one Excel / CSV of consultant leads, straight in (no column mapping). */
export default function CpImportPage() {
  const navigate = useNavigate()
  const { data: meta, isLoading: metaLoading } = useCpMetaQuery()
  const [importLeads, { isLoading: uploading }] = useCpImportMutation()
  const [file, setFile] = useState<File | null>(null)
  const [owner, setOwner] = useState('')
  const [source, setSource] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<CpImportResult | null>(null)
  const [downloading, setDownloading] = useState(false)
  // a new key empties the file input after a reset
  const [inputKey, setInputKey] = useState(0)

  const owners = meta?.data.owners ?? []
  const sources = meta?.data.sources ?? []
  const businessTypes = meta?.data.businessTypes ?? []

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      await authorizedDownload(cpTemplatePath, 'channel-partners-template.xlsx')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setDownloading(false)
    }
  }

  const pick = (picked: File | undefined) => {
    setErrors({})
    if (!picked) return setFile(null)
    if (!ACCEPT.some((ext) => picked.name.toLowerCase().endsWith(ext))) {
      setFile(null)
      setErrors({ file: 'Upload an .xlsx, .xls or .csv file' })
      return
    }
    setFile(picked)
  }

  const upload = async () => {
    if (!file) return setErrors({ file: 'Choose an Excel or CSV file' })
    const body = new FormData()
    body.append('file', file)
    if (owner) body.append('owner', owner)
    if (source) body.append('source', source)
    try {
      const res = await importLeads(body).unwrap()
      setResult(res.data)
      toast.success(res.message || `${res.data.created} lead(s) added`)
    } catch (err) {
      const { message, errors: fieldErrors } = parseApiError(err)
      setErrors(fieldErrors)
      toast.error(message)
    }
  }

  const reset = () => {
    setResult(null)
    setFile(null)
    setErrors({})
    setInputKey((k) => k + 1)
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Partner Leads', to: CP_LEADS_PATH }, { label: 'Bulk Upload' }]}
        title="Bulk Upload Partner Leads"
        description={`Excel or CSV · up to ${MAX_ROWS.toLocaleString()} rows. Adds Channel Partners (consultant) leads only — never student leads.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(CP_LEADS_PATH)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Partner Leads
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate} loading={downloading}>
              {!downloading && <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />} Download template
            </Button>
          </>
        }
      />

      {result ? (
        <Card title="Upload finished" className="max-w-4xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  ['Rows in file', result.total, 'text-slate-800'],
                  ['Added', result.created, 'text-emerald-700'],
                  ['Duplicates skipped', result.duplicates.length, 'text-amber-700'],
                  ['Invalid rows', result.invalid.length, 'text-red-700'],
                  ['Also in student Leads (flagged)', result.alsoInStudentLeads, 'text-sky-700'],
                ] as const
              ).map(([label, value, tone]) => (
                <div key={label} className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className={cn('text-xl font-semibold', tone)}>{value.toLocaleString()}</p>
                  <p className="text-[11px] leading-4 text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            {result.created > 0 && (
              <p className="text-xs text-slate-600">
                {result.owner ? (
                  <>
                    All added leads are assigned to <b className="font-medium text-slate-800">{result.owner}</b>.
                  </>
                ) : (
                  'The added leads are unassigned — assign them from the Partner Leads list.'
                )}
                {result.alsoInStudentLeads > 0 &&
                  ` ${result.alsoInStudentLeads} of them share a mobile or email with a student lead: flagged on the lead, never merged.`}
              </p>
            )}

            {result.duplicates.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-700">Duplicates skipped ({result.duplicates.length})</p>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-20 px-3 py-1.5">Row</th>
                        <th className="w-40 px-3 py-1.5">Mobile</th>
                        <th className="px-3 py-1.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.duplicates.map((d, i) => (
                        <tr key={`${d.row}-${i}`}>
                          <td className="px-3 py-1.5 text-slate-500">{d.row}</td>
                          <td className="px-3 py-1.5 text-slate-700">{d.mobile}</td>
                          <td className="px-3 py-1.5 text-slate-700">{d.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.invalid.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-700">Invalid rows ({result.invalid.length})</p>
                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-20 px-3 py-1.5">Row</th>
                        <th className="px-3 py-1.5">Problems</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.invalid.map((r, i) => (
                        <tr key={`${r.row}-${i}`}>
                          <td className="px-3 py-1.5 text-slate-500">{r.row}</td>
                          <td className="px-3 py-1.5 text-red-700">{r.errors.join(' · ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(CP_LEADS_PATH)}>Go to Partner Leads</Button>
              <Button variant="outline" onClick={reset}>
                Upload another file
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card title="Upload" className="lg:col-span-3">
            <div className="space-y-4">
              <FormField label="File" required error={errors.file} hint=".xlsx, .xls or .csv · the first row holds the column names">
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm hover:bg-slate-50',
                    errors.file ? 'border-red-400 text-red-700' : 'border-slate-300 text-slate-600'
                  )}
                >
                  <input
                    key={inputKey}
                    type="file"
                    accept={ACCEPT.join(',')}
                    className="sr-only"
                    data-testid="cp-import-file"
                    onChange={(e) => pick(e.target.files?.[0])}
                  />
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="min-w-0 truncate">{file ? file.name : 'Choose a file…'}</span>
                  {file && <span className="ml-auto shrink-0 text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>}
                </label>
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Assign All To" error={errors.owner} hint="Optional · leave empty to keep them unassigned">
                  <Select value={owner} onChange={(e) => setOwner(e.target.value)} disabled={metaLoading} aria-invalid={!!errors.owner}>
                    <option value="">{metaLoading ? 'Loading…' : '—'}</option>
                    {owners.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Default Source" error={errors.source} hint="For rows whose Source is empty or not a known source">
                  <Select value={source} onChange={(e) => setSource(e.target.value)} disabled={metaLoading} aria-invalid={!!errors.source}>
                    <option value="">{metaLoading ? 'Loading…' : '—'}</option>
                    {sources.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <Button onClick={upload} loading={uploading} disabled={!file} data-testid="cp-import-submit">
                  {!uploading && <Upload className="h-4 w-4" />} Upload
                </Button>
                {uploading && <span className="text-xs text-slate-500">Reading and adding the leads…</span>}
              </div>
            </div>
          </Card>

          <Card title="Columns" className="lg:col-span-2">
            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Columns are matched by their name, in any order. <b className="font-medium text-slate-800">Name</b> and{' '}
                <b className="font-medium text-slate-800">Mobile</b> are required; the rest are optional.
              </p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(
                  [
                    ['Name', true, 'Contact person'],
                    ['Mobile', true, '+91 / a leading 0 is removed'],
                    ['Email', false, ''],
                    ['Firm Name', false, 'Agency / company'],
                    ['City', false, ''],
                    ['State', false, ''],
                    ['Business Type', false, businessTypes.length ? `e.g. ${businessTypes.slice(0, 2).join(', ')}` : ''],
                    ['Team Size', false, 'A number'],
                    ['Students a Year', false, 'A number'],
                    ['Website', false, ''],
                    ['Source', false, 'An active source name, else the Default Source'],
                  ] as const
                ).map(([name, required, note]) => (
                  <li key={name} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                    <span className="font-medium text-slate-800">
                      {name}
                      {required && <span className="ml-0.5 text-red-500">*</span>}
                    </span>
                    <span className="text-right text-[11px] text-slate-500">{note || (required ? 'Required' : 'Optional')}</span>
                  </li>
                ))}
              </ul>
              <ul className="list-disc space-y-1 pl-4 text-[11px] leading-4 text-slate-500">
                <li>At most {MAX_ROWS.toLocaleString()} rows a file; .xlsx, .xls or .csv.</li>
                <li>A mobile or email already on a Channel Partners lead is skipped as a duplicate.</li>
                <li>One that is also on a student lead is still added, and flagged — never merged.</li>
                <li>New leads start in the first open stage.</li>
              </ul>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
