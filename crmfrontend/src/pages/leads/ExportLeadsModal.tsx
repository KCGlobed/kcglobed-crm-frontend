import { useState, type ReactNode } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useAppSelector } from '../../app/hooks'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { API_BASE_URL } from '../../constants/config'
import { cn, downloadBlob, parseApiError } from '../../lib/utils'
import { LEAD_COLUMNS } from './leadColumns'

// GL-38: up to 10,000 rows download at once; larger exports are prepared in the background
const EXPORT_LIMIT = 10_000
const ALL_EXPORT_KEYS = [...new Set([...LEAD_COLUMNS.flatMap((c) => c.exportKeys), 'subStage', 'channel', 'metaLeadId'])]

type Format = 'csv' | 'xlsx'
type ColumnChoice = 'visible' | 'all'

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
        active ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300'
      )}
    >
      {children}
    </button>
  )
}

/**
 * Lead export (SOW ID 32): the current search + filters, within the user's
 * data scope and field masking, as CSV or Excel, with the visible or all columns.
 */
export function ExportLeadsModal({
  open,
  onClose,
  filters,
  visibleColumnKeys,
  total,
}: {
  open: boolean
  onClose: () => void
  /** the list's URL params (page/sort are ignored) */
  filters: URLSearchParams
  /** table columns currently shown, in order */
  visibleColumnKeys: string[]
  total?: number
}) {
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const [format, setFormat] = useState<Format>('xlsx')
  const [columns, setColumns] = useState<ColumnChoice>('visible')
  const [busy, setBusy] = useState(false)

  const visibleExportKeys = LEAD_COLUMNS.filter((c) => visibleColumnKeys.includes(c.key))
    .sort((a, b) => visibleColumnKeys.indexOf(a.key) - visibleColumnKeys.indexOf(b.key))
    .flatMap((c) => c.exportKeys)
  const activeFilters = [...filters.entries()].filter(([k, v]) => v && !['page', 'page_size', 'sort_by', 'sort_order'].includes(k))

  const onExport = async () => {
    setBusy(true)
    try {
      const qs = new URLSearchParams(activeFilters)
      qs.set('format', format)
      qs.set('columns', (columns === 'visible' ? visibleExportKeys : ALL_EXPORT_KEYS).join(','))
      const res = await fetch(`${API_BASE_URL}/leads/export?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw { data: await res.json().catch(() => null) }
      if (res.status === 202) {
        const body = await res.json()
        toast.success(body.message)
        onClose()
        return
      }
      downloadBlob(await res.blob(), `leads-export-${new Date().toISOString().slice(0, 10)}.${format}`)
      toast.success('Export downloaded')
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export leads"
      description="Exports the leads matching your current search and filters, within your access."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onExport} loading={busy}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Format</p>
          <div className="flex gap-2">
            <Choice active={format === 'xlsx'} onClick={() => setFormat('xlsx')}>
              <FileSpreadsheet className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>
                <span className="block font-medium text-slate-700">Excel (.xlsx)</span>
                <span className="text-slate-500">Opens directly in Excel / Sheets</span>
              </span>
            </Choice>
            <Choice active={format === 'csv'} onClick={() => setFormat('csv')}>
              <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
              <span>
                <span className="block font-medium text-slate-700">CSV</span>
                <span className="text-slate-500">Plain text, any tool</span>
              </span>
            </Choice>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Columns</p>
          <div className="flex gap-2">
            <Choice active={columns === 'visible'} onClick={() => setColumns('visible')}>
              <span>
                <span className="block font-medium text-slate-700">Visible columns</span>
                <span className="text-slate-500">{visibleExportKeys.length} fields, in the table's order</span>
              </span>
            </Choice>
            <Choice active={columns === 'all'} onClick={() => setColumns('all')}>
              <span>
                <span className="block font-medium text-slate-700">All columns</span>
                <span className="text-slate-500">{ALL_EXPORT_KEYS.length} fields</span>
              </span>
            </Choice>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {total !== undefined && (
            <p>
              <b className="text-slate-800">{total.toLocaleString()}</b> lead{total === 1 ? '' : 's'} will be exported
              {total > EXPORT_LIMIT && ' — more than 10,000, so the file is prepared in the background and the download link (valid 24 hours) arrives in your notifications'}.
            </p>
          )}
          <p className="mt-0.5 text-slate-500">
            {activeFilters.length ? `${activeFilters.length} filter${activeFilters.length === 1 ? '' : 's'} applied.` : 'No filters applied.'}{' '}
            All columns include the student profile and counsellor discussion fields. The export is logged.
          </p>
        </div>
      </div>
    </Modal>
  )
}
