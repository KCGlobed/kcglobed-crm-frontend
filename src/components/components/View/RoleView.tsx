import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchRoleById, fetchRolePermissions } from '../../../store/slices/roleSlice';
import { FiCheck, FiMinus } from 'react-icons/fi';
import { ShieldCheck, Users, Layers } from 'lucide-react';
import type { Role, RolePermission } from '../../../utils/types';
import moment from 'moment';

interface RoleViewProps {
  roleData: Role;
}

const ACTIONS: { key: keyof RolePermission; label: string }[] = [
  { key: 'can_view', label: 'View' },
  { key: 'can_add', label: 'Add' },
  { key: 'can_change', label: 'Change' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_export', label: 'Export' },
];

const RoleView: React.FC<RoleViewProps> = ({ roleData }) => {
  const dispatch = useAppDispatch();
  const { selectedRole, rolePermissions, rolePermissionsLoading } = useAppSelector(
    (state) => state.roles
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  useEffect(() => {
    if (roleData.id) {
      dispatch(fetchRoleById(roleData.id));
      dispatch(fetchRolePermissions(roleData.id));
    }
  }, [dispatch, roleData.id]);

  // Show the table row immediately, then refine it with the detail response
  const role = useMemo(
    () => (selectedRole?.id === roleData.id ? { ...roleData, ...selectedRole } : roleData),
    [roleData, selectedRole]
  );

  const fullAccess = !!rolePermissions?.full_access;
  const permissions = useMemo(() => rolePermissions?.permissions || [], [rolePermissions]);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white text-xl font-bold shadow-sm">
          {(role.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{role.name || '-'}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                role.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {role.is_active ? 'Active' : 'Inactive'}
            </span>
            {role.is_system && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-secondary-soft text-secondary-contrast border-secondary/25">
                System
              </span>
            )}
            {role.is_default && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-crmInfo-bg text-crmInfo border-crmInfo-border">
                Default
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{role.slug || '-'}</div>
          <p
            className={`mt-2 text-xs leading-relaxed ${
              role.description ? 'text-crmText-secondary' : 'text-crmText-tertiary italic'
            }`}
          >
            {role.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'Users Assigned', value: role.user_count ?? 0 },
          { icon: Layers, label: 'Modules', value: rolePermissionsLoading ? '—' : fullAccess ? 'All' : permissions.length },
          { icon: ShieldCheck, label: 'Access Level', value: rolePermissionsLoading ? '—' : fullAccess ? 'Full' : 'Custom' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-3 rounded-xl border border-crmBorder bg-major">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={13} strokeWidth={2.5} className="text-minor" />
              <span className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                {label}
              </span>
            </div>
            <div className="text-lg font-bold text-crmText leading-none">{value}</div>
          </div>
        ))}
      </div>

      {/* Permissions */}
      <div>
        <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
          Module Permissions
        </div>

        {rolePermissionsLoading ? (
          <div className="p-8 text-center text-crmText-tertiary text-xs border border-crmBorder rounded-xl bg-major">
            Loading permissions...
          </div>
        ) : fullAccess ? (
          <div className="flex items-center gap-2.5 p-4 rounded-xl border bg-crmSuccess-bg border-crmSuccess-border">
            <ShieldCheck size={18} strokeWidth={2.5} className="text-crmSuccess shrink-0" />
            <div>
              <div className="text-xs font-bold text-crmSuccess">Full Access</div>
              <div className="text-[11px] text-crmText-secondary">
                This role has unrestricted access to every module and action.
              </div>
            </div>
          </div>
        ) : permissions.length === 0 ? (
          <div className="p-8 text-center text-crmText-tertiary text-xs border border-crmBorder rounded-xl bg-major">
            No permissions assigned to this role.
          </div>
        ) : (
          <div className="overflow-x-auto border border-crmBorder rounded-xl bg-major">
            <table className="w-full border-collapse min-w-[520px]">
              <thead>
                <tr className="bg-major-tint border-b border-crmBorder">
                  <th className="text-left px-3.5 py-2.5 text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                    Module
                  </th>
                  {ACTIONS.map(({ key, label }) => (
                    <th
                      key={key as string}
                      className="px-2 py-2.5 text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider text-center w-[72px]"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-crmBorder">
                {permissions.map((perm) => (
                  <tr key={perm.module} className="hover:bg-major-tint transition-colors">
                    <td className="px-3.5 py-2.5">
                      <div className="text-xs font-semibold text-crmText">
                        {perm.module_name || perm.module}
                      </div>
                      <div className="text-[10px] font-mono text-crmText-tertiary">
                        {perm.module}
                      </div>
                    </td>
                    {ACTIONS.map(({ key }) => (
                      <td key={key as string} className="px-2 py-2.5 text-center">
                        {perm[key] ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-crmSuccess-bg text-crmSuccess">
                            <FiCheck size={12} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-major-muted text-crmText-tertiary">
                            <FiMinus size={12} strokeWidth={3} />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-5 pt-1 border-t border-crmBorder">
        <div className="pt-3">
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Created At
          </div>
          <div className="text-xs font-medium text-crmText">{formatDate(role.created_at)}</div>
        </div>
        <div className="pt-3">
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            Updated At
          </div>
          <div className="text-xs font-medium text-crmText">{formatDate(role.updated_at)}</div>
        </div>
      </div>
    </div>
  );
};

export default RoleView;
