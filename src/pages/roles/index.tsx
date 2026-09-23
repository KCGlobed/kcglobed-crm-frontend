import React, { useState, useEffect, useMemo } from 'react';
import { Filter, Plus, ChevronDown } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchRoles, updateRoleStatus, deleteRole } from '../../store/slices/roleSlice';
import useDebounce from '../../hooks/useDebounce';
import moment from 'moment';
import RoleForm from '../../components/components/Forms/RoleForm';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import GlassButton from '../../components/components/Button/Button';
import { FiEdit, FiTrash, FiEye } from 'react-icons/fi';
import DeleteConfirmationModal from '../../components/components/Modal/DeleteModal';
import RoleView from '../../components/components/View/RoleView';
import SearchInput from '../../components/components/common/SearchInput';
import DateRangeDropdown from '../../components/components/common/DateRangeDropdown';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { roleFilterConfig } from '../../utils/filterConfiguration';
import type { Role } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const RoleThumbnail = ({ row }: { row: Role }) => {
    return (
        <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border ${
                row.is_system
                    ? 'border-secondary/30 bg-secondary-soft text-secondary-contrast'
                    : 'border-primary/30 bg-primary-soft text-primary-contrast'
            }`}
        >
            <span>{row.name ? row.name.charAt(0).toUpperCase() : 'R'}</span>
        </div>
    );
};

const ManageRoles: React.FC = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [ordering, setOrdering] = useState<string>('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states
    const [filters, setFilters] = useState({
        name: '',
        description: '',
        status: 'all' as 'all' | 'active' | 'deactive',
    });
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const { data: roles, loading } = useAppSelector((state) => state.roles);
    const pageSize = 10;

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.name) count++;
        if (filters.description) count++;
        if (filters.status && filters.status !== 'all') count++;
        if (ordering) count++;
        if (startDate || endDate) count++;
        return count;
    }, [filters, ordering, startDate, endDate]);

    // Fetch roles on mount
    useEffect(() => {
        dispatch(fetchRoles());
    }, [dispatch]);

    const roleList = useMemo(() => {
        if (Array.isArray(roles)) return roles;
        if (Array.isArray((roles as any)?.results)) return (roles as any).results;
        if (Array.isArray((roles as any)?.data)) return (roles as any).data;
        return [];
    }, [roles]);
    const totalCount = roleList.length;

    // Reset to first page when search or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, debouncedFilters, startDate, endDate]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({
            name: '',
            description: '',
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

    // Column definitions
    const columns: ColumnDef[] = [
        {
            key: 'name',
            title: 'Role',
            render: (_: any, row: Role) => (
                <div className="flex items-center gap-3">
                    <RoleThumbnail row={row} />
                    <div className="flex flex-col">
                        <span className="font-semibold text-crmText text-sm whitespace-nowrap">{row.name}</span>
                        <span className="text-[11px] text-crmText-tertiary font-mono whitespace-nowrap">{row.slug}</span>
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
            width: '240px',
        },
        {
            key: 'is_system',
            title: 'Type',
            render: (_: any, row: Role) => (
                <div className="flex items-center gap-1.5 justify-center flex-wrap">
                    <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                            row.is_system
                                ? 'bg-secondary-soft text-secondary-contrast border-secondary/30'
                                : 'bg-major-tint text-crmText-secondary border-crmBorder'
                        }`}
                    >
                        {row.is_system ? 'System' : 'Custom'}
                    </span>
                    {row.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30 uppercase tracking-wider whitespace-nowrap">
                            Default
                        </span>
                    )}
                </div>
            ),
            width: '130px',
            align: 'center',
            sortable: true,
        },
        {
            key: 'user_count',
            title: 'Users',
            render: (value: number) => (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-major-tint text-crmText-secondary border border-crmBorder whitespace-nowrap">
                    {value ?? 0} {value === 1 ? 'user' : 'users'}
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
            key: 'is_active',
            title: 'Status',
            render: (value: boolean, row: Role) => (
                <button
                    onClick={() => {
                        dispatch(updateRoleStatus({ id: row.id, is_active: !value }))
                            .unwrap()
                            .then(() => toast.success(`Role ${!value ? 'activated' : 'deactivated'} successfully`))
                            .catch((err: any) => toast.error(err || 'Failed to update status'));
                    }}
                    className={`px-3 cursor-pointer py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 hover:shadow-sm ${
                        value
                            ? 'bg-crmSuccess-bg text-crmSuccess border border-crmSuccess-border hover:bg-crmSuccess-bg/80'
                            : 'bg-crmDanger-bg text-crmDanger border border-crmDanger-border hover:bg-crmDanger-bg/80'
                    }`}
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
            render: (_: any, row: Role) => (
                <div className="flex items-center justify-end gap-3 pr-2">
                    <GlassButton
                        icon={<FiEye />}
                        color="blue"
                        title="View"
                        onClick={() =>
                            showModal({
                                title: 'Role Details',
                                content: <RoleView roleData={row} />,
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
                                title: `Edit Role: ${row.name}`,
                                content: <RoleForm roleData={row} />,
                                type: 'success',
                                size: 'xl',
                            })
                        }
                    />
                    {!row.is_system && (
                        <GlassButton
                            icon={<FiTrash className="text-base" />}
                            color="red"
                            title="Delete"
                            onClick={() => {
                                showModal({
                                    title: 'Delete Role',
                                    content: (
                                        <DeleteConfirmationModal
                                            id={row.id ?? 0}
                                            name={row.name ?? 'Role'}
                                            onDelete={async () => {
                                                if (row.id != null) {
                                                    await dispatch(deleteRole(row.id)).unwrap();
                                                }
                                            }}
                                        />
                                    ),
                                    type: 'custom',
                                    size: 'md',
                                });
                            }}
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
                        placeholder="Search roles..."
                        className="mx-4"
                    />

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <button
                            className="flex items-center gap-1.5 px-4 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-minor/20 shadow-sm cursor-pointer border-none"
                            onClick={() =>
                                showModal({
                                    title: "Add Role",
                                    content: <RoleForm />,
                                    type: 'custom',
                                    size: 'lg',
                                })
                            }
                        >
                            <Plus size={18} strokeWidth={2.5} />
                            Add Role
                        </button>
                    </div>
                </div>

                {/* Inline General Filter Section */}
                <DynamicFilter
                    show={showFilter}
                    config={roleFilterConfig}
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
                    data={roleList}
                    columns={columns as any}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    loading={loading}
                    rowKey={(row: Role) => row.id ?? row.slug ?? row.name ?? Math.random()}
                    onPageChange={(page) => setCurrentPage(page)}
                    onSort={handleSort}
                    className="rounded-none border-none shadow-none"
                    maxHeight="100%"
                />
            </div>
        </div>
    );
};

export const RolesPage = ManageRoles;
export default ManageRoles;
