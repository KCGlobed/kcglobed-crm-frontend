import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { FiEye, FiCheck, FiX, FiDownload } from 'react-icons/fi';
import DynamicServerTable from '../../components/components/Table/Table';
import GlassButton from '../../components/components/Button/Button';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchStudents, fetchPendingReviewDocuments } from '../../store/slices/studentSlice';
import { downloadStudentDocumentApi } from '../../services/apiServices';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import StudentView from '../../components/components/View/StudentView';
import LeadView from '../../components/components/View/LeadView';
import DocumentReviewForm from '../../components/components/Forms/DocumentReviewForm';
import SearchInput from '../../components/components/common/SearchInput';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { studentFilterConfig, pendingDocumentFilterConfig } from '../../utils/filterConfiguration';
import type { Student, StudentDocument } from '../../utils/types';

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
        case 'APPROVED':
        case 'COMPLETED':
            return 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border';
        case 'REJECTED':
            return 'bg-crmDanger-bg text-crmDanger border-crmDanger-border';
        default:
            return 'bg-major-tint text-crmText-secondary border-crmBorder';
    }
};

const ManageStudents: React.FC = () => {
    const [view, setView] = useState<'students' | 'pending'>('students');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states (names map 1:1 to the query params of the active view)
    const [filters, setFilters] = useState({
        stage: '',
        profile_status: '',
        status: '',
        document_type: '',
    });

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const {
        data: students,
        loading,
        error,
        pagination,
        pendingDocuments,
        pendingDocumentsLoading,
        pendingDocumentsPagination,
    } = useAppSelector((state) => state.students);

    const total_results = view === 'students' ? pagination?.total_results : pendingDocumentsPagination?.total_results;
    const current_page = view === 'students' ? pagination?.current_page : pendingDocumentsPagination?.current_page;

    const [pageSize, setPageSize] = useState(10);
    const isMounted = React.useRef(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (view === 'students') {
            if (filters.stage) count++;
            if (filters.profile_status && filters.profile_status !== 'all') count++;
            if (filters.status && filters.status !== 'all') count++;
        } else {
            if (filters.document_type) count++;
        }
        return count;
    }, [filters, view]);

    // Server-side query params for the active view
    const serverParams = useMemo(
        () =>
            view === 'students'
                ? {
                    search: debouncedSearchTerm || undefined,
                    stage: debouncedFilters.stage || undefined,
                    profile_status:
                        debouncedFilters.profile_status && debouncedFilters.profile_status !== 'all'
                            ? debouncedFilters.profile_status
                            : undefined,
                    status:
                        debouncedFilters.status && debouncedFilters.status !== 'all'
                            ? debouncedFilters.status
                            : undefined,
                }
                : {
                    search: debouncedSearchTerm || undefined,
                    document_type: debouncedFilters.document_type || undefined,
                },
        [view, debouncedSearchTerm, debouncedFilters]
    );

    const fetchActive = (page: number) => {
        if (view === 'students') {
            dispatch(fetchStudents({ page, page_size: pageSize, ...serverParams }));
        } else {
            dispatch(fetchPendingReviewDocuments({ page, page_size: pageSize, ...serverParams }));
        }
    };

    // Sync with Redux current_page if it changes
    useEffect(() => {
        if (current_page && current_page !== currentPage) {
            setCurrentPage(current_page);
        }
    }, [current_page]);

    // Fetch when view, currentPage or pageSize changes
    useEffect(() => {
        fetchActive(currentPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch, view, currentPage, pageSize]);

    const rows = view === 'students' ? students || [] : pendingDocuments || [];
    const rowsLoading = view === 'students' ? loading : pendingDocumentsLoading;
    const totalCount = total_results ?? rows.length;

    // Refetch from page 1 when search or filters change
    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
            return;
        }
        if (currentPage !== 1) {
            setCurrentPage(1);
        } else {
            fetchActive(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverParams]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ stage: '', profile_status: '', status: '', document_type: '' });
        setSearchTerm('');
    };

    const openStudent = (row: Student) => {
        showModal({
            title: `Student: ${row.full_name || row.application_id || ''}`,
            content: <StudentView studentData={row} />,
            type: 'success',
            size: 'xl',
        });
    };

    const openLeadFromDocument = (row: StudentDocument) => {
        // Pending-review rows nest the student under `application` with its lead_uid
        const leadUid = row.lead?.uid || row.application?.lead_uid;
        if (!leadUid) return;
        showModal({
            title: 'Lead Details',
            content: (
                <LeadView
                    leadData={{
                        uid: leadUid,
                        full_name: row.lead?.full_name || row.application?.full_name,
                        application_id: row.lead?.application_id || row.application?.application_id,
                    }}
                    initialTab="documents"
                />
            ),
            type: 'success',
            size: 'xl',
        });
    };

    const handleDownloadDocument = async (row: StudentDocument) => {
        const id = row.document?.id ?? row.id;
        if (!id) return;
        try {
            const response = await downloadStudentDocumentApi(id);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = row.original_name || row.document?.original_name || `${row.document_type || 'document'}`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to download document');
        }
    };

    // Student list columns (GET /api/students/)
    const studentColumns: ColumnDef[] = [
        {
            key: 'application_id',
            title: 'Application ID',
            render: (value: string) => (
                <span className="text-[11px] font-mono text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            width: '150px',
        },
        {
            key: 'full_name',
            title: 'Student Name',
            render: (value: string, row: Student) => (
                <span className="font-semibold text-crmText text-sm whitespace-nowrap">
                    {value || `${row.first_name || ''} ${row.last_name || ''}`.trim() || '-'}
                </span>
            ),
            width: '180px',
        },
        {
            key: 'email',
            title: 'Email',
            render: (value: string) => (
                <span className="text-xs text-crmText-secondary whitespace-nowrap">{value || '-'}</span>
            ),
            width: '200px',
        },
        {
            key: 'phone',
            title: 'Phone',
            render: (value: string) => (
                <span className="text-xs font-semibold text-crmText whitespace-nowrap">{value || '-'}</span>
            ),
            width: '130px',
        },
        {
            key: 'stage',
            title: 'Lead Stage',
            render: (_: any, row: Student) => {
                // List rows carry the stage as a plain code string; detail carries the object
                const stage = row.stage || row.lead?.stage;
                const name = typeof stage === 'string' ? stage.replace(/-/g, ' ') : stage?.name;
                const color = (typeof stage === 'object' && stage?.color) || row.lead?.stage?.color || '#2563eb';
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap bg-major-tint text-crmText-secondary border-crmBorder">
                        <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                        />
                        {name || '-'}
                    </span>
                );
            },
            width: '150px',
            align: 'center',
        },
        {
            key: 'profile_status',
            title: 'Profile',
            render: (value: any) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(value === true ? 'COMPLETED' : String(value))}`}>
                    {value === true ? 'COMPLETED' : value === false ? 'PENDING' : String(value ?? '-').replace(/_/g, ' ')}
                </span>
            ),
            width: '120px',
            align: 'center',
        },
        {
            key: 'status',
            title: 'Approved',
            render: (value: any) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(value === true ? 'APPROVED' : String(value))}`}>
                    {value === true ? 'APPROVED' : value === false ? 'PENDING' : String(value ?? '-').replace(/_/g, ' ')}
                </span>
            ),
            width: '120px',
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
            width: '130px',
        },
        {
            key: 'id',
            title: 'Action',
            render: (_: any, row: Student) => (
                <div className="flex items-center justify-end gap-1.5">
                    <GlassButton onClick={() => openStudent(row)} icon={<FiEye size={13} />} color="blue" title="View application" />
                </div>
            ),
            width: '90px',
            align: 'right',
        },
    ];

    // Pending review columns (GET /api/students/documents/pending-review/)
    const pendingColumns: ColumnDef[] = [
        {
            key: 'label',
            title: 'Document',
            render: (value: string, row: StudentDocument) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-crmText text-sm whitespace-nowrap">
                        {value || row.document_type || '-'}
                    </span>
                    <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">
                        {row.original_name || row.document?.original_name || '-'}
                    </span>
                </div>
            ),
            width: '200px',
        },
        {
            key: 'application',
            title: 'Student',
            render: (_: any, row: StudentDocument) => (
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-crmText whitespace-nowrap">
                        {row.application?.full_name || row.full_name || row.lead?.full_name || '-'}
                    </span>
                    <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">
                        {row.application?.application_id || row.application_id || row.lead?.application_id || '-'}
                    </span>
                </div>
            ),
            width: '180px',
        },
        {
            key: 'status',
            title: 'Status',
            render: (value: string) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${statusBadgeClass(value)}`}>
                    {value || 'SUBMITTED'}
                </span>
            ),
            width: '120px',
            align: 'center',
        },
        {
            key: 'uploaded_at',
            title: 'Uploaded On',
            render: (value: string, row: StudentDocument) => {
                const date = value || row.document?.uploaded_at;
                return (
                    <div className="flex flex-col">
                        <span className="text-crmText text-xs font-semibold">{date ? moment(date).format('MMM DD, YYYY') : '-'}</span>
                        <span className="text-crmText-tertiary text-[10px] uppercase font-bold">{date ? moment(date).format('hh:mm A') : ''}</span>
                    </div>
                );
            },
            width: '130px',
        },
        {
            key: 'id',
            title: 'Action',
            render: (_: any, row: StudentDocument) => (
                <div className="flex items-center justify-end gap-1.5">
                    {(row.lead?.uid || row.application?.lead_uid) && (
                        <GlassButton onClick={() => openLeadFromDocument(row)} icon={<FiEye size={13} />} color="blue" title="Open lead" />
                    )}
                    <GlassButton onClick={() => handleDownloadDocument(row)} icon={<FiDownload size={13} />} color="gray" title="Download" />
                    <GlassButton
                        onClick={() =>
                            showModal({
                                title: `Review: ${row.label || row.document_type || 'Document'}`,
                                content: <DocumentReviewForm documentData={row} leadUid={row.lead?.uid} initialStatus="APPROVED" />,
                                type: 'custom',
                                size: 'md',
                            })
                        }
                        icon={<FiCheck size={13} />}
                        color="green"
                        title="Approve"
                    />
                    <GlassButton
                        onClick={() =>
                            showModal({
                                title: `Review: ${row.label || row.document_type || 'Document'}`,
                                content: <DocumentReviewForm documentData={row} leadUid={row.lead?.uid} initialStatus="REJECTED" />,
                                type: 'custom',
                                size: 'md',
                            })
                        }
                        icon={<FiX size={13} />}
                        color="red"
                        title="Reject"
                    />
                </div>
            ),
            width: '160px',
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
                    </div>

                    <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder={view === 'students' ? 'Search students...' : 'Search pending documents...'}
                        className="mx-4"
                    />

                    {/* View tabs */}
                    <div className="flex items-center gap-1 rounded-xl border border-crmBorder bg-major p-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => { setView('students'); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                                view === 'students'
                                    ? 'bg-minor text-white shadow-crm-sm'
                                    : 'bg-transparent text-crmText-secondary hover:bg-major-muted'
                            }`}
                        >
                            Students
                        </button>
                        <button
                            type="button"
                            onClick={() => { setView('pending'); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none whitespace-nowrap ${
                                view === 'pending'
                                    ? 'bg-minor text-white shadow-crm-sm'
                                    : 'bg-transparent text-crmText-secondary hover:bg-major-muted'
                            }`}
                        >
                            Pending Review
                        </button>
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={view === 'students' ? studentFilterConfig : pendingDocumentFilterConfig}
                    values={filters}
                    onChange={handleFilterChange}
                    onClear={clearFilters}
                    onClose={() => setShowFilter(false)}
                />
            </div>

            {/* Main Table Content */}
            <div className="flex flex-col bg-major rounded-2xl shadow-crm-card overflow-hidden border border-crmBorder w-full max-w-full min-w-0">
                <DynamicServerTable
                    data={rows as any[]}
                    columns={(view === 'students' ? studentColumns : pendingColumns) as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={rowsLoading}
                    error={error}
                    onRetry={() => fetchActive(currentPage)}
                    emptyTitle={view === 'students' ? 'No students found' : 'No documents awaiting review'}
                    emptyDescription={
                        view === 'students'
                            ? 'There are no student applications to display at the moment.'
                            : 'All submitted documents have been reviewed.'
                    }
                    rowKey={(row: any) => row.application_id ?? row.id ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                    onRowClick={(row: any) => (view === 'students' ? openStudent(row) : openLeadFromDocument(row))}
                    className="rounded-none border-none shadow-none"
                    maxHeight="100%"
                />
            </div>
        </div>
    );
};

export const StudentsPage = ManageStudents;
export default ManageStudents;
