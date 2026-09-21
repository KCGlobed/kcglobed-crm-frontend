// KC GlobeCRM - Users & Staff Management Module
import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Ban,
  Check,
  Eye,
  LayoutGrid,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import {
  fetchUsers,
  fetchUserById,
  createUser,
  activateUser,
  deactivateUser,
  setSelectedUser,
} from '../../store/slices/userSlice';
import { fetchRoles } from '../../store/slices/roleSlice';
import useDebounce from '../../hooks/useDebounce';
import DynamicServerTable from '../../components/components/Table/Table';
import type { ColumnDefinition } from '../../components/components/Table/Table';
import SearchInput from '../../components/components/common/SearchInput';
import StatusBadge from '../../components/components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import type { UserItem } from '../../utils/types';

export const UsersPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { data: users, loading, error } = useAppSelector((state) => state.users);
  const { data: roles } = useAppSelector((state) => state.roles);

  // User Profile Inspector State
  const [inspectUser, setInspectUser] = useState<UserItem | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Add User Form State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  const [deactivateModalUser, setDeactivateModalUser] = useState<UserItem | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Copy helper with feedback
  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Human-readable date and time formatter
  const formatFullDateTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Fetch users from API on mount
  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  // Lazy-fetch roles only when Add User modal is opened (if roles not already loaded)
  useEffect(() => {
    if (isAddUserOpen && (!roles || roles.length === 0)) {
      dispatch(fetchRoles());
    }
  }, [isAddUserOpen, roles, dispatch]);

  // Prevent browser password manager from aggressively autofilling admin credentials into new staff form
  useEffect(() => {
    if (isAddUserOpen) {
      setNewUserFullName('');
      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserRoleId('');
      setNewUserPassword('');
      setNewUserConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setAddUserError(null);

      const t1 = setTimeout(() => {
        setNewUserEmail((val) => (val && val.includes('superadmin') ? '' : val));
        setNewUserPassword((val) => (val ? '' : ''));
      }, 50);

      const t2 = setTimeout(() => {
        setNewUserEmail((val) => (val && val.includes('superadmin') ? '' : val));
        setNewUserPassword((val) => (val ? '' : ''));
      }, 150);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isAddUserOpen]);

  // Derive unique roles count for metric stat card
  const assignedRolesCount = useMemo(() => {
    const set = new Set<string>();
    (roles || []).forEach((r) => {
      if (r.name) set.add(r.name);
    });
    (users || []).forEach((u) => {
      if (u.role_name) set.add(u.role_name);
      else if (u.is_superadmin) set.add('Super Admin');
    });
    return set.size || 1;
  }, [roles, users]);

  // Key metrics
  const totalStaff = (users || []).length;
  const activeStaff = (users || []).filter((u) => u.is_active).length;
  const superAdminCount = (users || []).filter((u) => u.is_superadmin).length;

  // Open Add User Modal with clean empty inputs
  const handleOpenAddUser = () => {
    setNewUserFullName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserRoleId('');
    setNewUserPassword('');
    setNewUserConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAddUserError(null);
    setIsAddUserOpen(true);
    if (!roles || roles.length === 0) {
      dispatch(fetchRoles());
    }
  };

  // Submit Add User Form (POST /api/users/)
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUserFullName.trim()) {
      setAddUserError('Please enter the full name.');
      return;
    }
    if (!newUserEmail.trim()) {
      setAddUserError('Please enter an email address.');
      return;
    }
    if (!newUserRoleId) {
      setAddUserError('Please select a security role from the dropdown.');
      return;
    }
    if (!newUserPassword) {
      setAddUserError('Please enter a password.');
      return;
    }
    if (newUserPassword.length < 6) {
      setAddUserError('Password must be at least 6 characters.');
      return;
    }
    if (newUserPassword !== newUserConfirmPassword) {
      setAddUserError('Password and Confirm Password do not match.');
      return;
    }

    // Process email: substitute {{$randomInt}} if user entered it
    const finalEmail = newUserEmail.includes('{{$randomInt}}')
      ? newUserEmail.replace(/\{\{\$randomInt\}\}/g, String(Math.floor(Math.random() * 1001))).trim()
      : newUserEmail.trim();

    setIsSubmittingUser(true);
    setAddUserError(null);

    try {
      const created = await dispatch(
        createUser({
          full_name: newUserFullName.trim(),
          email: finalEmail,
          phone: newUserPhone.trim(),
          role: Number(newUserRoleId),
          password: newUserPassword,
          confirm_password: newUserConfirmPassword,
        })
      ).unwrap();

      toast.success(`Staff account "${created.full_name || created.email}" created successfully.`);
      setIsAddUserOpen(false);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Failed to create user on server.';
      setAddUserError(msg);
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Handle Activate User via POST /api/users/{id}/activate/
  const handleActivateUser = async (user: UserItem) => {
    try {
      setTogglingUserId(user.id);
      await dispatch(activateUser(user.id)).unwrap();
      toast.success(`Staff account "${user.full_name || user.email}" has been activated.`);
      if (inspectUser && inspectUser.id === user.id) {
        setInspectUser({ ...inspectUser, is_active: true });
      }
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'Failed to activate user account on server.');
    } finally {
      setTogglingUserId(null);
    }
  };

  // Open Deactivate Confirmation Modal
  const handlePromptDeactivate = (user: UserItem) => {
    setDeactivateModalUser(user);
  };

  // Handle Execute Deactivate via DELETE /api/users/{id}/
  const handleExecuteDeactivate = async () => {
    if (!deactivateModalUser) return;
    const userToDeactivate = deactivateModalUser;
    try {
      setTogglingUserId(userToDeactivate.id);
      await dispatch(deactivateUser(userToDeactivate.id)).unwrap();
      toast.success(
        `Staff account "${userToDeactivate.full_name || userToDeactivate.email}" was deactivated.`
      );
      if (inspectUser && inspectUser.id === userToDeactivate.id) {
        setInspectUser({ ...inspectUser, is_active: false });
      }
      setDeactivateModalUser(null);
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : 'Failed to deactivate user account on server.');
    } finally {
      setTogglingUserId(null);
    }
  };

  // View user profile by ID via GET /api/users/{id}/
  const handleViewUser = async (user: UserItem) => {
    setInspectUser(user);
    setIsInspectLoading(true);
    setInspectError(null);
    dispatch(setSelectedUser(user));
    try {
      const freshUser = await dispatch(fetchUserById(user.id)).unwrap();
      setInspectUser(freshUser);
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || `Failed to fetch user #${user.id} details.`;
      setInspectError(msg);
    } finally {
      setIsInspectLoading(false);
    }
  };

  // ---------------------------------------------------------------------
  // Client-side search + pagination for the staff table
  // (the users endpoint returns the full collection in one response)
  // ---------------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const debouncedSearch = useDebounce(searchTerm, 400);

  const filteredUsers = useMemo(() => {
    const list = users || [];
    if (!debouncedSearch) return list;
    const term = debouncedSearch.toLowerCase();
    return list.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term) ||
        (u.phone || '').toLowerCase().includes(term) ||
        (u.role_name || '').toLowerCase().includes(term)
    );
  }, [users, debouncedSearch]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const metrics = [
    {
      label: 'Total Staff Accounts',
      value: totalStaff,
      icon: <Users size={22} />,
      className: 'bg-minor-soft text-minor-contrast border-minor/20',
    },
    {
      label: 'Active Staff Members',
      value: activeStaff,
      icon: <UserCheck size={22} />,
      className: 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border',
    },
    {
      label: 'Super Administrators',
      value: superAdminCount,
      icon: <ShieldCheck size={22} />,
      className: 'bg-crmInfo-bg text-crmInfo border-crmInfo-border',
    },
    {
      label: 'Security Roles Assigned',
      value: assignedRolesCount,
      icon: <LayoutGrid size={22} />,
      className: 'bg-crmWarning-bg text-crmWarning border-crmWarning-border',
    },
  ];

  const userColumns: ColumnDefinition<UserItem>[] = [
    {
      key: 'full_name',
      title: 'Staff & Profile',
      sortable: true,
      width: '300px',
      render: (_value, user) => {
        const initials =
          (user.full_name || user.email || 'U')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'U';

        return (
          <div
            className="flex cursor-pointer items-center gap-3"
            onClick={() => handleViewUser(user)}
            title="Click to inspect profile details"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-minor to-minor-hover text-sm font-bold text-white">
              {initials}
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-crmText">
                  {user.full_name || 'Staff User'}
                </span>
                {user.is_superadmin && (
                  <StatusBadge tone="brand" uppercase>
                    Super Admin
                  </StatusBadge>
                )}
              </div>
              <span className="truncate text-[11px] text-crmText-tertiary">{user.email}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'role_name',
      title: 'Role',
      sortable: true,
      width: '170px',
      render: (_value, user) => (
        <span
          className={`text-[13px] font-semibold ${
            user.is_superadmin ? 'text-minor-contrast' : 'text-crmText'
          }`}
        >
          {user.role_name || (user.is_superadmin ? 'Super Admin' : 'Staff')}
        </span>
      ),
    },
    {
      key: 'phone',
      title: 'Contact',
      width: '190px',
      render: (_value, user) => (
        <div className="flex flex-col gap-0.5">
          <span className={`text-xs ${user.phone ? 'text-crmText' : 'italic text-crmText-tertiary'}`}>
            {user.phone || 'No phone set'}
          </span>
          <span className="text-[11px] text-crmText-tertiary">
            Joined: {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      ),
    },
    {
      key: 'is_active',
      title: 'Status',
      sortable: true,
      width: '170px',
      render: (_value, user) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge tone={user.is_active ? 'success' : 'danger'} dot uppercase>
            {user.is_active ? 'Active' : 'Disabled'}
          </StatusBadge>
          <span className="text-[11px] text-crmText-tertiary">
            {user.last_login
              ? `Last login: ${new Date(user.last_login).toLocaleDateString()}`
              : 'Never logged in'}
          </span>
        </div>
      ),
    },
    {
      key: 'id',
      title: 'Actions',
      align: 'right',
      width: '230px',
      render: (_value, user) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Eye size={13} />}
            loading={isInspectLoading && inspectUser?.id === user.id}
            onClick={() => handleViewUser(user)}
            title="View staff profile details"
          >
            View
          </Button>

          {!user.is_active && (
            <Button
              size="sm"
              variant="success"
              icon={<Check size={13} />}
              loading={togglingUserId === user.id}
              onClick={() => handleActivateUser(user)}
              title="Activate staff account"
            >
              Activate
            </Button>
          )}

          {user.is_active && !user.is_superadmin && (
            <Button
              size="sm"
              variant="dangerSoft"
              icon={<Ban size={13} />}
              loading={togglingUserId === user.id}
              onClick={() => handlePromptDeactivate(user)}
              title="Deactivate staff account"
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      {/* Page Header */}
      <PageHeader
        title="Users & Staff Management"
        description="Manage team members, staff accounts, role assignments, and authentication status."
        className="mb-6"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
              onClick={() => dispatch(fetchUsers())}
              title="Refresh users from API"
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              icon={<Plus size={16} strokeWidth={2.5} />}
              onClick={handleOpenAddUser}
              title="Register a new user account"
            >
              Add User
            </Button>
          </>
        }
      />

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex items-center gap-4 rounded-2xl border border-crmBorder bg-major p-5 shadow-crm-card transition-all hover:-translate-y-0.5 hover:border-minor/25 hover:shadow-crm-md"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${metric.className}`}
            >
              {metric.icon}
            </div>
            <div className="min-w-0">
              <div className="font-outfit text-2xl font-bold text-crmText">{metric.value}</div>
              <div className="truncate text-xs font-medium text-crmText-secondary">{metric.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Staff table */}
      <DynamicServerTable<UserItem>
        data={paginatedUsers}
        columns={userColumns}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={filteredUsers.length}
        loading={loading && (!users || users.length === 0)}
        error={users && users.length > 0 ? null : error}
        onRetry={() => dispatch(fetchUsers())}
        rowKey={(user) => user.id}
        onPageChange={(page) => setCurrentPage(page)}
        maxHeight="calc(100vh - 460px)"
        emptyTitle={searchTerm ? 'No matching staff found' : 'No staff accounts found'}
        emptyDescription={
          searchTerm
            ? 'Try a different name, email, phone or role.'
            : 'No users have been registered yet. Add your first staff member to get started.'
        }
        emptyAction={
          searchTerm ? (
            <Button variant="secondary" onClick={() => setSearchTerm('')}>
              Clear search
            </Button>
          ) : (
            <Button icon={<Plus size={16} strokeWidth={2.5} />} onClick={handleOpenAddUser}>
              Add First User
            </Button>
          )
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3 border-b border-crmBorder p-3 sm:px-4">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by name, email, phone or role..."
            />
            <span className="ml-auto text-xs font-medium text-crmText-tertiary">
              {filteredUsers.length} of {totalStaff} staff
            </span>
          </div>
        }
      />

      {/* ======================================================================
          CREATE STAFF ACCOUNT MODAL (POST /api/users/)
         ====================================================================== */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => !isSubmittingUser && setIsAddUserOpen(false)}>
          <div
            className="max-w-[620px] w-full p-0 overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(91,33,182,0.25),0_0_0_1px_rgba(160,63,153,0.15)] bg-major animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateUserSubmit} autoComplete="off">
              {/* Offscreen decoy fields to absorb browser credential autofill */}
              <div className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none -z-10">
                <input type="text" name="fake_username_autofill" tabIndex={-1} autoComplete="username" readOnly />
                <input type="password" name="fake_password_autofill" tabIndex={-1} autoComplete="current-password" readOnly />
              </div>

              {/* Modal Header */}
              <div className="p-6 px-8 border-b border-crmBorder bg-gradient-to-b from-major to-crmBgTint flex items-center justify-between m-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-[42px] h-[42px] rounded-[10px] bg-minor-soft text-minor-contrast flex items-center justify-center shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                  </div>
                  <div>
                    <h3 className="m-0 text-xl font-bold text-crmText">
                      Create Staff Account
                    </h3>
                    <p className="text-xs text-crmTextSecondary mt-0.5">
                      Register new team member credentials and assign system access role.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="text-crmText-tertiary hover:text-crmText text-2xl font-bold leading-none p-1 cursor-pointer bg-transparent transition-colors"
                  disabled={isSubmittingUser}
                  onClick={() => setIsAddUserOpen(false)}
                  title="Close modal"
                >
                  ×
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-7 px-8 flex flex-col gap-5">
                {addUserError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-crmDanger-bg border border-crmDanger-border text-crmDanger">
                    <div className="text-base">⚠️</div>
                    <div className="text-sm text-crmDanger">{addUserError}</div>
                  </div>
                )}

                {/* Full Name */}
                <div className="flex flex-col">
                  <label className="font-semibold text-[0.85rem] mb-1.5 block text-crmText">
                    Full Name <span className="text-crmDanger">*</span>
                  </label>
                  <input
                    type="text"
                    name="new_staff_fullname_field"
                    className="w-full h-11 px-3.5 rounded-lg border border-crmBorder bg-major text-crmText text-[0.92rem] focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                    placeholder="e.g. John Doe"
                    value={newUserFullName}
                    onChange={(e) => setNewUserFullName(e.target.value)}
                    autoComplete="off"
                    required
                    disabled={isSubmittingUser}
                  />
                </div>

                {/* Email Address */}
                <div className="flex flex-col">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="font-semibold text-[0.85rem] m-0 text-crmText">
                      Email Address <span className="text-crmDanger">*</span>
                    </label>
                    <span className="text-xs text-crmTextTertiary">
                      Used as staff login identifier
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="email"
                    name="new_staff_account_email_addr"
                    className="w-full h-11 px-3.5 rounded-lg border border-crmBorder bg-major text-crmText text-[0.92rem] focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                    placeholder="e.g. john.doe@kcglobed.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    autoComplete="off"
                    required
                    disabled={isSubmittingUser}
                  />
                </div>

                {/* Phone & Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col">
                    <label className="font-semibold text-[0.85rem] mb-1.5 block text-crmText">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="new_staff_phone_number"
                      className="w-full h-11 px-3.5 rounded-lg border border-crmBorder bg-major text-crmText text-[0.92rem] focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                      placeholder="e.g. 9800000000"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      autoComplete="off"
                      disabled={isSubmittingUser}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="font-semibold text-[0.85rem] mb-1.5 block text-crmText">
                      Assign Role <span className="text-crmDanger">*</span>
                    </label>
                    <select
                      name="new_staff_role_select"
                      className="w-full h-11 px-3.5 rounded-lg border border-crmBorder bg-major text-crmText text-[0.92rem] focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                      value={newUserRoleId}
                      onChange={(e) => setNewUserRoleId(e.target.value)}
                      required
                      disabled={isSubmittingUser}
                    >
                      <option value="">Select a role...</option>
                      {(roles || []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col">
                    <label className="font-semibold text-[0.85rem] mb-1.5 block text-crmText">
                      Password <span className="text-crmDanger">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="new_staff_auth_pwd"
                        className="w-full h-11 px-3.5 pr-10 rounded-lg border border-crmBorder bg-major text-crmText text-[0.92rem] focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                        placeholder="Min. 6 characters"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={isSubmittingUser}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-crmTextTertiary hover:text-crmTextSecondary cursor-pointer p-1 flex items-center"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="font-semibold text-[0.85rem] mb-1.5 block text-crmText">
                      Confirm Password <span className="text-crmDanger">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="new_staff_auth_confirm_pwd"
                        className="w-full h-11 px-3.5 pr-10 rounded-lg border border-crmBorder bg-major text-crmText text-[0.92rem] focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                        placeholder="Repeat password"
                        value={newUserConfirmPassword}
                        onChange={(e) => setNewUserConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={isSubmittingUser}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-crmTextTertiary hover:text-crmTextSecondary cursor-pointer p-1 flex items-center"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="p-5 px-8 border-t border-crmBorder flex justify-end items-center gap-3.5 bg-crmBgTint m-0">
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary font-semibold text-sm transition-all cursor-pointer"
                  disabled={isSubmittingUser}
                  onClick={() => setIsAddUserOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-7 py-2.5 rounded-lg bg-minor hover:bg-minor-hover text-white font-semibold text-sm transition-all shadow-accent cursor-pointer flex items-center gap-2 active:scale-[0.98] disabled:opacity-50"
                  disabled={isSubmittingUser}
                >
                  {isSubmittingUser ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-major border-t-transparent animate-spin inline-block" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Staff Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          DEACTIVATE USER CONFIRMATION MODAL (DELETE /api/users/{id}/)
         ====================================================================== */}
      {deactivateModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDeactivateModalUser(null)}>
          <div
            className="max-w-[500px] w-full p-0 overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(239,68,68,0.2),0_0_0_1px_rgba(239,68,68,0.15)] bg-major animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 px-6 border-b border-crmBorder bg-gradient-to-b from-major to-crmBgTint flex items-center justify-between m-0">
              <h3 className="text-crmDanger flex items-center gap-2 m-0 text-lg font-bold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                </svg>
                <span>Deactivate Staff Member</span>
              </h3>
              <button
                type="button"
                className="text-crmText-tertiary hover:text-crmText text-2xl font-bold leading-none p-1 cursor-pointer bg-transparent transition-colors"
                onClick={() => setDeactivateModalUser(null)}
              >
                ×
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="m-0 text-sm text-crmTextSecondary leading-relaxed">
                Are you sure you want to deactivate{' '}
                <strong className="text-crmText">{deactivateModalUser.full_name || deactivateModalUser.email}</strong>?
                This staff member will immediately lose access to the KC GlobeCRM system.
              </p>

              <div className="rounded-lg border border-crmBorder bg-crmBgTint p-3 px-4 text-xs text-crmTextSecondary">
                API Call:{' '}
                <code className="font-mono text-minor-contrast">
                  DELETE /api/users/{deactivateModalUser.id}/
                </code>
              </div>
            </div>

            <div className="p-5 px-6 border-t border-crmBorder flex justify-end gap-3 bg-crmBgTint m-0">
              <button
                type="button"
                className="px-5 py-2.5 rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary font-semibold text-sm transition-all cursor-pointer"
                disabled={togglingUserId === deactivateModalUser.id}
                onClick={() => setDeactivateModalUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2.5 rounded-lg bg-crmDanger hover:bg-crmDanger text-white font-semibold text-sm transition-all shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
                disabled={togglingUserId === deactivateModalUser.id}
                onClick={handleExecuteDeactivate}
              >
                {togglingUserId === deactivateModalUser.id ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-major border-t-transparent animate-spin inline-block" />
                    <span>Deactivating...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                    </svg>
                    <span>Confirm Deactivation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          STREAMLINED USER DETAIL MODAL (GET /api/users/{id}/)
         ====================================================================== */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setInspectUser(null)}>
          <div
            className="max-w-[640px] w-full p-0 overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(91,33,182,0.25),0_0_0_1px_rgba(160,63,153,0.12)] bg-major animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 px-7 border-b border-crmBorder bg-gradient-to-b from-major to-crmBgTint flex items-center justify-between m-0">
              <div>
                <h3 className="m-0 text-xl font-bold text-crmText">
                  Staff Member Profile
                </h3>
                <p className="text-xs text-crmTextSecondary mt-0.5">
                  Account details, organizational role, and authentication status.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 border ${
                    inspectUser.is_active
                      ? 'text-crmSuccess bg-crmSuccess-bg border-crmSuccess-border'
                      : 'text-crmDanger bg-crmDanger-bg border-crmDanger-border'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      inspectUser.is_active ? 'bg-crmSuccess' : 'bg-crmDanger'
                    }`}
                  />
                  {inspectUser.is_active ? 'Active Staff' : 'Deactivated'}
                </span>
                <button
                  type="button"
                  className="text-crmText-tertiary hover:text-crmText text-2xl font-bold leading-none p-1 cursor-pointer bg-transparent transition-colors"
                  onClick={() => setInspectUser(null)}
                  title="Close modal"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Top Identity Hero Card */}
            <div className="p-5 px-7 bg-gradient-to-br from-minor/5 to-major-muted border-b border-crmBorder flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-minor to-minor-hover text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-md border-2 border-major">
                {(inspectUser.full_name || inspectUser.email || 'U').substring(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="m-0 text-xl font-extrabold text-crmText">
                    {inspectUser.full_name || 'Staff User'}
                  </h3>
                  {inspectUser.is_superadmin && (
                    <span className="bg-minor-soft text-minor-contrast border border-minor/20 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                      SUPER ADMIN
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-bold text-minor-contrast bg-minor-soft px-2 py-0.5 rounded-md">
                    {inspectUser.role_name || (inspectUser.is_superadmin ? 'Super Admin' : 'Staff Member')}
                  </span>
                  <span className="text-xs text-crmTextTertiary">
                    Staff ID #{inspectUser.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 px-7 flex flex-col gap-5">
              {inspectError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-crmDanger-bg border border-crmDanger-border text-crmDanger">
                  <div className="text-base">⚠️</div>
                  <div className="text-sm text-crmDanger">{inspectError}</div>
                </div>
              )}

              {/* Full Width Email Bar */}
              <div className="p-4 px-5 bg-crmBgTint rounded-xl border border-crmBorder flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-crmTextTertiary uppercase font-bold tracking-wider">
                    Email Address
                  </div>
                  <div
                    className="text-sm font-bold text-crmText mt-0.5 truncate"
                    title={inspectUser.email}
                  >
                    {inspectUser.email}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyText(inspectUser.email, 'email')}
                  className="bg-major border border-crmBorder rounded-md px-3 py-1.5 text-xs font-semibold text-crmTextSecondary hover:text-minor-contrast hover:border-minor/30 cursor-pointer inline-flex items-center gap-1.5 shrink-0 transition-all"
                  title="Copy email to clipboard"
                >
                  {copiedField === 'email' ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-crmSuccess">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span className="text-crmSuccess">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Full Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 bg-major rounded-xl border border-crmBorder">
                {/* Staff ID */}
                <div>
                  <div className="text-[11px] text-crmTextTertiary uppercase font-bold tracking-wider">
                    Staff ID
                  </div>
                  <div className="text-sm font-bold text-crmText mt-0.5">
                    #{inspectUser.id}
                  </div>
                </div>

                {/* Assigned Role */}
                <div>
                  <div className="text-[11px] text-crmTextTertiary uppercase font-bold tracking-wider">
                    Assigned Role
                  </div>
                  <div className="text-sm font-bold text-crmText mt-0.5">
                    {inspectUser.role_name || (inspectUser.is_superadmin ? 'Super Admin' : 'Staff')}
                    {(inspectUser.role || inspectUser.role_detail?.id) && (
                      <span className="text-xs text-crmTextTertiary font-normal ml-1.5">
                        (Role #{inspectUser.role || inspectUser.role_detail?.id})
                      </span>
                    )}
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <div className="text-[11px] text-crmTextTertiary uppercase font-bold tracking-wider">
                    Phone Number
                  </div>
                  <div className={`text-sm font-semibold mt-0.5 ${inspectUser.phone ? 'text-crmText' : 'text-crmTextTertiary italic'}`}>
                    {inspectUser.phone || 'No phone set'}
                  </div>
                </div>

                {/* Account Type */}
                <div>
                  <div className="text-[11px] text-crmTextTertiary uppercase font-bold tracking-wider">
                    Account Type
                  </div>
                  <div className="text-sm font-semibold text-crmText mt-0.5">
                    {inspectUser.is_superadmin ? 'Super Administrator' : (inspectUser.is_student ? 'Student User' : 'Staff Member')}
                  </div>
                </div>

                {/* Date Joined */}
                <div>
                  <div className="text-[11px] text-crmTextTertiary uppercase font-bold tracking-wider">
                    Date Joined
                  </div>
                  <div className="text-sm font-semibold text-crmText mt-0.5">
                    {formatFullDateTime(inspectUser.date_joined) || 'N/A'}
                  </div>
                </div>

                {/* Last Login */}
                <div>
                  <div className="text-[11px] text-crmTextTertiary uppercase font-bold tracking-wider">
                    Last Login
                  </div>
                  <div className={`text-sm font-semibold mt-0.5 ${inspectUser.last_login ? 'text-crmText' : 'text-crmTextTertiary italic'}`}>
                    {inspectUser.last_login ? formatFullDateTime(inspectUser.last_login) : 'Never logged in'}
                  </div>
                </div>
              </div>

              {/* Status Notice */}
              <div
                className={`p-3 px-4 rounded-lg text-xs flex items-center gap-2 border ${
                  inspectUser.is_active
                    ? 'bg-crmSuccess-bg border-crmSuccess-border text-crmSuccess'
                    : 'bg-crmDanger-bg border-crmDanger-border text-crmDanger'
                }`}
              >
                <span>{inspectUser.is_active ? '✓' : '⚠️'}</span>
                <span>
                  {inspectUser.is_active
                    ? 'Account is active. Staff authentication and system access permissions are fully granted.'
                    : 'Account is deactivated. Staff member is currently blocked from signing in.'}
                </span>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 px-7 border-t border-crmBorder flex justify-between items-center bg-crmBgTint m-0">
              <div>
                {!inspectUser.is_superadmin && (
                  inspectUser.is_active ? (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg border border-crmDanger-border bg-major hover:bg-crmDanger-bg text-xs font-semibold text-crmDanger transition-all cursor-pointer disabled:opacity-50"
                      onClick={() => handlePromptDeactivate(inspectUser)}
                      disabled={togglingUserId === inspectUser.id}
                    >
                      Deactivate Account
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg border border-crmSuccess-border bg-major hover:bg-crmSuccess-bg text-xs font-semibold text-crmSuccess transition-all cursor-pointer disabled:opacity-50"
                      onClick={() => handleActivateUser(inspectUser)}
                      disabled={togglingUserId === inspectUser.id}
                    >
                      Activate Account
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                className="px-6 py-2 rounded-lg bg-minor hover:bg-minor-hover text-white font-semibold text-sm transition-all shadow-accent cursor-pointer active:scale-[0.98]"
                onClick={() => setInspectUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
