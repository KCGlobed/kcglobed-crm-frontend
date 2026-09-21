import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { fetchRoles, updateRoleStatus, deleteRole } from '../../store/slices/roleSlice';
import useDebounce from '../../hooks/useDebounce';
import RoleForm from '../../components/components/Forms/RoleForm';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import GlassButton from '../../components/components/Button/Button';
import { FiEdit, FiTrash, FiEye } from 'react-icons/fi';
import DeleteConfirmationModal from '../../components/components/Modal/DeleteModal';
import RoleView from '../../components/components/View/RoleView';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import TableToolbar from '../../components/components/common/TableToolbar';
import StatusBadge from '../../components/components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { roleFilterConfig } from '../../utils/filterConfiguration';
import type { RoleItem } from '../../utils/types';

// Column definition matching Table component
interface ColumnDef {
    key: string;
    title: string;
    render?: (value: any, row: any) => React.ReactNode;
    width?: string;
    align?: 'left' | 'center' | 'right';
    sortable?: boolean;
}

const RolesListPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const { showModal } = useModal();

    // Filter states
    const [filters, setFilters] = useState({
        name: '',
        description: '',
        status: 'all' as 'all' | 'active' | 'deactive',
    });

    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const debouncedFilters = useDebounce(filters, 500);

    const dispatch = useAppDispatch();
    const { data: roles, loading, error } = useAppSelector((state) => state.roles);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.name) count++;
        if (filters.description) count++;
        if (filters.status && filters.status !== 'all') count++;
        return count;
    }, [filters]);

    // Fetch roles on mount
    useEffect(() => {
        dispatch(fetchRoles());
    }, [dispatch]);

    // Client-side filtering (since the roles API returns all at once)
    const filteredRoles = useMemo(() => {
        let result = [...(roles || [])];

        // Search
        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            result = result.filter(
                (r) =>
                    r.name.toLowerCase().includes(term) ||
                    r.slug.toLowerCase().includes(term) ||
                    (r.description || '').toLowerCase().includes(term)
            );
        }

        // Name filter
        if (debouncedFilters.name) {
            const term = debouncedFilters.name.toLowerCase();
            result = result.filter((r) => r.name.toLowerCase().includes(term));
        }

        // Description filter
        if (debouncedFilters.description) {
            const term = debouncedFilters.description.toLowerCase();
            result = result.filter((r) => (r.description || '').toLowerCase().includes(term));
        }

        // Status filter
        if (debouncedFilters.status === 'active') {
            result = result.filter((r) => r.is_active);
        } else if (debouncedFilters.status === 'deactive') {
            result = result.filter((r) => !r.is_active);
        }

        return result;
    }, [roles, debouncedSearchTerm, debouncedFilters]);

    // Client-side pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    const totalCount = filteredRoles.length;
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredRoles.slice(start, start + pageSize);
    }, [filteredRoles, currentPage, pageSize]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, debouncedFilters]);

    const handleFilterChange = (name: string, value: any) => {
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const clearFilters = () => {
        setFilters({ name: '', description: '', status: 'all' });
        setSearchTerm('');
    };

    const openAddRole = () =>
        showModal({
            title: 'Add Role',
            content: <RoleForm />,
            type: 'custom',
            size: 'lg',
        });

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    // Column definitions — following the InstaLearn ManageCategories pattern
    const columns: ColumnDef[] = [
        {
            key: 'name',
            title: 'Role',
            render: (_: any, row: RoleItem) => (
                <div className="flex items-center gap-3">
                    <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border text-sm font-bold ${
                            row.is_system
                                ? 'border-crmWarning-border bg-crmWarning-bg text-crmWarning'
                                : 'border-minor/20 bg-minor-soft text-minor-contrast'
                        }`}
                    >
                        {row.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                        <span className="whitespace-nowrap text-[13px] font-semibold text-crmText">
                            {row.name}
                        </span>
                        <span className="font-mono text-[11px] text-crmText-tertiary">
                            {row.slug}
                        </span>
                    </div>
                </div>
            ),
            sortable: true,
            width: '250px',
        },
        {
            key: 'description',
            title: 'Description',
            render: (value: string) => (
                <div
                    className="max-w-[250px] truncate text-xs text-crmText-secondary"
                    title={value}
                >
                    {value || 'No description'}
                </div>
            ),
            sortable: true,
            width: '260px',
        },
        {
            key: 'permission_codes',
            title: 'Permissions',
            render: (_: any, row: RoleItem) => (
                <StatusBadge tone="brand">
                    {row.permission_codes?.length || 0} permissions
                </StatusBadge>
            ),
            width: '140px',
            align: 'center',
        },
        {
            key: 'user_count',
            title: 'Users',
            render: (value: number) => (
                <span className="text-[13px] font-semibold text-crmText">
                    {value ?? 0}
                </span>
            ),
            width: '80px',
            align: 'center',
            sortable: true,
        },
        {
            key: 'created_at',
            title: 'Created',
            render: (value: string) => (
                <span className="text-xs font-medium text-crmText-secondary">
                    {formatDate(value)}
                </span>
            ),
            sortable: true,
            width: '130px',
        },
        {
            key: 'is_active',
            title: 'Status',
            render: (value: boolean, row: RoleItem) => (
                <StatusBadge
                    tone={value ? 'success' : 'danger'}
                    uppercase
                    dot
                    title={value ? 'Deactivate role' : 'Activate role'}
                    onClick={() => {
                        dispatch(updateRoleStatus({ id: row.id, is_active: !value }))
                            .unwrap()
                            .then(() => toast.success(`Role ${!value ? 'activated' : 'deactivated'}`))
                            .catch((err: any) => toast.error(err || 'Failed to update status'));
                    }}
                >
                    {value ? 'Active' : 'Inactive'}
                </StatusBadge>
            ),
            width: '110px',
            align: 'center',
            sortable: true,
        },
        {
            key: 'id',
            title: 'Actions',
            render: (_: any, row: RoleItem) => (
                <div className="flex items-center justify-end gap-2 pr-1">
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
                        title="Edit Permissions"
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
                            icon={<FiTrash className="text-sm" />}
                            color="red"
                            title="Delete"
                            onClick={() => {
                                showModal({
                                    title: 'Delete Role',
                                    content: (
                                        <DeleteConfirmationModal
                                            id={row.id}
                                            name={row.name}
                                            onDelete={async () => {
                                                await dispatch(deleteRole(row.id)).unwrap();
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
            width: '140px',
            align: 'right',
        },
    ];

    return (
        <div className="flex w-full min-w-0 max-w-full flex-col gap-5">
            <PageHeader
                title="Roles & Permissions"
                description="Define access levels and control what each team member can do."
                actions={
                    <Button icon={<Plus size={16} strokeWidth={2.5} />} onClick={openAddRole}>
                        Add Role
                    </Button>
                }
            />

            {/* Search / filter bar */}
            <TableToolbar
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Search roles..."
                onToggleFilter={() => setShowFilter(!showFilter)}
                isFilterOpen={showFilter}
                activeFilterCount={activeFilterCount}
                filterPanel={
                    <DynamicFilter
                        show={showFilter}
                        config={roleFilterConfig}
                        values={filters}
                        onChange={handleFilterChange}
                        onClear={clearFilters}
                        onClose={() => setShowFilter(false)}
                    />
                }
            />

            {/* Table */}
            <DynamicServerTable
                data={paginatedData}
                columns={columns as any}
                currentPage={currentPage}
                pageSize={pageSize}
                totalCount={totalCount}
                loading={loading}
                error={roles && roles.length > 0 ? null : error}
                onRetry={() => dispatch(fetchRoles())}
                rowKey={(row: any) => row.id}
                emptyTitle="No roles found"
                emptyDescription={
                    searchTerm || activeFilterCount > 0
                        ? 'No roles match your current search or filters.'
                        : 'Create your first role to start assigning permissions.'
                }
                emptyAction={
                    searchTerm || activeFilterCount > 0 ? (
                        <Button variant="secondary" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    ) : (
                        <Button icon={<Plus size={16} strokeWidth={2.5} />} onClick={openAddRole}>
                            Add Role
                        </Button>
                    )
                }
                onPageChange={(page) => setCurrentPage(page)}
                maxHeight="calc(100vh - 340px)"
            />
        </div>
    );
};

export default RolesListPage;
