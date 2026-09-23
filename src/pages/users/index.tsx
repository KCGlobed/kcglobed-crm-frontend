import React, { useState, useEffect, useMemo } from 'react';
import { Filter, ChevronDown, Plus } from 'lucide-react';
import DynamicServerTable from '../../components/components/Table/Table';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchUsers } from '../../store/slices/userSlice';
import useDebounce from '../../hooks/useDebounce';
import { useModal } from '../../context/ModalContext';
import GlassButton from '../../components/components/Button/Button';
import { FiEye, FiEdit } from 'react-icons/fi';
import UserView from '../../components/components/View/UserView';
import UserForm from '../../components/components/Forms/UserForm';
import UpdateRoleForm from '../../components/components/Forms/UpdateRoleForm';
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

  // Columns definition strictly aligned with requirements & backend response
  const columns: ColumnDef[] = [
    {
      key: 'first_name',
      title: 'Name',
      render: (_: any, row: User) => {
        const fullName =
          [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || '-';
        return (
          <div className="flex items-center gap-3">
            <UserThumbnail row={row} />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-crmText text-sm truncate">{fullName}</span>
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
          <span className="font-semibold text-crmText text-sm">{roleName}</span>
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
          <span className="text-crmText-secondary text-xs font-medium">
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
      render: (value: boolean) => (
        <div className="flex items-center justify-center">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
              value
                ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
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
    {
      key: 'actions',
      title: 'Actions',
      render: (_: any, row: User) => (
        <div className="flex items-center justify-end gap-2 pr-2">
          <GlassButton
            icon={<FiEye />}
            color="blue"
            title="View User"
            onClick={() =>
              showModal({
                title: 'User Details',
                content: <UserView userData={row} />,
                type: 'success',
                size: 'lg',
              })
            }
          />
          <GlassButton
            icon={<FiEdit />}
            color="green"
            title="Update Role"
            onClick={() =>
              showModal({
                title: 'Update User Role',
                content: <UpdateRoleForm userData={row} />,
                type: 'success',
                size: 'md',
              })
            }
          />
        </div>
      ),
      width: '110px',
      align: 'right',
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
