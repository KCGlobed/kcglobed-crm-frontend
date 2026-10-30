import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Download, FileCheck, FileSpreadsheet, Loader2, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch } from '../../app/hooks'
import { api } from '../../services/api'
import {
  useBulkUploadLeadsMutation,
  useCreateImportCustomFieldMutation,
  useLazyImportJobQuery,
  useImportPreviewMutation,
  useValidateImportMutation,
} from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Checkbox, FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { Card, PageHeader } from '../../components/ui/misc'
import { camelKey, cn, parseApiError } from '../../lib/utils'
import { authorizedDownload } from '../../lib/download'
import type { BadgeTone } from '../../lib/status'
import type {
  CustomFieldDef,
  ImportColumn,
  ImportColumnStatus,
  ImportField,
  ImportJob,
  ImportMapping,
  ImportPreview,
  ImportResult,
  ImportValidation,
  ImportValue,
} from '../../types/models'
import { ownerLabel, useAssignableOwners } from './leadSelection'

const MAX_BYTES = 10 * 1024 * 1024
/** choices in the per-column dropdown that are decisions, not fields */
const SKIP = '__skip__'
const CREATE = '__create__'
/** choice in the per-value dropdown: leave the CRM field empty for that text */
const EMPTY = '__empty__'
const FIELD_TYPES: { value: CustomFieldDef['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown (options)' },
  { value: 'boolean', label: 'Yes / No' },
]
const STATUS_TONE: Record<ImportColumnStatus, BadgeTone> = { mapped: 'green', unmapped: 'amber', skipped: 'slate' }
const STATUS_LABEL: Record<ImportColumnStatus, string> = { mapped: 'Mapped', unmapped: 'Unmapped', skipped: 'Skipped' }

/** "FIRST ASSIGNED TO" → "First Assigned To" */
const titleCase = (s: string) =>
  s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s(])\S/g, (m) => m.toUpperCase())

/** Excel column → CRM field key (inverse of the mapping; a field with several columns lists each) */
function invert(mapping: ImportMapping): Map<string, string> {
  const m = new Map<string, string>()
  Object.entries(mapping).forEach(([field, column]) => {
    ;(Array.isArray(column) ? column : [column]).forEach((h) => {
      if (h && !m.has(h)) m.set(h, field)
    })
  })
  return m
}

const columnsOf = (column: string | string[] | undefined) => (Array.isArray(column) ? column : column ? [column] : [])

/** explicit per-text choices for the lookup fields: field → text in the file → target or null (blank) */
type ValueChoices = Record<string, Record<string, string | null>>

/**
 * Bulk upload (GL-11 / GL-37) on its own page: file → one decision per Excel
 * column (auto-matched to a lead field or a custom field; otherwise map it,
 * create a custom field for it, or skip it) → one decision per value of every
 * lookup column (stage / disposition, owner, source, program, cohort, track:
 * auto-matched by name, otherwise pick the CRM record or leave it blank) →
 * source, assignment and duplicate handling → preview of the first 20 rows →
 * result with a downloadable error file. Nothing is dropped silently: the
 * upload waits until every column and every value has a decision.
 */
