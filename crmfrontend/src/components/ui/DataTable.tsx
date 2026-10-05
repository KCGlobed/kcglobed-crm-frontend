import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { Pagination as PaginationInfo } from '../../types/models'
import { EmptyState, ErrorState, Skeleton } from './feedback'
import { Select } from './fields'
import { Button } from './Button'
import { cn } from '../../lib/utils'

export interface Column<T> {
  key: string
  header: string
  /** custom header content (e.g. a select-all checkbox) */
  headerNode?: ReactNode
  render?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string
  loading?: boolean
  error?: boolean
  errorMessage?: string
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
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

/**
 * Server-driven table: search/sort/filter/pagination all live in the caller's
 * query params. A failed load renders an inline error with retry — the rest of
 * the page (filters, layout) keeps working (SOW §6).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  errorMessage,
  onRetry,
  emptyTitle,
  emptyDescription,
  sortBy,
  sortOrder,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  rowClassName,
  pageSizes = [10, 25, 50, 100],
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-2.5 font-semibold', col.className)}>
                  {col.headerNode ? (
                    col.headerNode
                  ) : col.sortable && onSort ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-slate-800"
                      onClick={() => onSort(col.key)}
                    >
                      {col.header}
                      {sortBy === col.key ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-32" />
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
                  className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-brand-50/40', rowClassName?.(row))}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 align-middle', col.className)}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && error && <ErrorState message={errorMessage} onRetry={onRetry} />}
        {!loading && !error && rows?.length === 0 && (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )}
      </div>

      {pagination && pagination.total_results > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <b className="text-slate-700">
                {(pagination.current_page - 1) * pagination.page_size + 1}–
                {Math.min(pagination.current_page * pagination.page_size, pagination.total_results)}
              </b>{' '}
              of <b className="text-slate-700">{pagination.total_results}</b>
            </span>
            {onPageSizeChange && (
              <Select
                className="!h-7 !w-auto !py-0 text-xs"
                value={pagination.page_size}
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
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.previous_page}
              onClick={() => onPageChange?.(pagination.previous_page!)}
            >
              Previous
            </Button>
            <span className="px-2">
              Page {pagination.current_page} of {pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.next_page}
              onClick={() => onPageChange?.(pagination.next_page!)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
