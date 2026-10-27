import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, CalendarClock, FileSpreadsheet, FileText } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { authorizedDownload } from '../../lib/download'
import { cn, parseApiError } from '../../lib/utils'
import { useReportCatalogQuery, useReportDataQuery } from '../../services/reportsApi'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { Input } from '../../components/ui/fields'
import type { ReportDefinition, ReportRow } from '../../types/models'
import { formatValue, periodRange } from './reportFormat'

/** A report row on screen: its Sr. No., or the Grand Total line. */
interface TableRow {
  key: string
  n: number | null
  total: boolean
  values: ReportRow
}

/** The catalog grouped by category, the selected report with its dates, totals and downloads. */
export function ReportViewer({ onSchedule }: { onSchedule: (reportKey: string) => void }) {
  const user = useCurrentUser()
  const canExport = can(user, 'reports', 'export')
  const canSchedule = can(user, 'reports', 'create')
  const [params, setParams] = useSearchParams()
  const catalog = useReportCatalogQuery()
  const reports = useMemo(() => catalog.data?.data ?? [], [catalog.data])
  const report = reports.find((r) => r.key === params.get('report')) ?? reports[0]

  const today = dayjs().format('YYYY-MM-DD')
  const [defaultFrom, defaultTo] = report ? periodRange(report.defaultPeriod) : [today, today]
  const dateFrom = params.get('date_from') || defaultFrom
  const dateTo = report?.oneDay ? dateFrom : params.get('date_to') || defaultTo
  const data = useReportDataQuery(
    { key: report?.key ?? '', dateFrom, dateTo: report?.oneDay ? undefined : dateTo },
    { skip: !report }
  )
  // currentData: nothing from the previous report or dates while the new one loads
  const result = data.currentData?.data
  const [downloading, setDownloading] = useState<'xlsx' | 'csv' | null>(null)

  const update = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(values)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const pickReport = (key: string) => update({ report: key, date_from: undefined, date_to: undefined })
  const setRange = (from: string, to: string) => update({ date_from: from, date_to: report?.oneDay ? undefined : to })

  const download = async (fmt: 'xlsx' | 'csv') => {
    if (!report) return
    const qs = new URLSearchParams({ dateFrom, ...(report.oneDay ? {} : { dateTo }), format: fmt })
    setDownloading(fmt)
    try {
      await authorizedDownload(`/reports/${report.key}/export?${qs.toString()}`, `${report.key}-${dateFrom}.${fmt}`)
    } catch (e) {
      toast.error(parseApiError(e).message)
    } finally {
      setDownloading(null)
    }
  }

  if (catalog.isLoading) return <LoadingState />
  if (catalog.isError) return <ErrorState onRetry={catalog.refetch} error={catalog.error} />
  if (!report) return <EmptyState icon={BarChart3} title="No reports available" description="Ask your administrator for access to reports." />

  const categories = [...new Set(reports.map((r) => r.category))]
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label="Reports" className="space-y-4">
        {categories.map((category) => (
          <div key={category}>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{category}</p>
            <div className="space-y-1">
              {reports
                .filter((r) => r.category === category)
                .map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => pickReport(r.key)}
                    aria-current={r.key === report.key ? 'page' : undefined}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                      r.key === report.key
                        ? 'border-brand-200 bg-brand-50 text-brand-800'
                        : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white'
                    )}
                  >
                    <span className="block text-sm font-medium">{r.name}</span>
                    <span className="block text-[11px] text-slate-500">{r.oneDay ? 'One day' : 'Date range'}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </nav>

      <section className="min-w-0 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">{report.name}</h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-500">{report.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canExport && (
                <>
                  <Button variant="outline" size="sm" onClick={() => download('xlsx')} loading={downloading === 'xlsx'}>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => download('csv')} loading={downloading === 'csv'}>
                    <FileText className="h-3.5 w-3.5" /> CSV
                  </Button>
                </>
              )}
              {canSchedule && (
                <Button size="sm" onClick={() => onSchedule(report.key)}>
                  <CalendarClock className="h-3.5 w-3.5" /> Schedule email
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            {report.periods.map((p) => {
              const [from, to] = periodRange(p.value)
              const active = from === dateFrom && to === dateTo
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setRange(from, to)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                    active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
                  )}
                >
                  {p.label}
                </button>
              )
            })}
            <div className="flex items-center gap-1.5">
              <label className="sr-only" htmlFor="report-from">
                {report.oneDay ? 'Date' : 'From'}
              </label>
              <Input
                id="report-from"
                type="date"
                className="h-8 w-auto text-xs"
                value={dateFrom}
                max={today}
                onChange={(e) => e.target.value && setRange(e.target.value, report.oneDay || e.target.value > dateTo ? e.target.value : dateTo)}
              />
              {!report.oneDay && (
                <>
                  <span className="text-xs text-slate-400">to</span>
                  <label className="sr-only" htmlFor="report-to">
                    To
                  </label>
                  <Input
                    id="report-to"
                    type="date"
                    className="h-8 w-auto text-xs"
                    value={dateTo}
                    min={dateFrom}
                    max={today}
                    onChange={(e) => e.target.value && setRange(dateFrom, e.target.value)}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {result && result.summary.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {result.summary.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{formatValue(s.type, s.value)}</p>
              </div>
            ))}
          </div>
        )}

        <ReportTable
          report={report}
          rows={result?.rows}
          totals={result?.totals ?? null}
          loading={data.isFetching}
          error={data.isError}
          errorDetail={data.error}
          onRetry={data.refetch}
          period={result?.periodLabel}
        />

        {report.notes.map((note) => (
          <p key={note} className="text-[11px] leading-5 text-slate-500">
            {note}
          </p>
        ))}
      </section>
    </div>
  )
}

