import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown, Eye } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchAuditLogs } from '../../store/slices/auditLogSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import AuditLogView from '../../components/components/View/AuditLogView';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { auditLogFilterConfig } from '../../utils/filterConfiguration';
import type { AuditLog } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const ACTION_BADGE_CLASSES: Record<string, string> = {
    create: 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border',
    update: 'bg-crmInfo-bg text-crmInfo border-crmInfo-border',
    delete: 'bg-crmDanger-bg text-crmDanger border-crmDanger-border',
    login: 'bg-minor-soft text-minor-contrast border-minor/30',
    logout: 'bg-major-tint text-crmText-secondary border-crmBorder',
};

const ManageAuditLogs: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [ordering, setOrdering] = useState<string>('-created_at');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states
    const [filters, setFilters] = useState({
        user: '',
        action: '',
        module: '',
        success: 'all' as 'all' | 'true' | 'false',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const {
        data: auditLogs,
        loading,
        error,
        pagination,
    } = useAppSelector((state) => state.auditLogs);

    const total_results = pagination?.total_results;
    const current_page = pagination?.current_page;
    const page_size = pagination?.page_size;

    const [pageSize, setPageSize] = useState(page_size || 10);
    const isMounted = React.useRef(false);

    // Every filter here is a real GET /access/audit-logs/ query param
    const serverFilters = useMemo(() => ({
        search: debouncedSearchTerm || undefined,
        user: debouncedFilters.user || undefined,
        action: debouncedFilters.action || undefined,
        module: debouncedFilters.module || undefined,
        success: debouncedFilters.success !== 'all' ? debouncedFilters.success : undefined,
        date_from: startDate ? moment(startDate).format('YYYY-MM-DD') : undefined,
        date_to: endDate ? moment(endDate).format('YYYY-MM-DD') : undefined,
        ordering: ordering || undefined,
    }), [debouncedSearchTerm, debouncedFilters, startDate, endDate, ordering]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.user) count++;
        if (filters.action) count++;
        if (filters.module) count++;
        if (filters.success && filters.success !== 'all') count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, startDate, endDate]);

    // Sync with Redux current_page if it changes
    useEffect(() => {
        if (current_page && current_page !== currentPage) {
            setCurrentPage(current_page);
        }
    }, [current_page]);

    // Fetch audit logs when the page or any server filter changes
    useEffect(() => {
        dispatch(fetchAuditLogs({ page: currentPage, page_size: pageSize, ...serverFilters }));
    }, [dispatch, currentPage, pageSize, serverFilters]);

    const auditLogList = useMemo(() => auditLogs || [], [auditLogs]);
    const totalCount = total_results ?? auditLogList.length;

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
            user: '',
            action: '',
            module: '',
            success: 'all',
        });
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
        setOrdering('-created_at');
    };

    const handleSort = (key: string, direction: 'asc' | 'desc') => {
        const orderPrefix = direction === 'desc' ? '-' : '';
        setOrdering(`${orderPrefix}${key}`);
    };

    const handleDirectionSort = (direction: 'asc' | 'desc') => {
        const currentKey = ordering.replace(/^-/, '') || 'created_at';
        handleSort(currentKey, direction);
    };

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'actor',
            title: 'Actor',
            render: (_: any, row: AuditLog) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.actor?.name || '-'}</span>
                    <span className="text-[11px] text-crmText-tertiary whitespace-nowrap">{row.actor_email || row.actor?.email || '-'}</span>
                </div>
            ),
            sortable: true,
            width: '200px',
        },
        {
            key: 'action',
            title: 'Action',
            render: (_: any, row: AuditLog) => (
                <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                        ACTION_BADGE_CLASSES[row.action || ''] || 'bg-major-tint text-crmText-secondary border-crmBorder'
                    }`}
                >
                    {row.action_display || row.action || '-'}
                </span>
            ),
            sortable: true,
            width: '130px',
            align: 'center',
        },
        {
            key: 'module',
            title: 'Module',
            render: (value: string) => (
                <span className="text-[11px] font-mono text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            width: '120px',
        },
        {
            key: 'object_repr',
            title: 'Object',
            render: (_: any, row: AuditLog) => (
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-crmText whitespace-nowrap">{row.object_repr || '-'}</span>
                    <span className="text-[10px] text-crmText-tertiary whitespace-nowrap">{row.object_type || ''}</span>
                </div>
            ),
            width: '200px',
        },
        {
            key: 'success',
            title: 'Result',
            render: (value: boolean) => (
                <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        value
                            ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                            : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
                    }`}
                >
                    {value ? 'Success' : 'Failure'}
                </span>
            ),
            width: '100px',
            align: 'center',
        },
        {
            key: 'ip_address',
            title: 'IP Address',
            render: (value: string) => (
                <span className="text-[11px] font-mono text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            width: '120px',
        },
        {
            key: 'created_at',
            title: 'Timestamp',
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
            key: 'id',
            title: 'Actions',
            render: (_: any, row: AuditLog) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        showModal({ title: 'Audit Log Details', content: <AuditLogView auditLogData={row} />, type: 'success', size: 'xl' });
                    }}
                    className="p-1.5 text-crmText-secondary hover:text-minor hover:bg-minor-soft rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                    title="View details"
                >
                    <Eye size={16} />
                </button>
            ),
            width: '80px',
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
                        placeholder="Search by actor, object, message..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <span className="text-xs font-semibold text-crmText-secondary mr-1">
                            Total: {totalCount} entries
                        </span>
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={auditLogFilterConfig}
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
                    data={auditLogList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchAuditLogs({ page: currentPage, page_size: pageSize, ...serverFilters }))}
                    emptyTitle="No audit logs found"
                    emptyDescription="There are no audit entries matching the current filters."
                    rowKey={(row: AuditLog) => row.id ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1); // Reset to first page when size changes
                    }}
                    onRowClick={(row) =>
                        showModal({
                            title: 'Audit Log Details',
                            content: <AuditLogView auditLogData={row} />,
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

export const AuditLogsPage = ManageAuditLogs;
export default ManageAuditLogs;
