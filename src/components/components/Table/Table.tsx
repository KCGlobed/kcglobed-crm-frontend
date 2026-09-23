import React from 'react';
import {
  FiAlertTriangle,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown,
  FiInbox,
  FiRefreshCw,
} from 'react-icons/fi';

export type ColumnDefinition<T> = {
  key: keyof T;
  title: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  onClick?: (value: T[keyof T], row: T) => void;
  width?: string;
  minWidth?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
};

type Props<T> = {
  data: T[];
  columns: ColumnDefinition<T>[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  className?: string;
  maxHeight?: string;
  minWidth?: string;
  /** Error message shown instead of rows, with an optional retry action. */
  error?: string | null;
  onRetry?: () => void;
  /** Empty-state copy and call to action. */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Stable row key - falls back to the array index. */
  rowKey?: (row: T, index: number) => React.Key;
  /** Optional toolbar rendered above the table inside the same card. */
  toolbar?: React.ReactNode;
};

function DynamicServerTable<T extends object>({
  data,
  columns,
  currentPage,
  pageSize,
  totalCount,
  loading = false,
  onPageChange,
  onSort,
  className = '',
  maxHeight = 'calc(100vh - 280px)',
  minWidth = 'max-content',
  error = null,
  onRetry,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no entries to display at the moment.',
  emptyAction,
  rowKey,
  toolbar,
}: Props<T>) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const [activeSort, setActiveSort] = React.useState<{ key: keyof T | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  const handleSort = (key: keyof T) => {
    const direction = activeSort.key === key && activeSort.direction === 'asc' ? 'desc' : 'asc';
    setActiveSort({ key, direction });

    if (onSort) {
      onSort(key, direction);
    }
  };

  const sortedData = React.useMemo(() => {
    // If onSort is provided, we assume the parent handles sorting (server-side)
    if (onSort || !activeSort.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[activeSort.key!];
      const bVal = b[activeSort.key!];

      if (aVal === bVal) return 0;

      // Handle different types (strings, numbers, etc.)
      const factor = activeSort.direction === 'asc' ? 1 : -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return factor * aVal.localeCompare(bVal);
      }

      return aVal > bVal ? factor : -factor;
    });
  }, [data, activeSort, onSort]);

  const cellStyle = (col: ColumnDefinition<T>) => ({
    textAlign: col.align || ('left' as const),
    width: col.width || 'auto',
    minWidth: col.minWidth || col.width || '140px',
  });

  const alignClass = (col: ColumnDefinition<T>) =>
    col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start';

  const renderSkeleton = () =>
    Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
      <tr key={`skeleton-${i}`}>
        {columns.map((col, j) => (
          <td key={j} className="border-b border-crmBorder px-4 py-3" style={cellStyle(col)}>
            <div className="h-3.5 w-3/4 animate-pulse rounded-md bg-major-muted" />
          </td>
        ))}
      </tr>
    ));

  const renderStateRow = (content: React.ReactNode) => (
    <tr>
      <td colSpan={columns.length} className="px-6 py-16 text-center">
        {content}
      </td>
    </tr>
  );

  return (
    <div
      className={`flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-crmBorder bg-major shadow-crm-card ${className}`}
    >
      {toolbar}

      {/* Table Scroll Container */}
      <div
        className="relative w-full min-w-0 max-w-full overflow-auto [overscroll-behavior-x:none] [overscroll-behavior-y:contain]"
        style={{ maxHeight }}
      >
        <table className="w-full border-separate border-spacing-0" style={{ minWidth }}>
          <thead className="bg-major-muted">
            <tr>
              {columns.map((col) => {
                const isSorted = activeSort.key === col.key;
                return (
                  <th
                    key={String(col.key)}
                    aria-sort={isSorted ? (activeSort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`sticky top-0 z-10 select-none border-b border-crmBorder bg-major-muted px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-crmText-secondary ${
                      col.sortable ? 'cursor-pointer transition-colors hover:text-minor-contrast' : 'cursor-default'
                    }`}
                    style={cellStyle(col)}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className={`flex items-center gap-2 ${alignClass(col)}`}>
                      <span>{col.title}</span>
                      {col.sortable && (
                        <div className="flex translate-y-[1px] flex-col -space-y-1.5">
                          <FiChevronUp
                            className={`h-3.5 w-3.5 transition-all duration-200 ${
                              isSorted && activeSort.direction === 'asc'
                                ? 'scale-110 text-minor-contrast'
                                : 'text-crmText-tertiary/50'
                            }`}
                          />
                          <FiChevronDown
                            className={`h-3.5 w-3.5 transition-all duration-200 ${
                              isSorted && activeSort.direction === 'desc'
                                ? 'scale-110 text-minor-contrast'
                                : 'text-crmText-tertiary/50'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-major">
            {loading ? (
              renderSkeleton()
            ) : error ? (
              renderStateRow(
                <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-crmDanger-border bg-crmDanger-bg">
                    <FiAlertTriangle className="h-6 w-6 text-crmDanger" />
                  </div>
                  <h3 className="text-sm font-bold text-crmText">Could not load this list</h3>
                  <p className="mt-1 text-xs text-crmText-secondary">{error}</p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-4 inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-minor px-4 text-[13px] font-semibold text-white transition-colors hover:bg-minor-hover"
                    >
                      <FiRefreshCw className="h-3.5 w-3.5" />
                      Try again
                    </button>
                  )}
                </div>
              )
            ) : sortedData.length === 0 ? (
              renderStateRow(
                <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-crmBorder bg-major-muted">
                    <FiInbox className="h-6 w-6 text-crmText-tertiary" />
                  </div>
                  <h3 className="text-sm font-bold text-crmText">{emptyTitle}</h3>
                  <p className="mt-1 text-xs text-crmText-secondary">{emptyDescription}</p>
                  {emptyAction && <div className="mt-4">{emptyAction}</div>}
                </div>
              )
            ) : (
              sortedData.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className="transition-colors duration-150 hover:bg-major-tint"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`whitespace-nowrap border-b border-crmBorder px-4 py-2.5 text-xs ${
                        col.onClick ? 'cursor-pointer' : 'cursor-default'
                      }`}
                      style={cellStyle(col)}
                      onClick={() => col.onClick?.(row[col.key], row)}
                    >
                      <div
                        className={`flex items-center ${
                          col.onClick
                            ? 'font-semibold text-minor-contrast'
                            : 'font-medium text-crmText-secondary'
                        } ${alignClass(col)}`}
                      >
                        {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '-')}
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-crmBorder bg-major-tint px-4 py-3">
        <div className="text-xs font-medium text-crmText-tertiary">
          Showing{' '}
          <span className="font-semibold text-crmText">
            {totalCount === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, totalCount)}
          </span>{' '}
          to <span className="font-semibold text-crmText">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
          <span className="font-semibold text-crmText">{totalCount}</span> entries
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-crmBorder bg-major p-1 shadow-crm-sm">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex cursor-pointer items-center rounded-lg p-2 text-crmText-tertiary transition-colors hover:bg-major-muted hover:text-crmText disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              title="Previous Page"
              aria-label="Previous page"
              type="button"
            >
              <FiChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    type="button"
                    aria-current={currentPage === pageNum ? 'page' : undefined}
                    className={`h-[34px] min-w-[34px] cursor-pointer rounded-lg text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-minor text-white shadow-crm-accent'
                        : 'text-crmText-secondary hover:bg-major-muted'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-2 text-xs font-bold text-crmText-tertiary">...</span>
                  <button
                    onClick={() => onPageChange(totalPages)}
                    type="button"
                    className={`h-[34px] min-w-[34px] cursor-pointer rounded-lg text-xs font-bold transition-all ${
                      currentPage === totalPages
                        ? 'bg-minor text-white shadow-crm-accent'
                        : 'text-crmText-secondary hover:bg-major-muted'
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex cursor-pointer items-center rounded-lg p-2 text-crmText-tertiary transition-colors hover:bg-major-muted hover:text-crmText disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              title="Next Page"
              aria-label="Next page"
              type="button"
            >
              <FiChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DynamicServerTable;
