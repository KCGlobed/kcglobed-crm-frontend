import React, { useState, useEffect, useMemo } from 'react';
import {
    Filter,
    Plus,
    ChevronDown,
    Settings,
    Eye,
    MessageSquare,
    UserCog,
    HelpCircle,
    Clock,
    Upload,
    Download,
    RefreshCw,
} from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchLeads } from '../../store/slices/leadSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import LeadForm from '../../components/components/Forms/LeadForm';
import LeadCommunicateForm from '../../components/components/Forms/LeadCommunicateForm';
import LeadReassignForm from '../../components/components/Forms/LeadReassignForm';
import LeadStageForm from '../../components/components/Forms/LeadStageForm';
import LeadBulkUploadForm from '../../components/components/Forms/LeadBulkUploadForm';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import LeadView from '../../components/components/View/LeadView';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { leadFilterConfig } from '../../utils/filterConfiguration';
import type { Lead } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const STAGE_CLASSES: Record<string, string> = {
    Untouched: 'bg-crmDanger-bg text-crmDanger border-crmDanger-border',
    Contacted: 'bg-crmInfo-bg text-crmInfo border-crmInfo-border',
    'Follow-up': 'bg-secondary-soft text-secondary-contrast border-secondary/30',
    Interested: 'bg-minor-soft text-minor-contrast border-minor/30',
    Application: 'bg-primary-soft text-primary-contrast border-primary/30',
    Enrolled: 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border',
    Closed: 'bg-major-tint text-crmText-secondary border-crmBorder',
};

const campaignOf = (row: Lead) =>
    [row.source, row.medium, row.campaign].filter(Boolean).join('/');

const LeadThumbnail = ({ row }: { row: Lead }) => {
    return (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border border-primary/30 bg-primary-soft text-primary-contrast">
            <span>{row.name ? row.name.charAt(0).toUpperCase() : 'L'}</span>
        </div>
    );
};

