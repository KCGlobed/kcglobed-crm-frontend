import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { FiEye, FiCheck, FiX, FiAward } from 'react-icons/fi';
import DynamicServerTable from '../../components/components/Table/Table';
import GlassButton from '../../components/components/Button/Button';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchInterviews, updateInterviewStatus } from '../../store/slices/interviewSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import LeadView from '../../components/components/View/LeadView';
import InterviewResultForm from '../../components/components/Forms/InterviewResultForm';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { interviewFilterConfig } from '../../utils/filterConfiguration';
import type { Interview } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const statusBadgeClass = (status?: string) => {
    switch ((status || '').toUpperCase()) {
        case 'COMPLETED':
        case 'SELECTED':
            return 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border';
        case 'CANCELLED':
        case 'NO_SHOW':
        case 'NOT_SELECTED':
            return 'bg-crmDanger-bg text-crmDanger border-crmDanger-border';
        default:
            return 'bg-major-tint text-crmText-secondary border-crmBorder';
    }
};

const ManageInterviews: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states (names map 1:1 to GET /api/interviews/ query params)
    const [filters, setFilters] = useState({
        status: '',
        result: '',
        counsellor: '',
        interviewer: '',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const { data: interviews, loading, error, pagination, actionLoading } = useAppSelector(
        (state) => state.interviews
    );

    const total_results = pagination?.total_results;
    const current_page = pagination?.current_page;
    const page_size = pagination?.page_size;

    const [pageSize, setPageSize] = useState(page_size || 10);
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.status) count++;
        if (filters.result) count++;
        if (filters.counsellor) count++;
        if (filters.interviewer) count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, startDate, endDate]);

    // Server-side query params built from search, filters and date range
    const serverParams = useMemo(() => ({
        search: debouncedSearchTerm || undefined,
        status: debouncedFilters.status || undefined,
        result: debouncedFilters.result || undefined,
        counsellor: debouncedFilters.counsellor || undefined,
        interviewer: debouncedFilters.interviewer || undefined,
        date_from: startDate || undefined,
        date_to: endDate || undefined,
    }), [debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    // Sync with Redux current_page if it changes
    useEffect(() => {
        if (current_page && current_page !== currentPage) {
            setCurrentPage(current_page);
        }
    }, [current_page]);

    // Fetch interviews when currentPage or pageSize changes
    useEffect(() => {
        dispatch(fetchInterviews({ page: currentPage, page_size: pageSize, ...serverParams }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, currentPage, pageSize]);

    const interviewList = useMemo(() => interviews || [], [interviews]);
    const totalCount = total_results ?? interviewList.length;

    // Refetch from page 1 when search, filters or date range change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            dispatch(fetchInterviews({ page: 1, page_size: pageSize, ...serverParams }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverParams]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ status: '', result: '', counsellor: '', interviewer: '' });
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
    };

    const handleStatusChange = (row: Interview, status: string) => {
        if (actionLoading) return;
        dispatch(updateInterviewStatus({ id: row.id!, payload: { status } }))
            .unwrap()
            .then(() => {
                toast.success(`Interview marked ${status.toLowerCase().replace('_', ' ')}`);
                dispatch(fetchInterviews({ page: currentPage, page_size: pageSize, ...serverParams }));
            })
            .catch((err: any) => toast.error(err?.message || err || 'Failed to update interview'));
    };

    const openLead = (row: Interview) => {
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
            render: (_: any, row: Interview) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-crmText text-sm whitespace-nowrap">
                        {row.lead?.full_name || row.full_name || '-'}
                    </span>
                    <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">
                        {row.lead?.application_id || row.application_id || '-'}
                    </span>
                </div>
            ),
            width: '200px',
        },
        {
            key: 'scheduled_date',
            title: 'Date',
            render: (value: string) => (
                <span className="text-xs font-semibold text-crmText whitespace-nowrap">
                    {value ? moment(value).format('MMM DD, YYYY') : '-'}
                </span>
            ),
            width: '120px',
        },
        {
            key: 'start_time',
            title: 'Time',
            render: (_: any, row: Interview) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">
                    {row.start_time || '-'}{row.end_time ? ` – ${row.end_time}` : ''}
                </span>
            ),
            width: '130px',
        },
        {
            key: 'mode',
            title: 'Mode',
            render: (value: string) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap capitalize">
                    {(value || '-').replace('_', ' ')}
                </span>
            ),
            width: '100px',
        },
        {
            key: 'counsellor',
            title: 'Counsellor',
            render: (_: any, row: Interview) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">
                    {row.counsellor?.name || '-'}
                </span>
            ),
            width: '140px',
        },
        {
            key: 'interviewer',
            title: 'Interviewer',
            render: (_: any, row: Interview) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">
                    {row.interviewer?.name || '-'}
                </span>
            ),
            width: '140px',
        },
        {
            key: 'status',
            title: 'Status',
            render: (value: string) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(value)}`}>
                    {(value || '-').replace('_', ' ')}
                </span>
            ),
            width: '120px',
            align: 'center',
        },
        {
            key: 'result',
            title: 'Result',
            render: (value: string) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(value)}`}>
                    {(value || 'PENDING').replace('_', ' ')}
                </span>
            ),
            width: '120px',
            align: 'center',
        },
        {
            key: 'id',
            title: 'Action',
            render: (_: any, row: Interview) => (
                <div className="flex items-center justify-end gap-1.5">
                    <GlassButton onClick={() => openLead(row)} icon={<FiEye size={13} />} color="blue" title="Open lead" />
                    {row.status === 'SCHEDULED' && (
                        <>
                            <GlassButton onClick={() => handleStatusChange(row, 'COMPLETED')} icon={<FiCheck size={13} />} color="green" title="Mark completed" />
                            <GlassButton onClick={() => handleStatusChange(row, 'CANCELLED')} icon={<FiX size={13} />} color="red" title="Cancel" />
                        </>
                    )}
                    {(row.status === 'COMPLETED' || row.status === 'SCHEDULED') && (!row.result || row.result === 'PENDING') && (
                        <GlassButton
                            onClick={() =>
                                showModal({
                                    title: `Interview Result: ${row.lead?.full_name || row.full_name || ''}`,
                                    content: <InterviewResultForm interviewData={row} leadUid={row.lead?.uid} />,
                                    type: 'custom',
                                    size: 'md',
                                })
                            }
                            icon={<FiAward size={13} />}
                            color="green"
                            title="Record result"
                        />
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
                        placeholder="Search interviews..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap" />
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={interviewFilterConfig}
                    values={filters}
                    onChange={handleFilterChange}
                    onClear={clearFilters}
                    onClose={() => setShowFilter(false)}
                />
            </div>

            {/* Main Table Content */}
            <div className="flex flex-col bg-major rounded-2xl shadow-crm-card overflow-hidden border border-crmBorder w-full max-w-full min-w-0">
                <DynamicServerTable
                    data={interviewList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchInterviews({ page: currentPage, page_size: pageSize, ...serverParams }))}
                    emptyTitle="No interviews found"
                    emptyDescription="There are no interviews to display at the moment."
                    rowKey={(row: Interview) => row.id ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                    onRowClick={(row: Interview) => openLead(row)}
                    className="rounded-none border-none shadow-none"
                    maxHeight="100%"
                />
            </div>
        </div>
    );
};

export const InterviewsPage = ManageInterviews;
export default ManageInterviews;