export default function BulkUploadPage() {
  const navigate = useNavigate()
  const { data: masters } = useMasterBootstrapQuery()
  const assignable = useAssignableOwners()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  /** CRM field key → Excel column(s) (the API's mapping shape) */
  const [mapping, setMapping] = useState<ImportMapping>({})
  /** Excel columns the user explicitly chose not to import */
  const [skipped, setSkipped] = useState<string[]>([])
  const [values, setValues] = useState<ValueChoices>({})
  /** custom fields created on this page, available before the next preview refresh lists them */
  const [createdFields, setCreatedFields] = useState<ImportField[]>([])
  /** the Excel column a custom field is being created for */
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [source, setSource] = useState('')
  const [assignMode, setAssignMode] = useState<'unassigned' | 'one' | 'split'>('unassigned')
  const [owners, setOwners] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<'skip' | 'update_empty' | 'update_all' | 'reenquire' | 'reenquire_replace'>('skip')
  const [sendWelcome, setSendWelcome] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  /** full-file dry run shown before the Confirm button; cleared by any mapping/value change */
  const [validation, setValidation] = useState<ImportValidation | null>(null)
  const [runPreview, { isLoading: previewing }] = useImportPreviewMutation()
  const [runValidate, { isLoading: validating }] = useValidateImportMutation()
  const [upload, { isLoading: uploading }] = useBulkUploadLeadsMutation()
  // the import runs as a background job (no request timeout can cut a big file off): polled until it ends
  const dispatch = useAppDispatch()
  const [fetchJob] = useLazyImportJobQuery()
  const [jobRunning, setJobRunning] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const waitForJob = async (id: string): Promise<ImportJob | null> => {
    while (mounted.current) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      try {
        const job = (await fetchJob(id).unwrap()).data
        if (job.status === 'done' || job.status === 'failed') return job
      } catch {
        // a dropped poll (network, server restarting) — keep asking; the server fails a job that never ends
      }
    }
    return null
  }

  const fields = useMemo<ImportField[]>(() => {
    const base = preview?.fields ?? []
    const known = new Set(base.map((f) => f.key))
    return [...base, ...createdFields.filter((f) => !known.has(f.key))]
  }, [preview, createdFields])
  const fieldByKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields])
  const standardFields = fields.filter((f) => f.kind === 'standard')
  const customFields = fields.filter((f) => f.kind === 'custom')
  const fieldLabel = (key: string | null) => (key ? fieldByKey.get(key)?.label ?? key : '')

  const headerToField = useMemo(() => invert(mapping), [mapping])

  /** every column of the file with its current decision (page state wins over the last preview) */
  const columns = useMemo(
    () =>
      (preview?.columns ?? []).map((c): ImportColumn => {
        const field = headerToField.get(c.header) ?? null
        const status: ImportColumnStatus = field ? 'mapped' : skipped.includes(c.header) ? 'skipped' : 'unmapped'
        return { ...c, field, status }
      }),
    [preview, headerToField, skipped]
  )
  const columnByHeader = useMemo(() => new Map(columns.map((c) => [c.header, c])), [columns])
  const counts = {
    mapped: columns.filter((c) => c.status === 'mapped').length,
    unmapped: columns.filter((c) => c.status === 'unmapped').length,
    skipped: columns.filter((c) => c.status === 'skipped').length,
  }
  const unmapped = columns.filter((c) => c.status === 'unmapped')
  const updating = !!mapping.leadNo
  const requiredMissing = standardFields.filter((f) => f.required && !updating && !mapping[f.key])

  /** lookup fields that have a column: their distinct texts with the decision in force (page choice > preview) */
  const lookupBlocks = useMemo(
    () =>
      standardFields
        .filter((f) => f.lookup && mapping[f.key])
        .map((f) => {
          const chosen = values[f.key] ?? {}
          const items = (preview?.values?.[f.key] ?? []).map((v): ImportValue => {
            if (v.value in chosen) return { ...v, target: chosen[v.value], how: 'explicit' }
            return v
          })
          return { field: f, items, missing: items.filter((v) => v.how === 'missing').length }
        }),
    [standardFields, mapping, values, preview]
  )
  const unresolved = lookupBlocks.reduce((n, b) => n + b.missing, 0)
  const ownersOk = assignMode === 'unassigned' || (assignMode === 'one' ? owners.length >= 1 : owners.length >= 2)
  const blocker = !preview
    ? 'Choose a file to begin'
    : requiredMissing.length
      ? `Map a column to ${requiredMissing.map((f) => f.label).join(' and ')}`
      : unmapped.length
        ? `${unmapped.length} column${unmapped.length === 1 ? '' : 's'} still unmapped: map, create a custom field or skip`
        : unresolved
          ? `${unresolved} value${unresolved === 1 ? '' : 's'} not matched to CRM records: choose or leave empty (step 3)`
          : !source
            ? 'Choose the Source for this file'
            : !ownersOk
              ? 'Choose the counsellor(s)'
              : null

  const form = (m: ImportMapping, s: string[], v: ValueChoices, extra: Record<string, unknown> = {}) => {
    const fd = new FormData()
    fd.append('file', file!)
    fd.append('mapping', JSON.stringify(m))
    fd.append('skipped', JSON.stringify(s))
    fd.append('values', JSON.stringify(v))
    Object.entries(extra).forEach(([k, val]) => fd.append(k, JSON.stringify(val)))
    return fd
  }

  const refreshPreview = async (m = mapping, s = skipped, v = values) => {
    setValidation(null) // any change invalidates the dry run — validate again before importing
    try {
      setPreview((await runPreview(form(m, s, v)).unwrap()).data)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const reset = () => {
    setResult(null)
    setValidation(null)
    setPreview(null)
    setCreatingFor(null)
    setCreatedFields([])
    setValues({})
    setFile(null)
  }

  const pick = async (f: File | undefined) => {
    reset()
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
      setSkipped(res.data.skipped ?? [])
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  /** One decision per Excel column: a CRM field, skip it, or create a custom field for it. */
  const decide = (header: string, choice: string) => {
    if (choice === CREATE) {
      setCreatingFor(header)
      return
    }
    setCreatingFor((c) => (c === header ? null : c))
    const next: ImportMapping = {}
    Object.entries(mapping).forEach(([f, column]) => {
      if (Array.isArray(column)) {
        const rest = column.filter((h) => h !== header)
        if (rest.length) next[f] = rest
      } else if (column !== header && f !== choice) {
        // a column maps to one field and a field to one column: drop the old pair on both sides
        next[f] = column
      }
    })
    if (choice && choice !== SKIP) {
      if (fieldByKey.get(choice)?.multi) next[choice] = [...columnsOf(next[choice]), header]
      else next[choice] = header
    }
    const nextSkipped = choice === SKIP ? [...new Set([...skipped, header])] : skipped.filter((h) => h !== header)
    setMapping(next)
    setSkipped(nextSkipped)
    void refreshPreview(next, nextSkipped)
  }

  const skipAllUnmapped = () => {
    const nextSkipped = [...new Set([...skipped, ...unmapped.map((c) => c.header)])]
    setSkipped(nextSkipped)
    void refreshPreview(mapping, nextSkipped)
  }

  /** One decision per text of a lookup column: a CRM record, blank, or back to the automatic match. */
  const chooseValue = (field: string, text: string, choice: string) => {
    const current = { ...(values[field] ?? {}) }
    if (choice === '') delete current[text]
    else current[text] = choice === EMPTY ? null : choice
    const next = { ...values, [field]: current }
    setValues(next)
    void refreshPreview(mapping, skipped, next)
  }

  const blankUnmatched = (field: string, items: ImportValue[]) => {
    const current = { ...(values[field] ?? {}) }
    items.filter((v) => v.how === 'missing').forEach((v) => (current[v.value] = null))
    const next = { ...values, [field]: current }
    setValues(next)
    void refreshPreview(mapping, skipped, next)
  }

  const onFieldCreated = (header: string, def: CustomFieldDef) => {
    const key = `custom.${def.key}`
    setCreatedFields((list) => [
      ...list,
      { key, label: def.label, kind: 'custom', required: false, type: def.type, options: def.options },
    ])
    setCreatingFor(null)
    const next = { ...mapping, [key]: header }
    const nextSkipped = skipped.filter((h) => h !== header)
    setMapping(next)
    setSkipped(nextSkipped)
    void refreshPreview(next, nextSkipped)
  }

  /** Step 1 of the final stage: the full-file dry run — nothing is written yet. */
  const onValidate = async () => {
    try {
      const res = await runValidate(form(mapping, skipped, values, { options: { duplicates } })).unwrap()
      setValidation(res.data)
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  /** Step 2: only reachable from the validation card's Confirm button. */
  const onUpload = async () => {
    try {
      const res = await upload(
        form(mapping, skipped, values, {
          options: {
            source, assignMode, owners: assignMode === 'one' ? owners.slice(0, 1) : owners, duplicates, sendWelcome,
            background: true,
          },
        })
      ).unwrap()
      if ('job' in res.data) {
        toast.success(res.message)
        setJobRunning(true)
        const job = await waitForJob(res.data.job._id)
        if (!job) return  // left the page: the finish notification still arrives
        setJobRunning(false)
        if (job.status !== 'done' || !job.result) {
          toast.error(job.error || 'The upload failed')
          return
        }
        const r = job.result
        dispatch(api.util.invalidateTags([{ type: 'Leads', id: 'LIST' }, 'Dashboard', 'Notifications']))
        setValidation(null)
        setResult(r)
        toast.success(`Upload finished: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped, ${r.failed} failed`)
        window.scrollTo({ top: 0 })
        return
      }
      setValidation(null)
      setResult(res.data)
      toast.success(res.message)
      window.scrollTo({ top: 0 })
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const downloadTemplate = () =>
    authorizedDownload('/leads/import/template', 'lead-upload-template.xlsx').catch((e) => toast.error(parseApiError(e).message))

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Leads', to: '/app/leads' }, { label: 'Bulk Upload' }]}
        title="Bulk Upload Leads"
        description="Excel or CSV · max 20,000 rows · 10 MB. Every column and every stage / owner value gets a decision before anything is imported."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/leads')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Leads
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Download Sample Template
            </Button>
          </>
        }
      />

      {result ? (
        <Card title="Upload finished" className="max-w-4xl">
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  ['Rows', result.total, 'text-slate-800'],
                  ['Created', result.created, 'text-emerald-700'],
                  ['Updated', result.updated, 'text-sky-700'],
                  ...((result.reEnquired ?? 0) > 0 ? ([['Re-enquired', result.reEnquired ?? 0, 'text-violet-700']] as const) : []),
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
            <p className="text-xs text-slate-600">
              {result.mappedColumns ?? counts.mapped} column{(result.mappedColumns ?? counts.mapped) === 1 ? '' : 's'} imported
              {result.skippedColumns ? ` · ${result.skippedColumns} skipped by your choice` : ''}
              {result.notesAdded ? ` · ${result.notesAdded} note${result.notesAdded === 1 ? '' : 's'} added` : ''}.
            </p>
            {result.perCounsellor.some((p) => p.count) && (
              <p className="text-xs text-slate-600">
                Assigned: {result.perCounsellor.filter((p) => p.count).map((p) => `${p.name} ${p.count}`).join(' · ')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {result.resultFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    authorizedDownload(`/leads/import/errors/${result.resultFile}`, 'upload-report.xlsx').catch((e) =>
                      toast.error(parseApiError(e).message)
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download full report ({result.total} rows)
                </Button>
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
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
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
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(`/app/leads?upload_file=${encodeURIComponent(result.fileName)}`)}>
                Open these leads
              </Button>
              <Button variant="outline" onClick={reset}>
                Upload another file
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card title="1 · File">
            <div className="flex flex-wrap items-center gap-3 p-4">
              <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                {file ? file.name : 'Choose file…'}
              </label>
              {previewing && <span className="text-xs text-slate-500">Reading file…</span>}
              {preview && (
                <span className="text-xs text-slate-500">
                  {preview.totalRows.toLocaleString()} rows · {preview.headers.length} columns
                </span>
              )}
            </div>
          </Card>

          {preview && (
            <>
              <Card
                title={`2 · Map columns · ${columns.length} in file`}
                actions={
                  <div className="flex items-center gap-1.5">
                    <Badge tone="green">{counts.mapped} mapped</Badge>
                    <Badge tone="amber">{counts.unmapped} unmapped</Badge>
                    <Badge tone="slate">{counts.skipped} skipped</Badge>
                  </div>
                }
              >
                <div className="space-y-2 p-4">
                  {unmapped.length > 0 && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">
                        {unmapped.length} column{unmapped.length === 1 ? ' is' : 's are'} not mapped and will not be imported.
                        Map {unmapped.length === 1 ? 'it' : 'each one'} to a lead field, create a custom field for it, or skip it.
                      </span>
                      <Button variant="outline" size="sm" onClick={skipAllUnmapped}>
                        Skip all unmapped
                      </Button>
                    </div>
                  )}
                  {requiredMissing.length > 0 && (
                    <p className="text-xs font-medium text-red-700">
                      Required: map a column to {requiredMissing.map((f) => f.label).join(' and ')}.
                    </p>
                  )}
                  <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Excel column</th>
                          <th className="px-3 py-1.5 text-left">Sample values</th>
                          <th className="w-72 px-3 py-1.5 text-left">Import as</th>
                          <th className="px-3 py-1.5 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {columns.map((c) => {
                          const target = c.field ? fieldByKey.get(c.field) : undefined
                          return (
                            <Fragment key={c.header}>
                              <tr className={cn(c.status === 'unmapped' && 'bg-amber-50/60', c.status === 'skipped' && 'text-slate-400')}>
                                <td className="px-3 py-1.5 align-top">
                                  <p className={cn('font-medium text-slate-800', c.status === 'skipped' && 'text-slate-400 line-through')}>{c.header}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {c.filled} of {preview.totalRows} filled{c.distinct ? ` · ${c.distinct} distinct` : ''}
                                  </p>
                                </td>
                                <td className="max-w-64 px-3 py-1.5 align-top text-slate-500">
                                  <span className="line-clamp-2" title={c.values.slice(0, 8).join(' · ')}>
                                    {c.values.slice(0, 3).join(' · ') || '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 align-top">
                                  <Select
                                    value={c.status === 'skipped' ? SKIP : c.field ?? ''}
                                    onChange={(e) => decide(c.header, e.target.value)}
                                    aria-label={`Import ${c.header} as`}
                                  >
                                    <option value="">{c.status === 'unmapped' ? 'Unmapped — choose…' : '— Unmapped —'}</option>
                                    <optgroup label="Lead fields">
                                      {standardFields.map((f) => {
                                        const elsewhere = columnsOf(mapping[f.key]).filter((h) => h !== c.header)
                                        return (
                                          <option key={f.key} value={f.key}>
                                            {f.label}
                                            {f.required && !updating ? ' *' : ''}
                                            {f.lookup ? ' (matched by value)' : ''}
                                            {elsewhere.length ? (f.multi ? ` (+ ${elsewhere.join(', ')})` : ` (now: ${elsewhere[0]})`) : ''}
                                          </option>
                                        )
                                      })}
                                    </optgroup>
                                    {customFields.length > 0 && (
                                      <optgroup label="Custom fields">
                                        {customFields.map((f) => (
                                          <option key={f.key} value={f.key}>
                                            {f.label}
                                            {mapping[f.key] && mapping[f.key] !== c.header ? ` (now: ${mapping[f.key]})` : ''}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    <optgroup label="Or">
                                      <option value={CREATE}>+ Create new custom field…</option>
                                      <option value={SKIP}>Skip this column (do not import)</option>
                                    </optgroup>
                                  </Select>
                                  {target?.hint && c.status === 'mapped' && <p className="mt-1 text-[11px] text-slate-500">{target.hint}</p>}
                                </td>
                                <td className="px-3 py-1.5 align-top">
                                  <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                                  {target?.lookup && c.status === 'mapped' && (
                                    <p className="mt-1 text-[11px] text-slate-500">values in step 3</p>
                                  )}
                                </td>
                              </tr>
                              {creatingFor === c.header && (
                                <tr>
                                  <td colSpan={4} className="bg-brand-50/40 px-3 py-3">
                                    <CreateFieldPanel
                                      column={c}
                                      existingKeys={customFields.map((f) => f.key.replace(/^custom\./, ''))}
                                      onCreated={(def) => onFieldCreated(c.header, def)}
                                      onCancel={() => setCreatingFor(null)}
                                    />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {updating && (
                    <p className="text-[11px] text-sky-700">
                      A Lead ID column is mapped: matching leads update only the mapped columns. The owner changes only for Admins.
                    </p>
                  )}
                </div>
              </Card>

              {lookupBlocks.length > 0 && (
                <Card
                  title="3 · Match values"
                  actions={
                    unresolved > 0 ? <Badge tone="amber">{unresolved} unmatched</Badge> : <Badge tone="green">All values matched</Badge>
                  }
                >
                  <div className="space-y-4 p-4">
                    <p className="text-xs text-slate-600">
                      These columns hold names that must become CRM records. Each distinct value in the file is matched
                      automatically where the name, code or email is the same; pick the right record for the rest, or leave
                      the field empty for that value.
                    </p>
                    {lookupBlocks.map(({ field, items, missing }) => (
                      <LookupBlock
                        key={field.key}
                        field={field}
                        column={columnsOf(mapping[field.key]).join(', ')}
                        items={items}
                        missing={missing}
                        onChoose={(text, choice) => chooseValue(field.key, text, choice)}
                        onBlankUnmatched={() => blankUnmatched(field.key, items)}
                      />
                    ))}
                  </div>
                </Card>
              )}

              <Card title={`${lookupBlocks.length ? 4 : 3} · Upload options`}>
                <div className="space-y-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField
                      label="Source for This File"
                      required
                      hint={mapping.source ? 'Default for rows whose Source column is empty' : undefined}
                    >
                      <Select value={source} onChange={(e) => setSource(e.target.value)}>
                        <option value="">Choose…</option>
                        {masters?.data.sources.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Assign To" required hint={mapping.owner ? 'For rows whose Owner column is empty' : undefined}>
                      <Select value={assignMode} onChange={(e) => { setAssignMode(e.target.value as typeof assignMode); setOwners([]) }}>
                        <option value="unassigned">Unassigned Pool</option>
                        <option value="one">One Counsellor</option>
                        <option value="split">Split equally among…</option>
                      </Select>
                    </FormField>
                    <FormField label="Duplicates" required>
                      <Select value={duplicates} onChange={(e) => { setDuplicates(e.target.value as typeof duplicates); setValidation(null) }}>
                        <option value="skip">Skip (default)</option>
                        <option value="update_empty">Update Empty Fields</option>
                        <option value="update_all">Update All Fields (except email &amp; phone)</option>
                        <option value="reenquire">Mark as Re-enquiry (fills empty fields, floats to top, owner notified)</option>
                        <option value="reenquire_replace">Mark as Re-enquiry (fills empty fields, replaces all data except email &amp; phone)</option>
                      </Select>
                    </FormField>
                  </div>
                  {assignMode === 'one' && (
                    <Select value={owners[0] ?? ''} onChange={(e) => setOwners(e.target.value ? [e.target.value] : [])}>
                      <option value="">Choose owner…</option>
                      {assignable.map((u) => (
                        <option key={u._id} value={u._id}>
                          {ownerLabel(u)}
                        </option>
                      ))}
                    </Select>
                  )}
                  {assignMode === 'split' && (
                    <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-2">
                      {assignable.map((u) => (
                        <label key={u._id} className="flex items-center gap-1.5 text-sm text-slate-700">
                          <Checkbox
                            checked={owners.includes(u._id)}
                            onChange={(e) => setOwners((o) => (e.target.checked ? [...o, u._id] : o.filter((x) => x !== u._id)))}
                          />
                          {ownerLabel(u)}
                        </label>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox checked={sendWelcome} onChange={(e) => setSendWelcome(e.target.checked)} />
                    Send welcome message (SMS + email) to the new leads
                  </label>
                </div>
              </Card>

              <Card title={`${lookupBlocks.length ? 5 : 4} · Preview · first ${preview.rows.length} of ${preview.totalRows} rows`}>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Row</th>
                        {preview.headers.map((h) => {
                          const status = columnByHeader.get(h)?.status ?? 'unmapped'
                          return (
                            <th
                              key={h}
                              className={cn(
                                'whitespace-nowrap px-2 py-1.5 text-left align-top',
                                status === 'skipped' && 'text-slate-300',
                                status === 'unmapped' && 'bg-amber-50 text-amber-800'
                              )}
                            >
                              <span className={cn(status === 'skipped' && 'line-through')}>{h}</span>
                              <span
                                className={cn(
                                  'block text-[10px] font-normal',
                                  status === 'mapped' ? 'text-emerald-700' : status === 'skipped' ? 'text-slate-400' : 'text-amber-700'
                                )}
                              >
                                {status === 'mapped' ? `→ ${fieldLabel(columnByHeader.get(h)?.field ?? null)}` : STATUS_LABEL[status]}
                              </span>
                            </th>
                          )
                        })}
                        <th className="px-2 py-1.5 text-left">Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.map((r) => (
                        <tr key={r.row} className={r.error ? 'bg-red-50' : r.duplicateOf ? 'bg-amber-50' : undefined}>
                          <td className="px-2 py-1 text-slate-400">{r.row}</td>
                          {preview.headers.map((h) => {
                            const status = columnByHeader.get(h)?.status ?? 'unmapped'
                            return (
                              <td
                                key={h}
                                className={cn(
                                  'px-2 py-1 text-slate-700',
                                  status === 'skipped' && 'text-slate-300 line-through',
                                  status === 'unmapped' && 'bg-amber-50/40'
                                )}
                              >
                                {r.values[h]}
                              </td>
                            )
                          })}
                          <td className={cn('whitespace-nowrap px-2 py-1', r.error ? 'font-medium text-red-700' : r.duplicateOf ? 'text-amber-700' : 'text-emerald-700')}>
                            {r.error ?? (r.duplicateOf ? `Duplicate of ${r.duplicateOf}` : 'OK')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {validation && (
            <Card title="Validation result — nothing imported yet" className="border-brand-200">
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {(
                    [
                      ['Rows', validation.total, 'text-slate-800'],
                      ['Will create', validation.willCreate, 'text-emerald-700'],
                      ['Will update', validation.willUpdate, 'text-sky-700'],
                      ...((validation.willReEnquire ?? 0) > 0 || duplicates.startsWith('reenquire')
                        ? ([['Will re-enquire', validation.willReEnquire ?? 0, 'text-violet-700']] as const)
                        : []),
                      ['Duplicate (will skip)', validation.duplicates, 'text-amber-700'],
                      ['Failed', validation.failed, 'text-red-700'],
                    ] as const
                  ).map(([label, value, tone]) => (
                    <div key={label} className="rounded-lg border border-slate-200 p-3 text-center">
                      <p className={cn('text-xl font-semibold', tone)}>{value}</p>
                      <p className="text-[11px] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    authorizedDownload(`/leads/import/errors/${validation.reportFile}`, 'validation-report.xlsx').catch((e) =>
                      toast.error(parseApiError(e).message)
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" /> Download validation report ({validation.total} rows)
                </Button>
                {validation.reasons.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {validation.reasons.map((e, i) => (
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
            </Card>
          )}

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            {blocker && <span className="mr-auto text-xs text-slate-500">{blocker}</span>}
            {!validation && !blocker && (
              <span className="mr-auto text-xs text-slate-500">
                Validate first — the import only runs after you confirm the result.
              </span>
            )}
            <Button variant="outline" disabled={jobRunning} onClick={() => (validation ? setValidation(null) : navigate('/app/leads'))}>
              {validation ? 'Cancel import' : 'Cancel'}
            </Button>
            {!validation ? (
              <Button onClick={onValidate} loading={validating} disabled={!preview || !!blocker} title={blocker ?? undefined}>
                <FileCheck className="h-3.5 w-3.5" /> Validate {preview ? `${preview.totalRows.toLocaleString()} rows` : ''}
              </Button>
            ) : (
              <Button onClick={onUpload} loading={uploading || jobRunning} disabled={!!blocker || jobRunning} title={blocker ?? undefined}>
                <Upload className="h-3.5 w-3.5" /> Confirm import ({(validation.willCreate + validation.willUpdate + (validation.willReEnquire ?? 0)).toLocaleString()} leads)
              </Button>
            )}
          </div>
          {jobRunning && (
            <div role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              <span>
                Importing {validation ? (validation.willCreate + validation.willUpdate + (validation.willReEnquire ?? 0)).toLocaleString() : ''} leads
                in the background — a big file can take a few minutes. You can leave this page; a notification arrives when it finishes.
              </span>
            </div>
          )}
        </div>
      )}
    </>
  )
}

const HOW_TONE: Record<ImportValue['how'], BadgeTone> = { auto: 'green', explicit: 'blue', missing: 'amber' }

/** The distinct texts of one lookup column, each with the CRM record it will become. */
function LookupBlock({
  field,
  column,
  items,
  missing,
  onChoose,
  onBlankUnmatched,
}: {
  field: ImportField
  column: string
  items: ImportValue[]
  missing: number
  onChoose: (text: string, choice: string) => void
  onBlankUnmatched: () => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { value: string; label: string }[]>()
    ;(field.choices ?? []).forEach((c) => {
      const g = c.group ?? ''
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push({ value: c.value, label: c.label })
    })
    return [...map.entries()]
  }, [field.choices])
  const grouped = groups.length > 1 || (groups.length === 1 && groups[0][0] !== '')
  const howLabel = (v: ImportValue) =>
    v.how === 'auto' ? 'Auto-matched' : v.how === 'missing' ? 'Unmatched' : v.target === null ? 'Left empty' : 'Chosen'

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold text-slate-700">
          {field.label} <span className="font-normal text-slate-400">← column “{column}”</span>
        </p>
        <div className="flex items-center gap-1.5">
          <Badge tone={missing ? 'amber' : 'green'}>{missing ? `${missing} unmatched` : 'all matched'}</Badge>
          {missing > 0 && (
            <Button variant="outline" size="sm" onClick={onBlankUnmatched}>
              Leave unmatched empty
            </Button>
          )}
        </div>
      </div>
      {field.hint && <p className="px-3 pt-2 text-[11px] text-slate-500">{field.hint}</p>}
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-400">The column is empty in every row.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white text-slate-500">
              <tr>
                <th className="px-3 py-1.5 text-left">Value in file</th>
                <th className="w-16 px-3 py-1.5 text-right">Rows</th>
                <th className="w-96 px-3 py-1.5 text-left">CRM record</th>
                <th className="px-3 py-1.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((v) => (
                <tr key={v.value} className={cn(v.how === 'missing' && 'bg-amber-50/60')}>
                  <td className="px-3 py-1.5 font-medium text-slate-800">{v.value}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500">{v.count}</td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={v.how === 'explicit' ? (v.target ?? EMPTY) : (v.target ?? '')}
                      onChange={(e) => onChoose(v.value, e.target.value)}
                      aria-label={`${field.label} for ${v.value}`}
                    >
                      <option value="">{v.how === 'missing' ? 'Unmatched — choose…' : '— automatic match —'}</option>
                      <option value={EMPTY}>Leave empty for this value</option>
                      {grouped
                        ? groups.map(([group, options]) => (
                            <optgroup key={group} label={group}>
                              {options.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </optgroup>
                          ))
                        : (field.choices ?? []).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge tone={v.how === 'explicit' && v.target === null ? 'slate' : HOW_TONE[v.how]}>{howLabel(v)}</Badge>
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

/**
 * Create a Masters → Custom field for one Excel column without leaving the upload.
 * Label, key and type are pre-filled from the column (its header and its values);
 * for a dropdown the options default to the distinct values found in the file.
 */
function CreateFieldPanel({
  column,
  existingKeys,
  onCreated,
  onCancel,
}: {
  column: ImportColumn
  existingKeys: string[]
  onCreated: (def: CustomFieldDef) => void
  onCancel: () => void
}) {
  const [create, { isLoading }] = useCreateImportCustomFieldMutation()
  const initialLabel = titleCase(column.header).slice(0, 100)
  const [label, setLabel] = useState(initialLabel)
  const [key, setKey] = useState(camelKey(initialLabel))
  const [keyEdited, setKeyEdited] = useState(false)
  const [type, setType] = useState<CustomFieldDef['type']>(column.suggestedType)
  const [options, setOptions] = useState(column.suggestedType === 'select' ? column.values.join(', ') : '')
  const [required, setRequired] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const optionList = [...new Set(options.split(',').map((o) => o.trim()).filter(Boolean))]
  const keyTaken = existingKeys.includes(key)
  const keyValid = /^[a-z][a-zA-Z0-9_]*$/.test(key)
  const valid = label.trim().length > 0 && keyValid && !keyTaken && (type !== 'select' || optionList.length > 0)
  const suggested = FIELD_TYPES.find((t) => t.value === column.suggestedType)?.label ?? column.suggestedType

  const submit = async () => {
    const body: Record<string, unknown> = { label: label.trim(), key, type, required }
    if (type === 'select') body.options = optionList
    try {
      const res = await create(body).unwrap()
      toast.success(`Custom field “${res.data.label}” created`)
      onCreated(res.data)
    } catch (err) {
      const e = parseApiError(err)
      setErrors(e.errors)
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        New custom field for <b className="font-medium text-slate-800">{column.header}</b>. It is saved in Masters → Custom fields
        and appears on the lead form, lead details and the list columns right away.
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <FormField label="Label" required error={errors.label}>
          <Input
            value={label}
            maxLength={100}
            onChange={(e) => {
              setLabel(e.target.value)
              if (!keyEdited) setKey(camelKey(e.target.value))
            }}
          />
        </FormField>
        <FormField
          label="Key"
          required
          hint="Stored on the lead; cannot change later"
          error={errors.key ?? (keyTaken ? 'A custom field with this key already exists' : key && !keyValid ? 'Letters and digits, starting lowercase' : undefined)}
        >
          <Input
            value={key}
            maxLength={50}
            onChange={(e) => {
              setKey(e.target.value)
              setKeyEdited(true)
            }}
          />
        </FormField>
        <FormField label="Type" required error={errors.type} hint={`Suggested from the file: ${suggested}`}>
          <Select
            value={type}
            onChange={(e) => {
              const next = e.target.value as CustomFieldDef['type']
              setType(next)
              if (next === 'select' && !options) setOptions(column.values.join(', '))
            }}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Required on the lead form">
          <label className="flex h-9 items-center gap-2 text-xs text-slate-600">
            <Checkbox checked={required} onChange={(e) => setRequired(e.target.checked)} /> Yes
          </label>
        </FormField>
      </div>
      {type === 'select' && (
        <FormField
          label="Options (comma-separated)"
          required
          error={errors.options}
          hint={`${column.distinct} distinct value${column.distinct === 1 ? '' : 's'} in the file${
            column.distinct > column.values.length ? ` (first ${column.values.length} listed)` : ''
          }. Rows whose value is not an option fail with a reason.`}
        >
          <div className="flex items-start gap-2">
            <Textarea value={options} onChange={(e) => setOptions(e.target.value)} />
            <Button variant="outline" size="sm" onClick={() => setOptions(column.values.join(', '))}>
              Use file values
            </Button>
          </div>
        </FormField>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} loading={isLoading} disabled={!valid}>
          <Plus className="h-3.5 w-3.5" /> Create & map column
        </Button>
      </div>
    </div>
  )
}
