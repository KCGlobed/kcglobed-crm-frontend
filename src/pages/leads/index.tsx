import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Filter,
    Plus,
    ChevronDown,
    Settings,
    Eye,
    MessageSquare,
    UserCog,
    Clock,
    Upload,
    Download,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchLeads, deleteLead } from '../../store/slices/leadSlice';
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
import DeleteConfirmationModal from '../../components/components/Modal/DeleteModal';
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

const LeadThumbnail = ({ row }: { row: Lead }) => {
    return (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border border-primary/30 bg-primary-soft text-primary-contrast">
            <span>{row.full_name ? row.full_name.charAt(0).toUpperCase() : 'L'}</span>
        </div>
    );
};

const ActionMenu = ({ row }: { row: Lead }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const { showModal } = useModal();
    const dispatch = useAppDispatch();
    // Stage override (PATCH /leads/{uid}/stage/) is Super Admin only
    const fullAccess = useAppSelector((state) => state.auth.access?.full_access) === true;

    // Rendered in a portal so the table's overflow/scroll containers can't clip it
    const MENU_WIDTH = 176; // matches w-44
    const EST_MENU_HEIGHT = 300;

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
                <Settings size={18} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={menuStyle}
                    className="fixed w-44 bg-major rounded-xl shadow-lg border border-crmBorder py-1.5 z-[999] overflow-hidden"
                >
                    <button
                        onClick={closeAndDo(() => showModal({ title: `Communicate: ${row.full_name}`, content: <LeadCommunicateForm leadData={row} />, type: 'custom', size: 'md' }))}
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

                    {fullAccess && (
                        <button
                            onClick={closeAndDo(() => showModal({ title: `Change Lead Stage: ${row.full_name}`, content: <LeadStageForm leadData={row} />, type: 'custom', size: 'md' }))}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                        >
                            <RefreshCw size={14} /> Change Stage
                        </button>
                    )}

                    <button
                        onClick={closeAndDo(() => showModal({ title: `Re-assign Lead: ${row.full_name}`, content: <LeadReassignForm leadData={row} />, type: 'custom', size: 'md' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <UserCog size={14} /> Re-assign Lead
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Lead Details', content: <LeadView leadData={row} initialTab="timeline" />, type: 'success', size: 'xl' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <Clock size={14} /> View Activity
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({
                            title: 'Delete Lead',
                            content: (
                                <DeleteConfirmationModal
                                    id={row.uid!}
                                    name={row.full_name || 'this lead'}
                                    onDelete={async (id) => {
                                        await dispatch(deleteLead(id as string)).unwrap();
                                    }}
                                />
                            ),
                            type: 'custom',
                            size: 'md'
                        }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors text-left border-t border-crmBorder mt-1 pt-2"
                    >
                        <Trash2 size={14} /> Delete Lead
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

const HeaderActionMenu = ({ leadList }: { leadList: Lead[] }) => {
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
        if (leadList.length === 0) {
            toast.error('No leads to download');
            return;
        }
        const headers = ['UID', 'Name', 'First Name', 'Last Name', 'Email', 'Phone', 'City', 'Source', 'UTM Source', 'UTM Campaign', 'Stage', 'Assigned To', 'Registered On', 'Updated On'];
        const csv = [
            headers.join(','),
            ...leadList.map((l) =>
                [
                    l.uid,
                    l.full_name,
                    l.first_name,
                    l.last_name,
                    l.email,
                    l.phone,
                    l.city,
                    l.source,
                    l.utm_source,
                    l.utm_campaign,
                    l.stage?.name,
                    l.assigned_to?.name || l.assigned_to?.email,
                    l.created_at ? moment(l.created_at).format('YYYY-MM-DD HH:mm') : '',
                    l.updated_at ? moment(l.updated_at).format('YYYY-MM-DD HH:mm') : '',
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
        toast.success(`${leadList.length} leads downloaded`);
    };

    const bulkUids = leadList.map((l) => l.uid).filter((uid): uid is string => uid != null);

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
                        onClick={closeAndDo(() => showModal({ title: 'Communicate', content: <LeadCommunicateForm bulkCount={leadList.length} />, type: 'custom', size: 'md' }))}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
                    >
                        <MessageSquare size={14} /> Communicate
                    </button>

                    <button
                        onClick={closeAndDo(() => showModal({ title: 'Change Lead Stage', content: <LeadStageForm bulkUids={bulkUids} />, type: 'custom', size: 'md' }))}
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

    // Filter states (names map 1:1 to GET /api/leads/ query params)
    const [filters, setFilters] = useState({
        stage: '',
        assigned_to: '',
        unassigned: '',
        program: '',
        source: '',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const {
        data: leads,
        loading,
        error,
        pagination,
    } = useAppSelector((state) => state.leads);

    const total_results = pagination?.total_results;
    const current_page = pagination?.current_page;
    const page_size = pagination?.page_size;

    const [pageSize, setPageSize] = useState(page_size || 10);
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.stage) count++;
        if (filters.assigned_to) count++;
        if (filters.unassigned && filters.unassigned !== 'all') count++;
        if (filters.program) count++;
        if (filters.source) count++;
        if (ordering) count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, ordering, startDate, endDate]);

    // Server-side query params built from search, filters, date range and sort
    const serverParams = useMemo(() => ({
        search: debouncedSearchTerm || undefined,
        stage: debouncedFilters.stage || undefined,
        assigned_to: debouncedFilters.assigned_to || undefined,
        unassigned: debouncedFilters.unassigned === 'true' ? true : undefined,
        program: debouncedFilters.program || undefined,
        source: debouncedFilters.source || undefined,
        created_from: startDate || undefined,
        created_to: endDate || undefined,
        ordering: ordering || undefined,
    }), [debouncedSearchTerm, debouncedFilters, startDate, endDate, ordering]);

    // Sync with Redux current_page if it changes
    useEffect(() => {
        if (current_page && current_page !== currentPage) {
            setCurrentPage(current_page);
        }
    }, [current_page]);

    // Fetch leads when currentPage or pageSize changes
    useEffect(() => {
        dispatch(fetchLeads({ page: currentPage, page_size: pageSize, ...serverParams }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, currentPage, pageSize]);

    const leadList = useMemo(() => leads || [], [leads]);
    const totalCount = total_results ?? leadList.length;

    // Refetch from page 1 when search, filters, date range or sort change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            dispatch(fetchLeads({ page: 1, page_size: pageSize, ...serverParams }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverParams]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            stage: '',
            assigned_to: '',
            unassigned: '',
            program: '',
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
        const currentKey = ordering.replace(/^-/, '') || 'full_name';
        handleSort(currentKey, direction);
    };

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'full_name',
            title: 'Registered Name',
            render: (_: any, row: Lead) => (
                <div className="flex items-center gap-3">
                    <LeadThumbnail row={row} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.full_name}</span>
                        <span
                            className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap max-w-[150px] truncate"
                            title={row.uid}
                        >
                            {row.uid || '-'}
                        </span>
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
            key: 'phone',
            title: 'Registered Phone',
            render: (value: string) => (
                <span className="text-xs font-semibold text-crmText whitespace-nowrap">{value || '-'}</span>
            ),
            sortable: true,
            width: '150px',
        },
        {
            key: 'city',
            title: 'City',
            render: (value: string) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            sortable: true,
            width: '110px',
        },
        {
            key: 'application_id',
            title: 'Application ID',
            render: (value: string) => (
                <span className="text-[11px] font-mono text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            width: '140px',
        },
        {
            key: 'program',
            title: 'Program',
            render: (value: string) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            sortable: true,
            width: '120px',
        },
        {
            key: 'source',
            title: 'Source',
            render: (value: string) => (
                <span className="text-[11px] font-mono text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            sortable: true,
            width: '110px',
        },
        {
            key: 'next_follow_up_at',
            title: 'Follow-up Date',
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
            key: 'stage',
            title: 'Lead Stage',
            render: (_: any, row: Lead) => (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap bg-major-tint text-crmText-secondary border-crmBorder">
                    <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: row.stage?.color || '#2563eb' }}
                    />
                    {row.stage?.name || '-'}
                </span>
            ),
            width: '140px',
            align: 'center',
        },
        {
            key: 'assigned_to',
            title: 'Assigned To',
            render: (_: any, row: Lead) => {
                const name = row.assigned_to?.name || row.assigned_to?.email;
                return (
                    <span className={`text-xs whitespace-nowrap ${name ? 'font-semibold text-crmText' : 'text-crmText-tertiary italic'}`}>
                        {name || 'Unassigned'}
                    </span>
                );
            },
            width: '140px',
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
            key: 'updated_at',
            title: 'Updated On',
            render: (value: string) => (
                <div className="flex flex-col">
                    <span className="text-crmText text-xs font-medium">{value ? moment(value).format('MMM DD, YYYY') : '-'}</span>
                    <span className="text-crmText-tertiary text-[10px] uppercase">{value ? moment(value).format('hh:mm A') : ''}</span>
                </div>
            ),
            sortable: true,
            width: '130px',
        },
        {
            key: 'uid',
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
                        <HeaderActionMenu leadList={leadList} />
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
                    data={leadList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    error={error}
                    onRetry={() => dispatch(fetchLeads({ page: currentPage, page_size: pageSize, ...serverParams }))}
                    emptyTitle="No leads found"
                    emptyDescription="There are no leads to display at the moment."
                    rowKey={(row: Lead) => row.uid ?? row.email ?? row.full_name ?? Math.random()}
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