function ReportTable({
  report,
  rows,
  totals,
  loading,
  error,
  errorDetail,
  onRetry,
  period,
}: {
  report: ReportDefinition
  rows: ReportRow[] | undefined
  totals: ReportRow | null
  loading: boolean
  error: boolean
  errorDetail: unknown
  onRetry: () => void
  period?: string
}) {
  const columns: Column<TableRow>[] = [
    ...(report.numbered
      ? [{
          key: '__n',
          header: 'Sr. No.',
          align: 'center' as const,
          render: (r: TableRow) => (r.total ? <span className="font-semibold">Grand Total</span> : <span className="text-xs text-slate-500">{r.n}</span>),
        }]
      : []),
    ...report.columns.map((c, i) => ({
      key: c.key,
      header: c.label,
      align: c.align,
      render: (r: TableRow) => {
        if (r.total && i === 0 && !report.numbered) return <span className="font-semibold">Grand Total</span>
        const value = r.values[c.key]
        if (r.total && (value === null || value === undefined)) return null
        return (
          <span className={cn('text-xs tabular-nums', c.type === 'text' ? 'text-slate-800' : 'text-slate-700', i === 0 && 'font-medium')}>
            {formatValue(c.type, value)}
          </span>
        )
      },
    })),
  ]
  const tableRows: TableRow[] | undefined = rows && [
    ...rows.map((values, i) => ({ key: String(i), n: i + 1, total: false, values })),
    ...(totals && rows.length ? [{ key: 'total', n: null, total: true, values: totals }] : []),
  ]
  return (
    <DataTable
      columns={columns}
      rows={tableRows}
      rowKey={(r) => r.key}
      loading={loading && !rows}
      error={error}
      errorDetail={errorDetail}
      onRetry={onRetry}
      emptyTitle="Nothing to report"
      emptyDescription={period ? `No data for ${period}.` : undefined}
      rowClassName={(r) => (r.total ? 'bg-slate-50 font-semibold [&_span]:font-semibold' : undefined)}
    />
  )
}
