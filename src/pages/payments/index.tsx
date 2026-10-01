import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { FiEye, FiCheckCircle, FiDownload } from 'react-icons/fi';
import DynamicServerTable from '../../components/components/Table/Table';
import GlassButton from '../../components/components/Button/Button';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchPayments } from '../../store/slices/paymentSlice';
import { fetchPaymentProofApi } from '../../services/apiServices';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import LeadView from '../../components/components/View/LeadView';
import PaymentVerifyForm from '../../components/components/Forms/PaymentVerifyForm';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { paymentFilterConfig } from '../../utils/filterConfiguration';
import type { Payment } from '../../utils/types';

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
        case 'SUCCESS':
        case 'VERIFIED':
            return 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border';
        case 'FAILED':
        case 'REJECTED':
            return 'bg-crmDanger-bg text-crmDanger border-crmDanger-border';
        default:
            return 'bg-major-tint text-crmText-secondary border-crmBorder';
    }
};

const ManagePayments: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states (names map 1:1 to GET /api/payments/ query params)
    const [filters, setFilters] = useState({
        status: '',
        method: '',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const { data: payments, loading, error, pagination } = useAppSelector((state) => state.payments);

    const total_results = pagination?.total_results;
    const current_page = pagination?.current_page;
    const page_size = pagination?.page_size;

    const [pageSize, setPageSize] = useState(page_size || 10);
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.status) count++;
        if (filters.method) count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, startDate, endDate]);

    // Server-side query params built from search, filters and date range
    const serverParams = useMemo(() => ({
        search: debouncedSearchTerm || undefined,
        status: debouncedFilters.status || undefined,
        method: debouncedFilters.method || undefined,
        date_from: startDate || undefined,
        date_to: endDate || undefined,
    }), [debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    // Sync with Redux current_page if it changes
    useEffect(() => {
        if (current_page && current_page !== currentPage) {
            setCurrentPage(current_page);
        }
    }, [current_page]);

    // Fetch payments when currentPage or pageSize changes
    useEffect(() => {
        dispatch(fetchPayments({ page: currentPage, page_size: pageSize, ...serverParams }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, currentPage, pageSize]);

    const paymentList = useMemo(() => payments || [], [payments]);
    const totalCount = total_results ?? paymentList.length;

    // Refetch from page 1 when search, filters or date range change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            dispatch(fetchPayments({ page: 1, page_size: pageSize, ...serverParams }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverParams]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ status: '', method: '' });
        setSearchTerm('');
        setStartDate('');
        setEndDate('');
    };

    const openLead = (row: Payment) => {
        if (!row.lead?.uid) return;
        showModal({
            title: 'Lead Details',
            content: <LeadView leadData={row.lead} />,
            type: 'success',
            size: 'xl',
        });
    };

    const handleDownloadProof = async (row: Payment) => {
        if (!row.uid) return;
        try {
            const response = await fetchPaymentProofApi(row.uid);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `payment-proof-${row.uid}`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to download proof');
        }
    };

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'lead',
            title: 'Student',
            render: (_: any, row: Payment) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.lead?.full_name || '-'}</span>
                    <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">
                        {row.lead?.application_id || '-'}
                    </span>
                </div>
            ),
            width: '200px',
        },
        {
            key: 'amount',
            title: 'Amount',
            render: (value: any, row: Payment) => (
                <span className="text-xs font-bold text-crmText whitespace-nowrap">
                    {row.currency || 'INR'} {value ?? '-'}
                </span>
            ),
            width: '110px',
        },
        {
            key: 'method',
            title: 'Method',
            render: (value: string, row: Payment) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">
                    {value || '-'}{row.payment_mode ? ` (${String(row.payment_mode).toUpperCase()})` : ''}
                </span>
            ),
            width: '130px',
        },
        {
            key: 'status',
            title: 'Status',
            render: (value: string) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(value)}`}>
                    {(value || '-').replace(/_/g, ' ')}
                </span>
            ),
            width: '140px',
            align: 'center',
        },
        {
            key: 'transaction_id',
            title: 'Transaction ID',
            render: (value: string, row: Payment) => (
                <span className="text-[11px] font-mono text-crmText-secondary whitespace-nowrap max-w-[160px] truncate inline-block" title={value || row.gateway_order_id || ''}>
                    {value || row.gateway_order_id || '-'}
                </span>
            ),
            width: '160px',
        },
        {
            key: 'payment_date',
            title: 'Payment Date',
            render: (value: string, row: Payment) => {
                const date = value || row.paid_at;
                return (
                    <span className="text-xs text-crmText-secondary whitespace-nowrap">
                        {date ? moment(date).format('MMM DD, YYYY') : '-'}
                    </span>
                );
            },
            width: '120px',
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
            width: '130px',
        },
        {
            key: 'uid',
            title: 'Action',
            render: (_: any, row: Payment) => (
                <div className="flex items-center justify-end gap-1.5">
                    <GlassButton onClick={() => openLead(row)} icon={<FiEye size={13} />} color="blue" title="Open lead" />
                    {row.proof_url && (
                        <GlassButton onClick={() => handleDownloadProof(row)} icon={<FiDownload size={13} />} color="gray" title="Download proof" />
                    )}
                    {row.status === 'OFFLINE_PENDING' && (
                        <GlassButton
                            onClick={() =>
                                showModal({
                                    title: 'Verify Offline Payment',
                                    content: <PaymentVerifyForm paymentData={row} />,
                                    type: 'custom',
                                    size: 'md',
                                })
                            }
                            icon={<FiCheckCircle size={13} />}
                            color="green"
                            title="Verify / Reject"
                        />
                    )}
                </div>
            ),
            width: '130px',
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
                        placeholder="Search payments..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap" />
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={paymentFilterConfig}
                    values={filters}
                    onChange={handleFilterChange}
                    onClear={clearFilters}
                    onClose={() => setShowFilter(false)}
                />
            </div>

            {/* Main Table Content */}
            <div className="flex flex-col bg-major rounded-2xl shadow-crm-card overflow-hidden border border-crmBorder w-full max-w-full min-w-0">
                <DynamicServerTable
                    data={paymentList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchPayments({ page: currentPage, page_size: pageSize, ...serverParams }))}
                    emptyTitle="No payments found"
                    emptyDescription="There are no payments to display at the moment."
                    rowKey={(row: Payment) => row.uid ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                    onRowClick={(row: Payment) => openLead(row)}
                    className="rounded-none border-none shadow-none"
                    maxHeight="100%"
                />
            </div>
        </div>
    );
};

export const PaymentsPage = ManagePayments;
export default ManagePayments;
