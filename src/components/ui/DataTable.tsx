import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Pagination as PaginationInfo } from '../../types/models'
import { EmptyState, ErrorState, Skeleton } from './feedback'
import { Select } from './fields'
import { cn } from '../../lib/utils'

export interface Column<T> {
  key: string
  header: string
  /** custom header content (e.g. a select-all checkbox) */
  headerNode?: ReactNode
  render?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  error?: boolean
  errorMessage?: string
  /** the raw error, logged to the console */
  errorDetail?: unknown
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  /** e.g. a "Clear filters" button — only actions that exist */
  emptyAction?: ReactNode
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
  pagination?: PaginationInfo
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  pageSizes?: number[]
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' }

/** Page numbers with gaps: 1 … 4 5 6 … 20 */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

export function Pagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50, 100],
}: {
  pagination: PaginationInfo
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
}) {
  const { current_page: page, total_pages: pages, page_size: size, total_results: total } = pagination
  const navBtn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40'
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span>
          <b className="font-semibold text-slate-700">
            {(page - 1) * size + 1}–{Math.min(page * size, total)}
          </b>{' '}
          of <b className="font-semibold text-slate-700">{total.toLocaleString()}</b>
        </span>
        {onPageSizeChange && (
          <Select
            aria-label="Rows per page"
            className="!h-8 !w-auto !py-0 text-xs"
            value={size}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </Select>
        )}
      </div>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" className={cn(navBtn, 'hover:bg-slate-100')} disabled={!pagination.previous_page} onClick={() => onPageChange?.(page - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                type="button"
                key={p}
                onClick={() => onPageChange?.(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(navBtn, p === page ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                {p}
              </button>
            )
          )}
          <button type="button" className={cn(navBtn, 'hover:bg-slate-100')} disabled={!pagination.next_page} onClick={() => onPageChange?.(page + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  )
}

/**
 * Server-driven table: search/sort/filter/pagination live in the caller's
 * query params. Sticky header, horizontal scroll on small screens; a failed
 * load renders an inline error with retry while the rest of the page keeps working.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  errorMessage,
  errorDetail,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  sortBy,
  sortOrder,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  rowClassName,
  pageSizes,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-[calc(100vh-15rem)] min-h-40 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {columns.map((col) => {
                const active = sortBy === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5',
                      ALIGN[col.align ?? 'left'],
                      col.className
                    )}
                  >
                    {col.headerNode ? (
                      col.headerNode
                    ) : col.sortable && onSort ? (
                      <button
                        type="button"
                        className={cn('inline-flex items-center gap-1 uppercase hover:text-slate-800', active && 'text-slate-800')}
                        onClick={() => onSort(col.key)}
                      >
                        {col.header}
                        {active ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="border-b border-slate-100 px-4 py-3.5">
                      <Skeleton className="h-3.5 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              !error &&
              rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'group transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-brand-50/50',
                    !onRowClick && 'hover:bg-slate-50/70',
                    rowClassName?.(row)
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('h-12 whitespace-nowrap border-b border-slate-100 px-4 py-2 align-middle', ALIGN[col.align ?? 'left'], col.className)}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && error && <ErrorState message={errorMessage} onRetry={onRetry} error={errorDetail} />}
        {!loading && !error && rows?.length === 0 && (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )}
      </div>

      {pagination && pagination.total_results > 0 && (
        <Pagination pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} pageSizes={pageSizes} />
      )}
    </div>
  )
}

/** Truncated cell text with the full value as a tooltip. */
export function CellText({ children, className, muted }: { children?: ReactNode; className?: string; muted?: boolean }) {
  const text = children === undefined || children === null || children === '' ? '—' : children
  return (
    <span
      className={cn('block max-w-56 truncate text-xs', muted ? 'text-slate-500' : 'text-slate-700', className)}
      title={typeof text === 'string' || typeof text === 'number' ? String(text) : undefined}
    >
      {text}
    </span>
  )
}
