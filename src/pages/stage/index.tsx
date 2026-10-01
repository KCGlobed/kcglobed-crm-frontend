import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Filter, Plus, ChevronDown, MoreVertical, Eye, Power, Trash2 } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchStages, updateStage, deleteStage } from '../../store/slices/stageSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import { FiEdit } from 'react-icons/fi';
import StageForm from '../../components/components/Forms/StageForm';
import StageView from '../../components/components/View/StageView';
import DeleteConfirmationModal from '../../components/components/Modal/DeleteModal';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { stageFilterConfig } from '../../utils/filterConfiguration';
import type { Stage } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const KIND_BADGE_CLASSES: Record<string, string> = {
    open: 'bg-crmInfo-bg text-crmInfo border-crmInfo-border',
    won: 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border',
    lost: 'bg-crmDanger-bg text-crmDanger border-crmDanger-border',
};

const StageThumbnail = ({ row }: { row: Stage }) => {
    return (
        <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-sm overflow-hidden shrink-0 border border-crmBorder"
            style={{ backgroundColor: row.color || '#2563eb' }}
        >
            <span>{row.name ? row.name.charAt(0).toUpperCase() : 'S'}</span>
        </div>
    );
};

const ActionMenu = ({ row, onToggleStatus }: { row: Stage; onToggleStatus: (row: Stage) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { showModal } = useModal();
  const dispatch = useAppDispatch();

  // Rendered in a portal so the table's overflow/scroll containers can't clip it
  const MENU_WIDTH = 176; // matches w-44
  const EST_MENU_HEIGHT = 220;

  const openMenu = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const style: React.CSSProperties =
      spaceBelow < EST_MENU_HEIGHT && rect.top > spaceBelow
        ? { left, bottom: window.innerHeight - rect.top + 4 }
        : { left, top: rect.bottom + 4 };
    setMenuStyle(style);
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => setIsOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const closeAndDo = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    action();
  };

  return (
    <div className="relative flex justify-center">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            setIsOpen(false);
          } else {
            openMenu();
          }
        }}
        className="p-1.5 text-crmText-secondary hover:text-minor hover:bg-minor-soft rounded-lg transition-colors cursor-pointer"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={menuStyle}
          className="fixed w-44 bg-major rounded-xl shadow-lg border border-crmBorder py-1.5 z-[999] overflow-hidden"
        >
          <button
            onClick={closeAndDo(() => showModal({ title: 'Stage Details', content: <StageView stageData={row} />, type: 'success', size: 'xl' }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
          >
            <Eye size={14} /> View Details
          </button>

          <button
            onClick={closeAndDo(() => showModal({ title: `Edit Stage: ${row.name || row.code}`, content: <StageForm stageData={row} />, type: 'custom', size: 'lg' }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-green-600 hover:bg-green-50 transition-colors text-left"
          >
            <FiEdit size={14} /> Edit Stage
          </button>

          <button
            onClick={closeAndDo(() => onToggleStatus(row))}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors text-left border-t border-crmBorder mt-1 pt-2 ${row.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
          >
            <Power size={14} /> {row.is_active ? 'Deactivate Stage' : 'Activate Stage'}
          </button>

          <button
            onClick={closeAndDo(() => showModal({
                title: 'Delete Stage',
                content: (
                    <DeleteConfirmationModal
                        id={row.id!}
                        name={row.name || 'this stage'}
                        onDelete={async (id) => {
                            await dispatch(deleteStage(id as number)).unwrap();
                        }}
                    />
                ),
                type: 'custom',
                size: 'md'
            }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left"
          >
            <Trash2 size={14} /> Delete Stage
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

const ManageStages: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [ordering, setOrdering] = useState<string>('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states
    const [filters, setFilters] = useState({
        name: '',
        code: '',
        kind: '',
        status: 'all' as 'all' | 'active' | 'deactive',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const {
        data: stages,
        loading,
        error,
        pagination,
    } = useAppSelector((state) => state.stages);

    const total_results = pagination?.total_results;
    const current_page = pagination?.current_page;
    const page_size = pagination?.page_size;

    const [pageSize, setPageSize] = useState(page_size || 10);
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.name) count++;
        if (filters.code) count++;
        if (filters.kind) count++;
        if (filters.status && filters.status !== 'all') count++;
        if (ordering) count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, ordering, startDate, endDate]);

    // Sync with Redux current_page if it changes
    useEffect(() => {
        if (current_page && current_page !== currentPage) {
            setCurrentPage(current_page);
        }
    }, [current_page]);

    // Fetch stages when currentPage or pageSize changes
    useEffect(() => {
        dispatch(fetchStages({ page: currentPage, page_size: pageSize }));
    }, [dispatch, currentPage, pageSize]);

    const stageList = useMemo(() => stages || [], [stages]);
    const totalCount = total_results ?? stageList.length;

    // Reset to first page when search or filters change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            dispatch(fetchStages({ page: 1, page_size: pageSize }));
        }
    }, [debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            name: '',
            code: '',
            kind: '',
            status: 'all',
        });
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setOrdering('');
    };

    const handleSort = (key: string, direction: 'asc' | 'desc') => {
        const orderPrefix = direction === 'desc' ? '-' : '';
        setOrdering(`${orderPrefix}${key}`);
    };

    const handleDirectionSort = (direction: 'asc' | 'desc') => {
        const currentKey = ordering.replace(/^-/, '') || 'name';
        handleSort(currentKey, direction);
    };

    const handleToggleStatus = async (row: Stage) => {
        if (row.id == null) return;
        const newStatus = !row.is_active;
        try {
            await dispatch(updateStage({ id: row.id, payload: { is_active: newStatus } as Stage })).unwrap();
            toast.success(`Stage is ${newStatus ? 'active' : 'inactive'}`);
        } catch (error: any) {
            toast.error(error?.message || error || 'Failed to update status');
        }
    };

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'name',
            title: 'Stage',
            render: (_: any, row: Stage) => (
                <div className="flex items-center gap-3">
                    <StageThumbnail row={row} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.name}</span>
                        {row.is_default && (
                            <span className="text-[10px] font-bold text-crmInfo uppercase tracking-wider whitespace-nowrap">Default</span>
                        )}
                    </div>
                </div>
            ),
            sortable: true,
            width: '200px',
        },
        {
            key: 'code',
            title: 'Code',
            render: (value: string) => (
                <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">{value || '-'}</span>
            ),
            sortable: true,
            width: '130px',
        },
        {
            key: 'kind',
            title: 'Kind',
            render: (value: string) => (
                <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                        KIND_BADGE_CLASSES[value] || 'bg-major-tint text-crmText-secondary border-crmBorder'
                    }`}
                >
                    {value || '-'}
                </span>
            ),
            width: '100px',
            align: 'center',
            sortable: true,
        },
        {
            key: 'color',
            title: 'Color',
            render: (value: string) => (
                <div className="flex items-center gap-2 justify-center">
                    <span
                        className="inline-block h-4 w-4 rounded-full border border-crmBorder shrink-0"
                        style={{ backgroundColor: value || '#2563eb' }}
                    />
                    <span className="text-[11px] text-crmText-secondary font-mono whitespace-nowrap">{value || '-'}</span>
                </div>
            ),
            width: '120px',
            align: 'center',
        },
        {
            key: 'sort_order',
            title: 'Sort Order',
            render: (value: number) => (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-major-tint text-crmText-secondary border border-crmBorder whitespace-nowrap">
                    {value ?? '-'}
                </span>
            ),
            sortable: true,
            width: '110px',
            align: 'center',
        },
        {
            key: 'lead_count',
            title: 'Leads',
            render: (value: number) => (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-major-tint text-crmText-secondary border border-crmBorder whitespace-nowrap">
                    {value ?? 0} {value === 1 ? 'lead' : 'leads'}
                </span>
            ),
            sortable: true,
            width: '100px',
            align: 'center',
        },
        {
            key: 'created_at',
            title: 'Created On',
            render: (value: string) => (
                <div className="flex flex-col">
                    <span className="text-crmText text-xs font-semibold">{value ? moment(value).format('MMM DD, YYYY') : '-'}</span>
                    <span className="text-crmText-tertiary text-[10px] uppercase font-bold">{value ? moment(value).format('hh:mm A') : ''}</span>
                </div>
            ),
            sortable: true,
            width: '130px',
        },
        {
            key: 'is_active',
            title: 'Status',
            render: (value: boolean, _row: Stage) => (
                <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        value
                            ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                            : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
                    }`}
                >
                    {value ? 'Active' : 'Inactive'}
                </span>
            ),
            width: '100px',
            align: 'center',
            sortable: true,
        },
        {
            key: 'id',
            title: 'Actions',
            render: (_: any, row: Stage) => (
                <ActionMenu row={row} onToggleStatus={handleToggleStatus} />
            ),
            width: '120px',
            align: 'right',
        },
    ];

    return (
        <div className="flex flex-col gap-4 w-full h-[calc(100vh-6rem)] max-w-full min-w-0 animate-in fade-in duration-500">
            {/* Premium Top Action Bar */}
            <div className="flex flex-col bg-major rounded-2xl shadow-crm-card border border-crmBorder relative">
                <div className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
                        <button
                            onClick={() => setShowFilter(!showFilter)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border ${
                                showFilter || activeFilterCount > 0
                                    ? 'border-minor/30 text-minor-contrast bg-minor-soft'
                                    : 'border-crmBorder text-crmText-secondary hover:border-crmBorder-strong hover:bg-major-tint'
                            }`}
                        >
                            <Filter size={16} className={showFilter || activeFilterCount > 0 ? "text-minor-contrast" : "text-crmText-tertiary"} />
                            <span>Filter</span>
                            <ChevronDown
                                size={14}
                                className={`text-crmText-secondary transition-transform duration-200 ${showFilter ? 'rotate-180' : ''}`}
                            />
                            {activeFilterCount > 0 && (
                                <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        <DateRangeDropdown
                            startDate={startDate}
                            endDate={endDate}
                            defaultPreset="all"
                            onDateChange={(start, end) => {
                                setStartDate(start);
                                setEndDate(end);
                            }}
                        />
                    </div>

                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search stages..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                            className="flex items-center gap-1.5 px-4 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-minor/20 shadow-sm cursor-pointer border-none"
                            onClick={() =>
                                showModal({
                                    title: "Add Stage",
                                    content: <StageForm />,
                                    type: 'custom',
                                    size: 'lg',
                                })
                            }
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            Add Stage
                        </button>
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={stageFilterConfig}
                    values={filters}
                    onChange={handleFilterChange}
                    onClear={clearFilters}
                    onClose={() => setShowFilter(false)}
                    ordering={ordering}
                    onDirectionSort={handleDirectionSort}
                />
            </div>

            {/* Main Table Content */}
            <div className="flex flex-col bg-major rounded-2xl shadow-crm-card overflow-hidden border border-crmBorder w-full max-w-full min-w-0">
                <DynamicServerTable
                    data={stageList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchStages({ page: currentPage, page_size: pageSize }))}
                    emptyTitle="No stages found"
                    emptyDescription="There are no stages to display at the moment."
                    rowKey={(row: Stage) => row.id ?? row.code ?? row.name ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1); // Reset to first page when size changes
                    }}
                    onRowClick={(row) =>
                        showModal({
                            title: 'Stage Details',
                            content: <StageView stageData={row} />,
                            type: 'success',
                            size: 'xl',
                        })
                    }
                    onSort={handleSort}
                    className="rounded-none border-none shadow-none"
                    maxHeight="100%"
                />
            </div>
        </div>
    );
};

export const StagesPage = ManageStages;
export default ManageStages;
