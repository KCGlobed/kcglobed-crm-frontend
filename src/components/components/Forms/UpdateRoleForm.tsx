import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { updateUserRole, fetchUsers, fetchUserByUid } from '../../../store/slices/userSlice';
import { fetchRoles } from '../../../store/slices/roleSlice';
import toast from 'react-hot-toast';
import { RefreshCw, Check } from 'lucide-react';
import type { User } from '../../../utils/types';

interface UpdateRoleFormProps {
  userData: User;
}

const UpdateRoleForm: React.FC<UpdateRoleFormProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { data: roles, loading: rolesLoading } = useAppSelector((state) => state.roles);
  const { actionLoading } = useAppSelector((state) => state.users);

  // Initialize with the user's current role ID
  const [selectedRoleId, setSelectedRoleId] = useState<string>(() => {
    if (typeof userData.role === 'object' && userData.role?.id != null) {
      return String(userData.role.id);
    }
    if (typeof userData.role === 'number' || typeof userData.role === 'string') {
      return String(userData.role);
    }
    return '';
  });

  // Fetch available roles if not already in store
  useEffect(() => {
    if (!roles || roles.length === 0) {
      dispatch(fetchRoles());
    }
  }, [dispatch, roles]);

  const fullName =
    [userData.first_name, userData.last_name].filter(Boolean).join(' ') ||
    userData.email ||
    'User';

  const currentRoleName =
    typeof userData.role === 'object' && userData.role
      ? userData.role.name
      : userData.role_name || 'No Role Assigned';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userData.uid) {
      toast.error('User identifier is missing');
      return;
    }

    if (!selectedRoleId) {
      toast.error('Please select a role');
      return;
    }

    const roleObj = (roles || []).find((r) => String(r.id) === String(selectedRoleId));

    try {
      await dispatch(
        updateUserRole({
          userUid: userData.uid,
          roleId: Number(selectedRoleId),
          roleObj,
        })
      ).unwrap();

      toast.success('Role updated successfully');
      dispatch(fetchUsers());
      dispatch(fetchUserByUid(userData.uid));
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to update role');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Target User Summary (UID strictly hidden) */}
      <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-minor text-white text-base font-bold shadow-sm">
          {(userData.first_name || userData.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-crmText truncate">{fullName}</h4>
            {userData.is_admin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-crmText-secondary mt-0.5">
            <span className="truncate">{userData.email}</span>
            <span>•</span>
            <span className="font-medium text-crmText">Current: {currentRoleName}</span>
          </div>
        </div>
      </div>

      {/* Role Selection Dropdown */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5 flex items-center gap-1.5">
          <RefreshCw size={13} className="text-minor" />
          <span>Role</span>
          <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            required
            disabled={rolesLoading || actionLoading}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">
              {rolesLoading ? 'Loading available roles...' : 'Select role...'}
            </option>
            {(roles || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.is_system ? '(System)' : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-crmText-secondary mt-1.5">
          Updating the role modifies module permissions and access level for this user.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-crmBorder/50">
        <button
          type="button"
          onClick={hideModal}
          disabled={actionLoading}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={actionLoading || rolesLoading || !selectedRoleId}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none"
        >
          <Check size={14} />
          <span>{actionLoading ? 'Updating Role...' : 'Update Role'}</span>
        </button>
      </div>
    </form>
  );
};

export default UpdateRoleForm;
