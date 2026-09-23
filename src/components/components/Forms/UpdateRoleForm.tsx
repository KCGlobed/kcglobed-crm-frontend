import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { updateUserRole, fetchUsers, fetchUserByUid } from '../../../store/slices/userSlice';
import { fetchRoles } from '../../../store/slices/roleSlice';
import toast from 'react-hot-toast';
import { RefreshCw, Check } from 'lucide-react';
import type { User, Role } from '../../../utils/types';

interface UpdateRoleFormProps {
  userData: User;
}

type UpdateRoleFormValues = {
  roleId: string;
};

const UpdateRoleForm: React.FC<UpdateRoleFormProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { data: roles, loading: rolesLoading } = useAppSelector((state) => state.roles);
  const { actionLoading } = useAppSelector((state) => state.users);
  const [submitting, setSubmitting] = useState(false);

  const roleList: Role[] = useMemo(() => {
    if (Array.isArray(roles)) return roles;
    if (Array.isArray((roles as any)?.results)) return (roles as any).results;
    if (Array.isArray((roles as any)?.data)) return (roles as any).data;
    return [];
  }, [roles]);

  const initialRoleId = (() => {
    if (typeof userData.role === 'object' && userData.role?.id != null) {
      return String(userData.role.id);
    }
    if (typeof userData.role === 'number' || typeof userData.role === 'string') {
      return String(userData.role);
    }
    return '';
  })();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateRoleFormValues>({
    defaultValues: {
      roleId: initialRoleId,
    },
  });

  // Fetch available roles if not already in store
  useEffect(() => {
    if (!roleList || roleList.length === 0) {
      dispatch(fetchRoles());
    }
  }, [dispatch, roleList]);

  useEffect(() => {
    reset({ roleId: initialRoleId });
  }, [initialRoleId, reset]);

  const fullName =
    [userData.first_name, userData.last_name].filter(Boolean).join(' ') ||
    userData.email ||
    'User';

  const currentRoleName =
    typeof userData.role === 'object' && userData.role
      ? userData.role.name
      : userData.role_name || 'No Role Assigned';

  const onSubmit = async (data: UpdateRoleFormValues) => {
    if (!userData.uid) {
      toast.error('User identifier is missing');
      return;
    }

    const roleObj = roleList.find((r) => String(r.id) === String(data.roleId));

    setSubmitting(true);
    try {
      await dispatch(
        updateUserRole({
          userUid: userData.uid,
          roleId: Number(data.roleId),
          roleObj,
        })
      ).unwrap();

      toast.success('Role updated successfully');
      dispatch(fetchUsers());
      dispatch(fetchUserByUid(userData.uid));
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Target User Summary (UID strictly hidden) */}
      <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-primary-soft border border-primary/20">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white text-base font-bold shadow-sm">
          {(userData.first_name || userData.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-crmText truncate">{fullName}</h4>
            {userData.is_admin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary-soft text-secondary-contrast border border-secondary/30">
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
          <RefreshCw size={13} className="text-secondary" />
          <span>Role</span>
          <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            {...register('roleId', {
              required: 'Please select a role',
            })}
            disabled={rolesLoading || isLoading}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
              errors.roleId
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          >
            <option value="">
              {rolesLoading ? 'Loading available roles...' : 'Select role...'}
            </option>
            {roleList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.is_system ? '(System)' : ''}
              </option>
            ))}
          </select>
        </div>
        {errors.roleId ? (
          <p className="mt-1 text-xs text-red-500">{errors.roleId.message}</p>
        ) : (
          <p className="text-[11px] text-crmText-secondary mt-1.5">
            Updating the role modifies module permissions and access level for this user.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-crmBorder/50">
        <button
          type="button"
          onClick={hideModal}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || rolesLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Updating Role...</span>
            </>
          ) : (
            <>
              <Check size={14} />
              <span>Update Role</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default UpdateRoleForm;
