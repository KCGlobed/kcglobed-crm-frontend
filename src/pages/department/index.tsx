import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Filter, Plus, ChevronDown, MoreVertical, Eye, Power, Trash2 } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchDepartments, updateDepartmentStatus, deleteDepartment } from '../../store/slices/departmentSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import { FiEdit } from 'react-icons/fi';
import DepartmentForm from '../../components/components/Forms/DepartmentForm';
import DepartmentView from '../../components/components/View/DepartmentView';
import DeleteConfirmationModal from '../../components/components/Modal/DeleteModal';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { departmentFilterConfig } from '../../utils/filterConfiguration';
import type { Department } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const DepartmentThumbnail = ({ row }: { row: Department }) => {
    return (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border border-primary/30 bg-primary-soft text-primary-contrast">
            <span>{row.name ? row.name.charAt(0).toUpperCase() : 'D'}</span>
        </div>
    );
};

const ActionMenu = ({ row, onToggleStatus }: { row: Department; onToggleStatus: (row: Department) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { showModal } = useModal();
  const dispatch = useAppDispatch();

  // Rendered in a portal so the table's overflow/scroll containers can't clip it
  const MENU_WIDTH = 192; // matches w-48
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
          className="fixed w-48 bg-major rounded-xl shadow-lg border border-crmBorder py-1.5 z-[999] overflow-hidden"
        >
          <button
            onClick={closeAndDo(() => showModal({ title: 'Department Details', content: <DepartmentView departmentData={row} />, type: 'success', size: 'xl' }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
          >
            <Eye size={14} /> View Details
          </button>

          <button
            onClick={closeAndDo(() => showModal({ title: `Edit Department: ${row.name || row.code}`, content: <DepartmentForm departmentData={row} />, type: 'custom', size: 'lg' }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-green-600 hover:bg-green-50 transition-colors text-left"
          >
            <FiEdit size={14} /> Edit Department
          </button>

          <button
            onClick={closeAndDo(() => onToggleStatus(row))}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors text-left border-t border-crmBorder mt-1 pt-2 ${row.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
          >
            <Power size={14} /> {row.is_active ? 'Deactivate' : 'Activate'}
          </button>

          <button
            onClick={closeAndDo(() => showModal({
                title: 'Delete Department',
                content: (
                    <DeleteConfirmationModal
                        id={row.id!}
                        name={row.name || 'this department'}
                        onDelete={async (id) => {
                            await dispatch(deleteDepartment(id as number)).unwrap();
                        }}
                    />
                ),
                type: 'custom',
                size: 'md'
            }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left"
          >
            <Trash2 size={14} /> Delete Department
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

const ManageDepartments: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [ordering, setOrdering] = useState<string>('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states
    const [filters, setFilters] = useState({
        name: '',
        status: 'all' as 'all' | 'active' | 'deactive',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const {
        data: departments,
        loading,
        error,
        pagination,
    } = useAppSelector((state) => state.departments);

    const total_results = pagination?.total_results;
    const current_page = pagination?.current_page;
    const page_size = pagination?.page_size;

    const [pageSize, setPageSize] = useState(page_size || 10);
    const isMounted = React.useRef(false);

    // Server-side filters supported by GET /access/departments/ (search + is_active)
    const serverFilters = useMemo(() => ({
        search: debouncedSearchTerm || debouncedFilters.name || undefined,
        is_active: debouncedFilters.status === 'active' ? true : debouncedFilters.status === 'deactive' ? false : undefined,
    }), [debouncedSearchTerm, debouncedFilters]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.name) count++;
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

    // Fetch departments when currentPage or pageSize changes
    useEffect(() => {
        dispatch(fetchDepartments({ page: currentPage, page_size: pageSize, ...serverFilters }));
    }, [dispatch, currentPage, pageSize, serverFilters]);

    const departmentList = useMemo(() => departments || [], [departments]);
    const totalCount = total_results ?? departmentList.length;

    // Reset to first page when search or filters change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        }
    }, [debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            name: '',
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

    const handleToggleStatus = async (row: Department) => {
        if (row.id == null) return;
        const newStatus = !row.is_active;
        try {
            await dispatch(updateDepartmentStatus({ id: row.id, is_active: newStatus })).unwrap();
            toast.success(`Department is ${newStatus ? 'active' : 'inactive'}`);
        } catch (error: any) {
            toast.error(error?.message || error || 'Failed to update status');
        }
    };

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'name',
            title: 'Department',
            render: (_: any, row: Department) => (
                <div className="flex items-center gap-3">
                    <DepartmentThumbnail row={row} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.name}</span>
                        <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">{row.code}</span>
                    </div>
                </div>
            ),
            sortable: true,
            width: '220px',
        },
        {
            key: 'description',
            title: 'Description',
            render: (value: string) => (
                <div
                    className={`text-xs w-full max-w-xs line-clamp-2 ${value ? 'text-crmText-secondary' : 'text-crmText-tertiary italic'}`}
                    title={value || 'No description provided.'}
                >
                    {value || 'No description provided.'}
                </div>
            ),
            width: '240px',
        },
        {
            key: 'head',
            title: 'Head',
            render: (_: any, row: Department) => (
                <span className={`text-xs whitespace-nowrap ${row.head?.name ? 'font-semibold text-crmText' : 'text-crmText-tertiary italic'}`}>
                    {row.head?.name || 'Unassigned'}
                </span>
            ),
            width: '160px',
        },
        {
            key: 'team_count',
            title: 'Teams',
            render: (value: number) => (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-major-tint text-crmText-secondary border border-crmBorder whitespace-nowrap">
                    {value ?? 0} {value === 1 ? 'team' : 'teams'}
                </span>
            ),
            width: '100px',
            align: 'center',
        },
        {
            key: 'member_count',
            title: 'Members',
            render: (value: number) => (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-major-tint text-crmText-secondary border border-crmBorder whitespace-nowrap">
                    {value ?? 0} {value === 1 ? 'member' : 'members'}
                </span>
            ),
            width: '110px',
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
            render: (value: boolean, _row: Department) => (
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
        },
        {
            key: 'id',
            title: 'Actions',
            render: (_: any, row: Department) => (
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
                        placeholder="Search departments..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                            className="flex items-center gap-1.5 px-4 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-minor/20 shadow-sm cursor-pointer border-none"
                            onClick={() =>
                                showModal({
                                    title: "Add Department",
                                    content: <DepartmentForm />,
                                    type: 'custom',
                                    size: 'lg',
                                })
                            }
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            Add Department
                        </button>
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={departmentFilterConfig}
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
                    data={departmentList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchDepartments({ page: currentPage, page_size: pageSize, ...serverFilters }))}
                    emptyTitle="No departments found"
                    emptyDescription="There are no departments to display at the moment."
                    rowKey={(row: Department) => row.id ?? row.code ?? row.name ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1); // Reset to first page when size changes
                    }}
                    onRowClick={(row) =>
                        showModal({
                            title: 'Department Details',
                            content: <DepartmentView departmentData={row} />,
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

export const DepartmentsPage = ManageDepartments;
export default ManageDepartments;
