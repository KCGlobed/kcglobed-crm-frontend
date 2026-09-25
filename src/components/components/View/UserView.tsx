import React, { useEffect, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchUserPermissions } from '../../../store/slices/userSlice';
import type { User } from '../../../utils/types';

interface UserViewProps {
  userData: User;
}

const PERMISSION_ACTIONS = ['view', 'add', 'change', 'delete', 'export'];

const UserView: React.FC<UserViewProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { selectedUser, selectedUserLoading } = useAppSelector((state) => state.users);

  // Fetch user + effective permissions by UID on mount
  useEffect(() => {
    if (userData.uid) {
      dispatch(fetchUserPermissions(userData.uid));
    }
  }, [dispatch, userData.uid]);

  // Show table row immediately, then smoothly refine with detail response
  const user = useMemo(
    () => (selectedUser?.uid === userData.uid ? { ...userData, ...selectedUser } : userData),
    [userData, selectedUser]
  );

  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(' ') ||
    user.email ||
    '-';
  const roleName =
    typeof user.role === 'object' && user.role
      ? user.role.name
      : user.role_name || '-';
  const roleSlug =
    typeof user.role === 'object' && user.role ? user.role.slug : null;
  const reportsToName =
    typeof user.reports_to === 'object' && user.reports_to
      ? user.reports_to.name || user.reports_to.email
      : user.reports_to_name || null;
  const reportsToEmail =
    typeof user.reports_to === 'object' && user.reports_to ? user.reports_to.email : null;

  const modules = Object.keys(user.effective || {});

  return (
    <div className="w-full space-y-5">
      {/* Header Profile Card */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white text-xl font-bold shadow-sm">
          {(user.first_name || user.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{fullName}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                user.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {user.is_active ? 'Active' : 'Inactive'}
            </span>
            {user.is_admin && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-primary-soft text-primary-contrast border-primary/30">
                Admin
              </span>
            )}
            {user.full_access && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200">
                Full Access
              </span>
            )}
            {selectedUserLoading && (
              <span className="text-[11px] text-crmText-tertiary italic">Syncing...</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-crmText-secondary">{user.email || '-'}</div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            First Name
          </div>
          <div className="text-sm font-semibold text-crmText">{user.first_name || '-'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Last Name
          </div>
          <div className="text-sm font-semibold text-crmText">{user.last_name || '-'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Email Address
          </div>
          <div className="text-sm font-semibold text-crmText truncate" title={user.email}>
            {user.email || '-'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Phone
          </div>
          <div className="text-sm font-semibold text-crmText">{user.phone1 || user.phone || '-'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Role
          </div>
          <div className="text-sm font-semibold text-crmText">{roleName}</div>
          {roleSlug && (
            <div className="text-[11px] font-mono text-crmText-tertiary mt-0.5">{roleSlug}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Reports To
          </div>
          <div className="text-sm font-semibold text-crmText">{reportsToName || '-'}</div>
          {reportsToEmail && (
            <div className="text-[11px] text-crmText-tertiary mt-0.5 truncate" title={reportsToEmail}>
              {reportsToEmail}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Access Level
          </div>
          <div className="text-sm font-semibold text-crmText">
            {user.is_admin ? 'Administrator' : 'Standard User'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Account Status
          </div>
          <div className="text-sm font-semibold text-crmText">
            <span
              className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                user.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess'
                  : 'bg-crmDanger-bg text-crmDanger'
              }`}
            >
              {user.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Effective Permissions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
            Effective Permissions
          </div>
          {user.overrides && user.overrides.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
              {user.overrides.length} override{user.overrides.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {selectedUserLoading && modules.length === 0 ? (
          <div className="text-xs text-crmText-tertiary italic py-4 text-center">
            Loading permissions...
          </div>
        ) : modules.length === 0 ? (
          <div className="text-xs text-crmText-tertiary italic py-4 text-center">
            No permission data available.
          </div>
        ) : (
          <div className="rounded-xl border border-crmBorder overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-major-tint">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                    Module
                  </th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th
                      key={action}
                      className="px-3 py-2.5 text-center text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider"
                    >
                      {action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((mod) => {
                  const perms = user.effective?.[mod] || {};
                  return (
                    <tr key={mod} className="border-t border-crmBorder">
                      <td className="px-4 py-2.5 font-semibold text-crmText capitalize">{mod}</td>
                      {PERMISSION_ACTIONS.map((action) => {
                        const allowed = !!perms[action];
                        return (
                          <td key={action} className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
                                allowed
                                  ? 'bg-crmSuccess-bg text-crmSuccess'
                                  : 'bg-crmDanger-bg text-crmDanger'
                              }`}
                            >
                              {allowed ? (
                                <Check size={14} strokeWidth={3} />
                              ) : (
                                <X size={14} strokeWidth={3} />
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserView;
