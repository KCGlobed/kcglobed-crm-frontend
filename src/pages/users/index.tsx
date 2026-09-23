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
      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border ${
        row.is_admin
          ? 'border-purple-200 bg-purple-50 text-purple-700'
          : 'border-minor/20 bg-minor-soft text-minor-contrast'
      }`}
    >
      <span>{initial}</span>
    </div>
  );
};

const ManageUsers: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [ordering, setOrdering] = useState<string>('');
  const [showFilter, setShowFilter] = useState(false);
  const { showModal } = useModal();

  // Filter states matching userFilterConfig
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    role: '',
    status: 'all' as 'all' | 'active' | 'deactive',
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedFilters = useDebounce(filters, 500);

  const dispatch = useAppDispatch();
  const { data: users, loading } = useAppSelector((state) => state.users);
  const pageSize = 10;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.name) count++;
    if (filters.email) count++;
    if (filters.role) count++;
    if (filters.status && filters.status !== 'all') count++;
    if (ordering) count++;
    return count;
  }, [filters, ordering]);

  // Fetch users on mount
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  // Client-side filtering & sorting matching backend data
  const filteredUsers = useMemo(() => {
    let list = [...(users || [])];

    // Search filter across first_name, last_name, email, role
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      list = list.filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        const roleObj = typeof u.role === 'object' && u.role !== null ? u.role : null;
        const roleName = (roleObj?.name || u.role_name || '').toLowerCase();
        const roleSlug = (roleObj?.slug || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return (
          fullName.includes(term) ||
          email.includes(term) ||
          roleName.includes(term) ||
          roleSlug.includes(term)
        );
      });
    }

    // Explicit field filters
    if (debouncedFilters.name) {
      const nameTerm = debouncedFilters.name.toLowerCase();
      list = list.filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        return fullName.includes(nameTerm);
      });
    }

    if (debouncedFilters.email) {
      const emailTerm = debouncedFilters.email.toLowerCase();
      list = list.filter((u) => (u.email || '').toLowerCase().includes(emailTerm));
    }

    if (debouncedFilters.role) {
      const roleTerm = debouncedFilters.role.toLowerCase();
      list = list.filter((u) => {
        const roleObj = typeof u.role === 'object' && u.role !== null ? u.role : null;
        const roleName = (roleObj?.name || u.role_name || '').toLowerCase();
        const roleSlug = (roleObj?.slug || '').toLowerCase();
        return roleName.includes(roleTerm) || roleSlug.includes(roleTerm);
      });
    }

    if (debouncedFilters.status && debouncedFilters.status !== 'all') {
      const shouldBeActive = debouncedFilters.status === 'active';
      list = list.filter((u) => !!u.is_active === shouldBeActive);
    }

    // Sorting
    if (ordering) {
      const isDesc = ordering.startsWith('-');
      const field = isDesc ? ordering.substring(1) : ordering;

      list.sort((a: any, b: any) => {
        let valA: any;
        let valB: any;

        if (field === 'role') {
          valA = typeof a.role === 'object' && a.role ? a.role.name : a.role_name || '';
          valB = typeof b.role === 'object' && b.role ? b.role.name : b.role_name || '';
        } else if (field === 'first_name' || field === 'name') {
          valA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
          valB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
        } else {
          valA = a[field] ?? '';
          valB = b[field] ?? '';
        }

        if (typeof valA === 'string') {
          return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        if (typeof valA === 'boolean') {
          return isDesc ? (valB === valA ? 0 : valB ? 1 : -1) : (valA === valB ? 0 : valA ? 1 : -1);
        }
        return isDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
      });
    }

    return list;
  }, [users, debouncedSearchTerm, debouncedFilters, ordering]);

  // Pagination calculation
  const totalCount = filteredUsers.length;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Reset to page 1 on search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, debouncedFilters]);

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

  // Columns definition strictly aligned with backend response
  const columns: ColumnDef[] = [
    {
      key: 'first_name',
      title: 'User',
      render: (_: any, row: User) => {
        const fullName =
          [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || '-';
        return (
          <div className="flex items-center gap-3">
            <UserThumbnail row={row} />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-gray-900 text-sm truncate">{fullName}</span>
              <span className="text-[11px] text-gray-500 truncate">{row.email}</span>
            </div>
          </div>
        );
      },
      sortable: true,
      width: '260px',
    },
    {
      key: 'role',
      title: 'Role',
      render: (_: any, row: User) => {
        const roleName =
          typeof row.role === 'object' && row.role ? row.role.name : row.role_name || '-';
        const roleSlug =
          typeof row.role === 'object' && row.role ? row.role.slug : null;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 text-sm">{roleName}</span>
            {roleSlug && (
              <span className="text-[11px] text-gray-500 font-mono">{roleSlug}</span>
            )}
          </div>
        );
      },
      sortable: true,
      width: '200px',
    },
    {
      key: 'is_admin',
      title: 'Access',
      render: (value: boolean) => (
        <div className="flex items-center justify-center">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
              value
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}
          >
            {value ? 'Admin' : 'Staff'}
          </span>
        </div>
      ),
      width: '130px',
      align: 'center',
      sortable: true,
    },
    {
      key: 'is_active',
      title: 'Status',
      render: (value: boolean) => (
        <div className="flex items-center justify-center">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${
              value
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {value ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
      width: '130px',
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
      width: '120px',
      align: 'right',
    },
  ];

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-6rem)] max-w-full min-w-0 animate-in fade-in duration-500">
      {/* Top Action Bar */}
      <div className="flex flex-col bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 relative">
        <div className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border ${
                showFilter || activeFilterCount > 0
                  ? 'border-minor/30 text-minor-contrast bg-minor-soft'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter
                size={16}
                className={showFilter || activeFilterCount > 0 ? 'text-minor-contrast' : 'text-gray-400'}
              />
              <span>Filter</span>
              <ChevronDown
                size={14}
                className={`text-gray-500 transition-transform duration-200 ${
                  showFilter ? 'rotate-180' : ''
                }`}
              />
              {activeFilterCount > 0 && (
                <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-minor text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
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
            <span className="text-xs font-semibold text-gray-500 mr-1">
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
      <div className="flex flex-col bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] overflow-hidden border border-gray-100 w-full max-w-full min-w-0">
        <DynamicServerTable
          data={paginatedData}
          columns={columns as any}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          loading={loading}
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
