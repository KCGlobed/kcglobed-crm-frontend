import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Plus, Columns, Check, MoreVertical, Eye, Shield, Users, Power, Filter } from 'lucide-react';
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
import { FiEdit } from 'react-icons/fi';

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
      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden shrink-0 border ${row.is_admin
        ? 'border-primary/30 bg-primary-soft text-primary-contrast'
        : 'border-crmBorder bg-major-tint text-crmText-secondary'
        }`}
    >
      <span>{initial}</span>
    </div>
  );
};

const ActionMenu = ({ row, onToggleStatus }: { row: User; onToggleStatus: (user: User) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { showModal } = useModal();
  const { access } = useAppSelector((state) => state.auth);

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
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-major rounded-xl shadow-lg border border-crmBorder py-1.5 z-[99] overflow-hidden">
          <button
            onClick={closeAndDo(() => showModal({ title: 'User Details', content: <UserView userData={row} />, type: 'success', size: 'lg' }))}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-minor hover:bg-major-tint transition-colors text-left"
          >
            <Eye size={14} /> View Details
          </button>

          {access?.permissions?.users?.change && (
            <button
              onClick={closeAndDo(() => showModal({ title: 'Edit User', content: <UserForm userData={row} />, type: 'custom', size: 'lg' }))}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-green-600 hover:bg-green-50 transition-colors text-left"
            >
              <FiEdit size={14} /> Edit User
            </button>
          )}

          {access?.permissions?.users?.change && (
            <button
              onClick={closeAndDo(() => showModal({ title: 'Update User Role', content: <UpdateRoleForm userData={row} />, type: 'success', size: 'md' }))}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-blue-600 hover:bg-blue-50 transition-colors text-left"
            >
              <Shield size={14} /> Change Role
            </button>
          )}

          {access?.permissions?.users?.change && (
            <button
              onClick={closeAndDo(() => showModal({ title: 'Update Reporting Manager', content: <UpdateReporterForm userData={row} />, type: 'success', size: 'md' }))}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-crmText-secondary hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-left"
            >
              <Users size={14} /> Change Reporter
            </button>
          )}

          {access?.permissions?.users?.change && (
            <button
              onClick={closeAndDo(() => onToggleStatus(row))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors text-left border-t border-crmBorder mt-1 pt-2 ${row.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              <Power size={14} /> {row.is_active ? 'Deactivate User' : 'Activate User'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const ManageUsers: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    data: users,
    loading,
    error,
    pagination,
  } = useAppSelector((state) => state.users);

  const current_page = pagination?.current_page;
  const page_size = pagination?.page_size;
  const total_results = pagination?.total_results;
  const { access } = useAppSelector((state) => state.auth);

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const activeFilterCount = Object.keys(filterValues).filter((k) => filterValues[k] !== '' && filterValues[k] !== 'all').length;

  const handleFilterChange = (name: string, value: any) => {
    setFilterValues((prev) => {
      if (prev[name] === value) return prev;
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleClearFilters = () => {
    setFilterValues({});
  };

  const { showModal } = useModal();
  const isMounted = React.useRef(false);
  const columnDropdownRef = React.useRef<HTMLDivElement>(null);

  const defaultVisibleColumns = ['first_name', 'email', 'phone1', 'role', 'reports_to', 'is_active', 'is_admin', 'actions'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const [pageSize, setPageSize] = useState(page_size || 10);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Sync with current_page from Redux if it changes
  useEffect(() => {
    if (current_page && current_page !== currentPage) {
      setCurrentPage(current_page);
    }
  }, [current_page]);

  // Fetch users on page/pageSize change
  useEffect(() => {
    dispatch(fetchUsers({ 
      page: currentPage, 
      page_size: pageSize, 
      search: debouncedSearchTerm,
      ...filterValues
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, currentPage, pageSize, debouncedSearchTerm, JSON.stringify(filterValues)]);

  // Reset to page 1 on search or filter changes
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, JSON.stringify(filterValues)]);

  const userList = useMemo(() => users || [], [users]);
  const totalCount = total_results ?? userList.length;





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
          <div className="flex items-center gap-3 p-1 -ml-1 rounded-lg group">
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
          <div className="flex items-center">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity active:scale-95 ${getRoleBadgeClasses(roleName || '-')}`}
              onClick={(e) => {
                e.stopPropagation();
                showModal({
                  title: 'Update User Role',
                  content: <UpdateRoleForm userData={row} />,
                  type: 'success',
                  size: 'md',
                });
              }}
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
            onClick={(e) => {
              e.stopPropagation();
              showModal({
                title: 'Update Reporting Manager',
                content: <UpdateReporterForm userData={row} />,
                type: 'success',
                size: 'md',
              });
            }}
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
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${value
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
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap ${value
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
        <ActionMenu row={row} onToggleStatus={handleToggleStatus} />
      ),
      width: '100px',
      align: 'center',
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
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border ${showFilter || activeFilterCount > 0
                  ? 'border-minor/30 text-minor-contrast bg-minor-soft'
                  : 'border-crmBorder text-crmText-secondary hover:border-crmBorder-strong hover:bg-major-tint'
                  }`}
              >
                <Filter size={16} className={showFilter || activeFilterCount > 0 ? 'text-minor-contrast' : 'text-crmText-tertiary'} />
                <span>Filter</span>
                <ChevronDown size={14} className={`text-crmText-secondary transition-transform duration-200 ${showFilter ? 'rotate-180' : ''}`} />
                {activeFilterCount > 0 && (
                  <span className="min-w-[18px] h-4.5 px-1.5 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="relative" ref={columnDropdownRef}>
                <button
                  onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 border ${showColumnDropdown
                    ? 'border-minor/30 text-minor-contrast bg-minor-soft'
                    : 'border-crmBorder text-crmText-secondary hover:border-crmBorder-strong hover:bg-major-tint'
                    }`}
                >
                  <Columns size={16} className={showColumnDropdown ? 'text-minor-contrast' : 'text-crmText-tertiary'} />
                  <span>Columns</span>
                  <ChevronDown size={14} className={`text-crmText-secondary transition-transform duration-200 ${showColumnDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showColumnDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-major rounded-xl shadow-lg border border-crmBorder py-2 z-50">
                    <div className="px-3 pb-2 mb-2 border-b border-crmBorder text-xs font-semibold text-crmText-secondary uppercase tracking-wider">
                      Toggle Columns
                    </div>
                    {columns.map(col => (
                      <button
                        key={col.key}
                        onClick={() => toggleColumn(col.key)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-major-tint transition-colors text-sm text-crmText cursor-pointer border-none bg-transparent"
                      >
                        <span className="truncate pr-2 font-medium">{col.title}</span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${visibleColumns.includes(col.key) ? 'bg-minor border-minor text-white' : 'border-crmBorder bg-transparent'}`}>
                          {visibleColumns.includes(col.key) && <Check size={12} strokeWidth={3} />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
            {
              access?.permissions?.users?.add && (
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
              )}
          </div>
        </div>

        <DynamicFilter
          show={showFilter}
          config={userFilterConfig}
          values={filterValues}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          onClose={() => setShowFilter(false)}
        />
      </div>

      {/* Main Table Content */}
      <div className="flex flex-col bg-major rounded-2xl shadow-crm-card overflow-hidden border border-crmBorder w-full max-w-full min-w-0">
        <DynamicServerTable
          data={userList}
          columns={columns.filter(col => visibleColumns.includes(col.key)) as any}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          loading={loading}
          error={error}
          onRetry={() => dispatch(fetchUsers({ page: currentPage, page_size: pageSize, search: debouncedSearchTerm, ...filterValues }))}
          emptyTitle="No users found"
          emptyDescription="There are no users to display at the moment."
          rowKey={(row: User) => row.uid ?? String(Math.random())}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1); // Reset to first page when size changes
          }}

          onRowClick={(row) =>
            showModal({
              title: 'User Details',
              content: <UserView userData={row} />,
              type: 'success',
              size: 'lg',
            })
          }
          className="rounded-none border-none shadow-none"
          maxHeight="100%"
        />
      </div>
    </div>
  );
};

export const UsersPage = ManageUsers;
export default ManageUsers;
