import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { FiEye, FiCheck, FiX, FiSlash } from 'react-icons/fi';
import DynamicServerTable from '../../components/components/Table/Table';
import GlassButton from '../../components/components/Button/Button';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchFollowUps, updateFollowUp } from '../../store/slices/followUpSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import LeadView from '../../components/components/View/LeadView';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { followUpFilterConfig } from '../../utils/filterConfiguration';
import type { FollowUp } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const SCOPES = [
    { value: 'today', label: 'Today' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'completed', label: 'Completed' },
    { value: 'all', label: 'All' },
];

const ManageFollowUps: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [scope, setScope] = useState('today');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states (names map 1:1 to GET /api/leads/follow-ups/ query params)
    const [filters, setFilters] = useState({
        status: '',
        counsellor: '',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const { data: followUps, loading, error, pagination, actionLoading } = useAppSelector(
        (state) => state.followUps
    );

    const total_results = pagination?.total_results;
    const current_page = pagination?.current_page;
    const page_size = pagination?.page_size;

    const [pageSize, setPageSize] = useState(page_size || 10);
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.status) count++;
        if (filters.counsellor) count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, startDate, endDate]);

    // Server-side query params built from scope, search, filters and date range
    const serverParams = useMemo(() => ({
        scope,
        search: debouncedSearchTerm || undefined,
        status: debouncedFilters.status || undefined,
        counsellor: debouncedFilters.counsellor || undefined,
        date_from: startDate || undefined,
        date_to: endDate || undefined,
    }), [scope, debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    // Sync with Redux current_page if it changes
    useEffect(() => {
        if (current_page && current_page !== currentPage) {
            setCurrentPage(current_page);
        }
    }, [current_page]);

    // Fetch follow-ups when currentPage or pageSize changes
    useEffect(() => {
        dispatch(fetchFollowUps({ page: currentPage, page_size: pageSize, ...serverParams }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, currentPage, pageSize]);

    const followUpList = useMemo(() => followUps || [], [followUps]);
    const totalCount = total_results ?? followUpList.length;

    // Refetch from page 1 when scope, search, filters or date range change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            dispatch(fetchFollowUps({ page: 1, page_size: pageSize, ...serverParams }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverParams]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ status: '', counsellor: '' });
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
    };

    const handleStatusChange = (row: FollowUp, status: string) => {
        if (actionLoading) return;
        dispatch(updateFollowUp({ id: row.id!, payload: { status } }))
            .unwrap()
            .then(() => {
                toast.success(`Follow-up marked ${status.toLowerCase()}`);
                dispatch(fetchFollowUps({ page: currentPage, page_size: pageSize, ...serverParams }));
            })
            .catch((err: any) => toast.error(err?.message || err || 'Failed to update follow-up'));
    };

    const openLead = (row: FollowUp) => {
        if (!row.lead?.uid) return;
        showModal({
            title: 'Lead Details',
            content: <LeadView leadData={row.lead} />,
            type: 'success',
            size: 'xl',
        });
    };

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'lead',
            title: 'Student',
            render: (_: any, row: FollowUp) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.lead?.full_name || '-'}</span>
                    <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">
                        {row.lead?.application_id || row.lead?.uid || '-'}
                    </span>
                </div>
            ),
            width: '200px',
        },
        {
            key: 'follow_up_date',
            title: 'Date',
            render: (value: string, row: FollowUp) => (
                <span className={`text-xs font-semibold whitespace-nowrap ${row.is_overdue ? 'text-crmDanger' : 'text-crmText'}`}>
                    {value ? moment(value).format('MMM DD, YYYY') : '-'}
                </span>
            ),
            width: '120px',
        },
        {
            key: 'follow_up_time',
            title: 'Time',
            render: (value: string) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            width: '90px',
        },
        {
            key: 'notes',
            title: 'Notes',
            render: (value: string) => (
                <span className="text-xs text-crmText-secondary line-clamp-2">
                    {value || <span className="italic text-crmText-tertiary">No notes</span>}
                </span>
            ),
            width: '220px',
        },
        {
            key: 'counsellor',
            title: 'Counsellor',
            render: (_: any, row: FollowUp) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">
                    {row.counsellor?.name || row.counsellor?.email || '-'}
                </span>
            ),
            width: '140px',
        },
        {
            key: 'status',
            title: 'Status',
            render: (value: string, row: FollowUp) => (
                <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                        row.is_overdue && value === 'PENDING'
                            ? 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
                            : value === 'COMPLETED'
                                ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                                : value === 'MISSED' || value === 'CANCELLED'
                                    ? 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
                                    : 'bg-major-tint text-crmText-secondary border-crmBorder'
                    }`}
                >
                    {row.is_overdue && value === 'PENDING' ? 'OVERDUE' : value || '-'}
                </span>
            ),
            width: '120px',
            align: 'center',
        },
        {
            key: 'id',
            title: 'Action',
            render: (_: any, row: FollowUp) => (
                <div className="flex items-center justify-end gap-1.5">
                    <GlassButton onClick={() => openLead(row)} icon={<FiEye size={13} />} color="blue" title="Open lead" />
                    {row.status === 'PENDING' && (
                        <>
                            <GlassButton onClick={() => handleStatusChange(row, 'COMPLETED')} icon={<FiCheck size={13} />} color="green" title="Mark completed" />
                            <GlassButton onClick={() => handleStatusChange(row, 'MISSED')} icon={<FiX size={13} />} color="red" title="Mark missed" />
                            <GlassButton onClick={() => handleStatusChange(row, 'CANCELLED')} icon={<FiSlash size={13} />} color="gray" title="Cancel" />
                        </>
                    )}
                </div>
            ),
            width: '150px',
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
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border ${showFilter || activeFilterCount > 0
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
                        placeholder="Search follow-ups..."
                        className="mx-4"
                    />

                    {/* Scope tabs */}
                    <div className="flex items-center gap-1 rounded-xl border border-crmBorder bg-major p-1 shrink-0">
                        {SCOPES.map((s) => (
                            <button
                                key={s.value}
                                type="button"
                                onClick={() => setScope(s.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                                    scope === s.value
                                        ? 'bg-minor text-white shadow-crm-sm'
                                        : 'bg-transparent text-crmText-secondary hover:bg-major-muted'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={followUpFilterConfig}
                    values={filters}
                    onChange={handleFilterChange}
                    onClear={clearFilters}
                    onClose={() => setShowFilter(false)}
                />
            </div>

            {/* Main Table Content */}
            <div className="flex flex-col bg-major rounded-2xl shadow-crm-card overflow-hidden border border-crmBorder w-full max-w-full min-w-0">
                <DynamicServerTable
                    data={followUpList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchFollowUps({ page: currentPage, page_size: pageSize, ...serverParams }))}
                    emptyTitle="No follow-ups found"
                    emptyDescription="There are no follow-ups in this view."
                    rowKey={(row: FollowUp) => row.id ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                    onRowClick={(row: FollowUp) => openLead(row)}
                    className="rounded-none border-none shadow-none"
                    maxHeight="100%"
                />
            </div>
        </div>
    );
};

export const FollowUpsPage = ManageFollowUps;
export default ManageFollowUps;
