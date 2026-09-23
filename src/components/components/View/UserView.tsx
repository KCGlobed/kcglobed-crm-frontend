import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchUserByUid } from '../../../store/slices/userSlice';
import type { User } from '../../../utils/types';

interface UserViewProps {
  userData: User;
}

const UserView: React.FC<UserViewProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { selectedUser, selectedUserLoading } = useAppSelector((state) => state.users);

  // Fetch fresh user details by UID on mount
  useEffect(() => {
    if (userData.uid) {
      dispatch(fetchUserByUid(userData.uid));
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
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-purple-50 text-purple-700 border-purple-200">
                Admin
              </span>
            )}
            {selectedUserLoading && (
              <span className="text-[11px] text-crmText-tertiary italic">Syncing...</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-crmText-secondary">{user.email || '-'}</div>
        </div>
      </div>

      {/* Details Grid - strictly matching backend response fields (uid strictly hidden) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6">
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
            Role
          </div>
          <div className="text-sm font-semibold text-crmText">{roleName}</div>
          {roleSlug && (
            <div className="text-[11px] font-mono text-crmText-tertiary mt-0.5">{roleSlug}</div>
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
    </div>
  );
};

export default UserView;
