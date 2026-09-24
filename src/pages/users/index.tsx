import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown, Plus } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchUsers, activateUser, deactivateUser } from '../../store/slices/userSlice';
import useDebounce from '../../hooks/useDebounce';
import { useModal } from '../../context/ModalContext';
import toast from 'react-hot-toast';
import UserView from '../../components/components/View/UserView';
import UserForm from '../../components/components/Forms/UserForm';
import UpdateRoleForm from '../../components/components/Forms/UpdateRoleForm';
import UpdateReporterForm from '../../components/components/Forms/UpdateReporterForm';
import StatusConfirmationModal from '../../components/components/Modal/StatusConfirmationModal';
import SearchInput from '../../components/components/common/SearchInput';
import DynamicFilter from '../../components/components/common/DynamicFilter';
import { userFilterConfig } from '../../utils/filterConfiguration';
import type { User } from '../../utils/types';

// Interface matching the Table component's column requirement
interface ColumnDef {
  key: string;
  title: string;
  render?: (value: any, row: any) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

const UserThumbnail = ({ row }: { row: User }) => {
  const initial = (row.first_name?.[0] || row.email?.[0] || 'U').toUpperCase();
  return (
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border ${
        row.is_admin
          ? 'border-primary/30 bg-primary-soft text-primary-contrast'
          : 'border-crmBorder bg-major-tint text-crmText-secondary'
      }`}
    >
      <span>{initial}</span>
    </div>
  );
};

const ManageUsers: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    data: users,
    loading,
    error,
    total_results,
    current_page,
    page_size,
  } = useAppSelector((state) => state.users);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [ordering, setOrdering] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const { showModal } = useModal();
  const isMounted = React.useRef(false);

  const pageSize = page_size || 10;

  // Filter states matching userFilterConfig
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    role: '',
    status: 'all' as 'all' | 'active' | 'deactive',
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedFilters = useDebounce(filters, 500);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.name) count++;
    if (filters.email) count++;
    if (filters.role) count++;
    if (filters.status && filters.status !== 'all') count++;
    if (ordering) count++;
    return count;
  }, [filters, ordering]);

  // Sync with current_page from Redux if it changes
  useEffect(() => {
    if (current_page && current_page !== currentPage) {
      setCurrentPage(current_page);
    }
  }, [current_page]);

  // Fetch users on page/pageSize change
  useEffect(() => {
    dispatch(fetchUsers({ page: currentPage, page_size: pageSize }));
  }, [dispatch, currentPage, pageSize]);

  // Reset to page 1 on search or filter changes
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      dispatch(fetchUsers({ page: 1, page_size: pageSize }));
    }
  }, [debouncedSearchTerm, debouncedFilters]);

  const userList = useMemo(() => users || [], [users]);
  const totalCount = total_results ?? userList.length;

  const handleFilterChange = (name: string, value: any) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      name: '',
      email: '',
      role: '',
      status: 'all',
    });
    setOrdering('');
    setSearchTerm('');
  };

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    const orderPrefix = direction === 'desc' ? '-' : '';
    setOrdering(`${orderPrefix}${key}`);
  };

  const handleDirectionSort = (direction: 'asc' | 'desc') => {
    const currentKey = ordering.replace(/^-/, '') || 'first_name';
    handleSort(currentKey, direction);
  };

  const executeToggleStatus = async (user: User) => {
    if (!user.uid) return;
    try {
      if (user.is_active) {
        await dispatch(deactivateUser(user.uid)).unwrap();
        toast.success('User deactivated successfully');
      } else {
        await dispatch(activateUser(user.uid)).unwrap();
        toast.success('User activated successfully');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to change user status');
      throw err;
    }
  };

  const getRoleBadgeClasses = (role: string) => {
    const lower = role.toLowerCase();
    if (lower.includes('super')) return 'bg-minor-soft text-minor-contrast border-minor/30';
    if (lower.includes('admin')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (lower.includes('manager')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (lower.includes('lead')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (lower.includes('hr')) return 'bg-pink-100 text-pink-700 border-pink-200';
    if (lower.includes('user')) return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-cyan-100 text-cyan-700 border-cyan-200';
  };

  const handleToggleStatus = (user: User) => {
    showModal({
      title: user.is_active ? 'Deactivate User' : 'Activate User',
      content: (
        <StatusConfirmationModal
          name={user.first_name || user.email || 'User'}
          isActive={!!user.is_active}
          onConfirm={() => executeToggleStatus(user)}
        />
      ),
      type: 'custom',
      size: 'md',
    });
  };

  // Columns definition strictly aligned with requirements & backend response
  const columns: ColumnDef[] = [
    {
      key: 'first_name',
      title: 'Name',
      render: (_: any, row: User) => {
        const fullName =
          [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || '-';
        return (
          <div 
            className="flex items-center gap-3 cursor-pointer hover:bg-major-tint p-1 -ml-1 rounded-lg transition-colors group"
            onClick={() =>
              showModal({
                title: 'User Details',
                content: <UserView userData={row} />,
                type: 'success',
                size: 'lg',
              })
            }
          >
            <UserThumbnail row={row} />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-crmText text-sm truncate group-hover:text-minor transition-colors">{fullName}</span>
            </div>
          </div>
        );
      },
      sortable: true,
      width: '220px',
    },
    {
      key: 'email',
      title: 'Email',
      render: (_: any, row: User) => (
        <span className="text-crmText-secondary text-xs truncate">{row.email || '-'}</span>
      ),
      sortable: true,
      width: '200px',
    },
    {
      key: 'phone1',
      title: 'Phone',
      render: (_: any, row: User) => (
        <span className="text-crmText-secondary text-xs">{row.phone1 || row.phone || '-'}</span>
      ),
      sortable: true,
      width: '140px',
    },
    {
      key: 'role',
      title: 'Role',
      render: (_: any, row: User) => {
        const roleName =
          typeof row.role === 'object' && row.role ? row.role.name : row.role_name || '-';
        return (
          <div className="flex items-center">
            <span 
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${getRoleBadgeClasses(roleName)}`}
              onClick={() =>
                showModal({
                  title: 'Update User Role',
                  content: <UpdateRoleForm userData={row} />,
                  type: 'success',
                  size: 'md',
                })
              }
            >
              {roleName}
            </span>
          </div>
        );
      },
      sortable: true,
      width: '160px',
    },
    {
      key: 'reports_to',
      title: 'Reports To',
      render: (_: any, row: User) => {
        const reportsToName =
          typeof row.reports_to === 'object' && row.reports_to
            ? row.reports_to.name
            : typeof row.reports_to_name === 'string'
            ? row.reports_to_name
            : null;
        return (
          <span 
            className="text-crmText-secondary text-xs font-medium cursor-pointer hover:text-minor hover:underline decoration-minor/30 underline-offset-4 transition-all"
            onClick={() =>
              showModal({
                title: 'Update Reporting Manager',
                content: <UpdateReporterForm userData={row} />,
                type: 'success',
                size: 'md',
              })
            }
          >
            {reportsToName || '-'}
          </span>
        );
      },
      sortable: false,
      width: '160px',
    },
    {
      key: 'is_active',
      title: 'Status',
      render: (value: boolean, row: User) => (
        <div className="flex items-center justify-center">
          <span
            onClick={() => handleToggleStatus(row)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap cursor-pointer hover:shadow-sm transition-all active:scale-95 ${
              value
                ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border hover:bg-crmSuccess-bg/80'
                : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border hover:bg-crmDanger-bg/80'
            }`}
          >
            {value ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
      width: '110px',
      align: 'center',
      sortable: true,
    },
    {
      key: 'is_admin',
      title: 'Admin',
      render: (value: boolean) => (
        <div className="flex items-center justify-center">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
              value
                ? 'bg-minor-soft text-minor-contrast border-minor/30'
                : 'bg-major-tint text-crmText-secondary border-crmBorder'
            }`}
          >
            {value ? 'Yes' : 'No'}
          </span>
        </div>
      ),
      width: '100px',
      align: 'center',
      sortable: true,
    },
  ];

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-6rem)] max-w-full min-w-0 animate-in fade-in duration-500">
      {/* Top Action Bar */}
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
              <Filter
                size={16}
                className={showFilter || activeFilterCount > 0 ? 'text-minor-contrast' : 'text-crmText-tertiary'}
              />
              <span>Filter</span>
              <ChevronDown
                size={14}
                className={`text-crmText-secondary transition-transform duration-200 ${
                  showFilter ? 'rotate-180' : ''
                }`}
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
            placeholder="Search users by name, email, role..."
            className="mx-4"
          />

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <span className="text-xs font-semibold text-crmText-secondary mr-1">
              Total: {totalCount} users
            </span>
            <button
              className="flex items-center gap-1.5 px-4 py-2 bg-minor hover:bg-minor-hover text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all active:scale-95 shadow-minor/20 shadow-sm cursor-pointer border-none"
              onClick={() =>
                showModal({
                  title: 'Add User',
                  content: <UserForm />,
                  type: 'custom',
                  size: 'lg',
                })
              }
            >
              <Plus size={18} strokeWidth={2.5} />
              Add User
            </button>
          </div>
        </div>

        {/* Inline General Filter Section */}
        <DynamicFilter
          show={showFilter}
          config={userFilterConfig}
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
          data={userList}
          columns={columns as any}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          loading={loading}
          error={error}
          onRetry={() => dispatch(fetchUsers({ page: currentPage, page_size: pageSize }))}
          emptyTitle="No users found"
          emptyDescription="There are no users to display at the moment."
          rowKey={(row: User) => row.uid ?? String(Math.random())}
          onPageChange={(page) => setCurrentPage(page)}
          onSort={handleSort as any}
          className="rounded-none border-none shadow-none"
          maxHeight="100%"
        />
      </div>
    </div>
  );
};

export const UsersPage = ManageUsers;
export default ManageUsers;
