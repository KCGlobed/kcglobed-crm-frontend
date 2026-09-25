import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Filter, Plus, ChevronDown } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchModules, updateModule } from '../../store/slices/moduleSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import GlassButton from '../../components/components/Button/Button';
import { FiEye, FiEdit } from 'react-icons/fi';
import ModuleForm from '../../components/components/Forms/ModuleForm';
import ModuleView from '../../components/components/View/ModuleView';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { moduleFilterConfig } from '../../utils/filterConfiguration';
import type { Module } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const ModuleThumbnail = ({ row }: { row: Module }) => {
    return (
        <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border ${
                row.parent == null
                    ? 'border-primary/30 bg-primary-soft text-primary-contrast'
                    : 'border-crmBorder bg-major-tint text-crmText-secondary'
            }`}
        >
            <span>{row.name ? row.name.charAt(0).toUpperCase() : 'M'}</span>
        </div>
    );
};

const ManageModules: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [ordering, setOrdering] = useState<string>('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states
    const [filters, setFilters] = useState({
        name: '',
        code: '',
        status: 'all' as 'all' | 'active' | 'deactive',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const {
        data: modules,
        loading,
        error,
        total_results,
        current_page,
        page_size,
    } = useAppSelector((state) => state.modules);

    const pageSize = page_size || 10;
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.name) count++;
        if (filters.code) count++;
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

    // Fetch modules when currentPage or pageSize changes
    useEffect(() => {
        dispatch(fetchModules({ page: currentPage, page_size: pageSize }));
    }, [dispatch, currentPage, pageSize]);

    // Resolve a parent id to its module name using the loaded list
    const parentNameById = useMemo(() => {
        const map = new Map<number, string>();
        (modules || []).forEach((m) => {
            if (m.id != null) map.set(m.id, m.name || `#${m.id}`);
        });
        return map;
    }, [modules]);

    const moduleList = useMemo(() => modules || [], [modules]);
    const totalCount = total_results ?? moduleList.length;

    // Reset to first page when search or filters change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            dispatch(fetchModules({ page: 1, page_size: pageSize }));
        }
    }, [debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            name: '',
            code: '',
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

    const handleToggleStatus = async (row: Module) => {
        if (row.id == null) return;
        const newStatus = !row.is_active;
        try {
            await dispatch(updateModule({ id: row.id, payload: { is_active: newStatus } as Module })).unwrap();
            toast.success(`Module is ${newStatus ? 'active' : 'inactive'}`);
        } catch (error: any) {
            console.error("Failed to update status", error);
            toast.error(error?.message || error || 'Failed to update status');
        }
    };

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'name',
            title: 'Module',
            render: (_: any, row: Module) => (
                <div className="flex items-center gap-3">
                    <ModuleThumbnail row={row} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.name}</span>
                        <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">{row.code}</span>
                    </div>
                </div>
            ),
            sortable: true,
            width: '240px',
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
            sortable: true,
            width: '280px',
        },
        {
            key: 'parent',
            title: 'Parent',
            render: (value: number | null) => (
                <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                        value == null
                            ? 'bg-minor-soft text-minor-contrast border-minor/30'
                            : 'bg-major-tint text-crmText-secondary border-crmBorder'
                    }`}
                >
                    {value == null ? 'Top level' : parentNameById.get(value) || `#${value}`}
                </span>
            ),
            width: '140px',
            align: 'center',
            sortable: true,
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
            render: (value: boolean, row: Module) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(row);
                    }}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border cursor-pointer hover:shadow-sm transition-all active:scale-95 ${
                        value
                            ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                            : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
                    }`}
                    title={value ? 'Click to Deactivate' : 'Click to Activate'}
                >
                    {value ? 'Active' : 'Inactive'}
                </button>
            ),
            width: '100px',
            align: 'center',
            sortable: true,
        },
        {
            key: 'id',
            title: 'Actions',
            render: (_: any, row: Module) => (
                <div className="flex items-center justify-end gap-2 pr-2">
                    <GlassButton
                        icon={<FiEye />}
                        color="blue"
                        title="View"
                        onClick={() =>
                            showModal({
                                title: 'Module Details',
                                content: <ModuleView moduleData={row} />,
                                type: 'success',
                                size: 'xl',
                            })
                        }
                    />
                    <GlassButton
                        icon={<FiEdit />}
                        color="green"
                        title="Edit"
                        onClick={() =>
                            showModal({
                                title: `Edit Module: ${row.name || row.code}`,
                                content: <ModuleForm moduleData={row} />,
                                type: 'custom',
                                size: 'lg',
                            })
                        }
                    />
                </div>
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
                        placeholder="Search modules..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                            className="flex items-center gap-1.5 px-4 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-minor/20 shadow-sm cursor-pointer border-none"
                            onClick={() =>
                                showModal({
                                    title: "Add Module",
                                    content: <ModuleForm />,
                                    type: 'custom',
                                    size: 'lg',
                                })
                            }
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            Add Module
                        </button>
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={moduleFilterConfig}
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
                    data={moduleList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchModules({ page: currentPage, page_size: pageSize }))}
                    emptyTitle="No modules found"
                    emptyDescription="There are no modules to display at the moment."
                    rowKey={(row: Module) => row.id ?? row.code ?? row.name ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onSort={handleSort}
                    className="rounded-none border-none shadow-none"
                    maxHeight="100%"
                />
            </div>
        </div>
    );
};

export const ModulesPage = ManageModules;
export default ManageModules;