const ActionMenu = ({ row }: { row: Lead }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const { showModal } = useModal();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const closeAndDo = (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(false);
        action();
    };

    return (
        <div className="relative flex justify-center" ref={dropdownRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="p-1.5 text-crmText-secondary hover:text-minor hover:bg-minor-soft rounded-lg transition-colors cursor-pointer"
            >
                <Settings size={18} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-major rounded-xl shadow-lg border border-crmBorder py-1.5 z-[99] overflow-hidden">
                    <button
                        onClick={closeAndDo(() => showModal({ title: `Communicate: ${row.name}`, content: <LeadCommunicateForm leadData={row} />, type: 'custom', size: 'md' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <MessageSquare size={14} /> Communicate
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Lead Details', content: <LeadView leadData={row} />, type: 'success', size: 'xl' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <Eye size={14} /> View Application
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: `Re-assign Lead: ${row.name}`, content: <LeadReassignForm leadData={row} />, type: 'custom', size: 'md' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <UserCog size={14} /> Re-assign Lead
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Lead Details', content: <LeadView leadData={row} initialTab="queries" />, type: 'success', size: 'xl' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <HelpCircle size={14} /> View Queries
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Lead Details', content: <LeadView leadData={row} initialTab="activity" />, type: 'success', size: 'xl' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <Clock size={14} /> View Activity
                    </button>
                </div>
            )}
        </div>
    );
};

const HeaderActionMenu = ({ filteredData }: { filteredData: Lead[] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const { showModal } = useModal();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const closeAndDo = (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsOpen(false);
        action();
    };

    const handleDownloadLeads = () => {
        if (filteredData.length === 0) {
            toast.error('No leads to download');
            return;
        }
        const headers = ['Name', 'Email', 'Mobile', 'Campaign', 'Stage', 'Course', 'City', 'State', 'Assigned To', 'Registered On'];
        const csv = [
            headers.join(','),
            ...filteredData.map((l) =>
                [
                    l.name,
                    l.email,
                    l.mobile,
                    campaignOf(l),
                    l.lead_stage,
                    l.course,
                    l.city,
                    l.state,
                    l.assigned_to,
                    l.created_at ? moment(l.created_at).format('YYYY-MM-DD HH:mm') : '',
                ]
                    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                    .join(',')
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `leads_${moment().format('YYYYMMDD_HHmmss')}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`${filteredData.length} leads downloaded`);
    };

    const bulkIds = filteredData.map((l) => l.id).filter((id): id is number => id != null);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-minor/20 shadow-sm cursor-pointer border-none"
            >
                Action
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-major rounded-xl shadow-lg border border-crmBorder py-1.5 z-[99] overflow-hidden">
                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Bulk Offline Upload', content: <LeadBulkUploadForm />, type: 'custom', size: 'md' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <Upload size={14} /> Bulk Offline Upload
                    </button>

                    <button
                        onClick={closeAndDo(handleDownloadLeads)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <Download size={14} /> Download Leads
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Communicate', content: <LeadCommunicateForm bulkCount={filteredData.length} />, type: 'custom', size: 'md' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <MessageSquare size={14} /> Communicate
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Change Lead Stage', content: <LeadStageForm bulkIds={bulkIds} />, type: 'custom', size: 'md' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <RefreshCw size={14} /> Change Lead Stage
                    </button>
                </div>
            )}
        </div>
    );
};

const ManageLeads: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [ordering, setOrdering] = useState<string>('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states
    const [filters, setFilters] = useState({
        name: '',
        email: '',
        mobile: '',
        lead_stage: '',
        source: '',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const { data: leads, loading, error } = useAppSelector((state) => state.leads);

    const [pageSize, setPageSize] = useState(10);
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.name) count++;
        if (filters.email) count++;
        if (filters.mobile) count++;
        if (filters.lead_stage) count++;
        if (filters.source) count++;
        if (ordering) count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, ordering, startDate, endDate]);

    useEffect(() => {
        dispatch(fetchLeads());
    }, [dispatch]);

    // Client-side filtering: search -> filters -> date range -> ordering
    const filteredData = useMemo(() => {
        let result = [...(leads || [])];

        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            result = result.filter(
                (l) =>
                    (l.name || '').toLowerCase().includes(term) ||
                    (l.email || '').toLowerCase().includes(term) ||
                    (l.mobile || '').toLowerCase().includes(term) ||
                    campaignOf(l).toLowerCase().includes(term)
            );
        }

        if (debouncedFilters.name) {
            result = result.filter((l) =>
                (l.name || '').toLowerCase().includes(debouncedFilters.name.toLowerCase())
            );
        }
        if (debouncedFilters.email) {
            result = result.filter((l) =>
                (l.email || '').toLowerCase().includes(debouncedFilters.email.toLowerCase())
            );
        }
        if (debouncedFilters.mobile) {
            result = result.filter((l) =>
                (l.mobile || '').toLowerCase().includes(debouncedFilters.mobile.toLowerCase())
            );
        }
        if (debouncedFilters.lead_stage) {
            result = result.filter((l) => l.lead_stage === debouncedFilters.lead_stage);
        }
        if (debouncedFilters.source) {
            result = result.filter((l) => l.source === debouncedFilters.source);
        }

        if (startDate) {
            result = result.filter(
                (l) => l.created_at && moment(l.created_at).isSameOrAfter(moment(startDate), 'day')
            );
        }
        if (endDate) {
            result = result.filter(
                (l) => l.created_at && moment(l.created_at).isSameOrBefore(moment(endDate), 'day')
            );
        }

        if (ordering) {
            const key = ordering.replace(/^-/, '') as keyof Lead;
            const direction = ordering.startsWith('-') ? -1 : 1;
            result.sort((a, b) => {
                const aVal = a[key];
                const bVal = b[key];
                if (key === 'created_at' || key === 'updated_at') {
                    return (moment(aVal as string).valueOf() - moment(bVal as string).valueOf()) * direction;
                }
                return String(aVal ?? '').localeCompare(String(bVal ?? '')) * direction;
            });
        }

        return result;
    }, [leads, debouncedSearchTerm, debouncedFilters, startDate, endDate, ordering]);

    const totalCount = filteredData.length;

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage, pageSize]);

    // Reset to first page when search or filters change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        setCurrentPage(1);
    }, [debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            name: '',
            email: '',
            mobile: '',
            lead_stage: '',
            source: '',
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

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'name',
            title: 'Registered Name',
            render: (_: any, row: Lead) => (
                <div className="flex items-center gap-3">
                    <LeadThumbnail row={row} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.name}</span>
                        <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">{row.course || '-'}</span>
                    </div>
                </div>
            ),
            sortable: true,
            width: '220px',
        },
        {
            key: 'email',
            title: 'Registered Email',
            render: (value: string) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            sortable: true,
            width: '220px',
        },
        {
            key: 'mobile',
            title: 'Registered Mobile',
            render: (value: string) => (
                <span className="text-xs font-semibold text-crmText whitespace-nowrap">{value || '-'}</span>
            ),
            sortable: true,
            width: '150px',
        },
        {
            key: 'source',
            title: 'Primary Registration Campaign',
            render: (_: any, row: Lead) => (
                <span className="text-[11px] font-mono text-crmText-secondary whitespace-nowrap">
                    {campaignOf(row) || '-'}
                </span>
            ),
            sortable: true,
            width: '220px',
        },
        {
            key: 'lead_stage',
            title: 'Lead Stage',
            render: (value: string) => (
                <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${STAGE_CLASSES[value] || 'bg-major-tint text-crmText-secondary border-crmBorder'}`}
                >
                    {value || 'Untouched'}
                </span>
            ),
            width: '130px',
            align: 'center',
            sortable: true,
        },
        {
            key: 'created_at',
            title: 'Registered On',
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
            title: 'Action',
            render: (_: any, row: Lead) => (
                <ActionMenu row={row} />
            ),
            width: '100px',
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
                        placeholder="Search leads..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <HeaderActionMenu filteredData={filteredData} />
                        <button
                            className="flex items-center gap-1.5 px-4 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-minor/20 shadow-sm cursor-pointer border-none"
                            onClick={() =>
                                showModal({
                                    title: "Add Quick Lead",
                                    content: <LeadForm />,
                                    type: 'custom',
                                    size: 'lg',
                                })
                            }
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            Add Quick Lead
                        </button>
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={leadFilterConfig}
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
                    data={paginatedData}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchLeads())}
                    emptyTitle="No leads found"
                    emptyDescription="There are no leads to display at the moment."
                    rowKey={(row: Lead) => row.id ?? row.email ?? row.name ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1); // Reset to first page when size changes
                    }}
                    onRowClick={(row) =>
                        showModal({
                            title: 'Lead Details',
                            content: <LeadView leadData={row} />,
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

export const LeadsPage = ManageLeads;
export default ManageLeads;
