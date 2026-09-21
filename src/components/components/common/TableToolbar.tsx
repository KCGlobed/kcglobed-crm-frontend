import React from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import SearchInput from './SearchInput';

interface TableToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Omit to hide the filter button entirely. */
  onToggleFilter?: () => void;
  isFilterOpen?: boolean;
  activeFilterCount?: number;
  /** Right-aligned actions, e.g. an "Add" button. */
  actions?: React.ReactNode;
  /** Filter panel rendered underneath the bar (e.g. <DynamicFilter />). */
  filterPanel?: React.ReactNode;
  className?: string;
}

/**
 * Search + filter + primary action bar shared by every list screen,
 * so each page no longer hand-rolls its own toolbar.
 */
export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onToggleFilter,
  isFilterOpen = false,
  activeFilterCount = 0,
  actions,
  filterPanel,
  className = '',
}) => {
  const filterHighlighted = isFilterOpen || activeFilterCount > 0;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border border-crmBorder bg-major shadow-crm-card ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 p-3 sm:px-4">
        {onToggleFilter && (
          <button
            type="button"
            onClick={onToggleFilter}
            aria-expanded={isFilterOpen}
            className={`flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold transition-all ${
              filterHighlighted
                ? 'border-minor/30 bg-minor-soft text-minor-contrast'
                : 'border-crmBorder bg-transparent text-crmText-secondary hover:bg-major-muted'
            }`}
          >
            <Filter size={15} />
            <span className="hidden sm:inline">Filter</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : 'rotate-0'}`}
            />
            {activeFilterCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-minor px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {onSearchChange && (
          <SearchInput
            value={searchValue ?? ''}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        )}

        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {filterPanel}
    </div>
  );
};

export default TableToolbar;
