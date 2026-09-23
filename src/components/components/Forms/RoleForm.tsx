import React, { useState, useEffect, useMemo } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import {
  createRole,
  updateRolePermissions,
  fetchModules,
  fetchRoles,
  fetchRolePermissions,
} from '../../../store/slices/roleSlice';
import toast from 'react-hot-toast';
import type { Role, RolePermission } from '../../../utils/types';

interface RoleFormProps {
  roleData?: Role;
}

type PermissionAction = 'can_view' | 'can_add' | 'can_change' | 'can_delete' | 'can_export';

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'can_view', label: 'View' },
  { key: 'can_add', label: 'Add' },
  { key: 'can_change', label: 'Change' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_export', label: 'Export' },
];

const RoleForm: React.FC<RoleFormProps> = ({ roleData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { modules, modulesLoading, rolePermissions, rolePermissionsLoading } = useAppSelector(
    (state) => state.roles
  );

  const isEdit = !!roleData;

  const [name, setName] = useState(roleData?.name || '');
  const [description, setDescription] = useState(roleData?.description || '');
  const [loading, setLoading] = useState(false);

  // Selected actions keyed by module code
  const [permissions, setPermissions] = useState<Record<string, RolePermission>>(() => {
    const initial: Record<string, RolePermission> = {};
    (roleData?.permissions || []).forEach((p) => {
      if (p.module) initial[p.module] = p;
    });
    return initial;
  });

  // Fetch modules for the checkbox list when the modal opens
  useEffect(() => {
    if (!modules || modules.length === 0) {
      dispatch(fetchModules());
    }
  }, [dispatch, modules]);

  // When editing, fetch fresh role permissions by ID
  useEffect(() => {
    if (isEdit && roleData?.id) {
      dispatch(fetchRolePermissions(roleData.id));
    }
  }, [dispatch, isEdit, roleData?.id]);

  // Synchronize permissions state once detailed role permissions are loaded
  useEffect(() => {
    if (isEdit && rolePermissions?.permissions) {
      const initial: Record<string, RolePermission> = {};
      rolePermissions.permissions.forEach((p) => {
        if (p.module) {
          initial[p.module] = {
            module: p.module,
            can_view: Boolean(p.can_view),
            can_add: Boolean(p.can_add),
            can_change: Boolean(p.can_change),
            can_export: Boolean(p.can_export),
            can_delete: Boolean(p.can_delete),
          };
        }
      });
      setPermissions(initial);
    }
  }, [isEdit, rolePermissions]);

  // Only active modules are selectable, ordered by the backend's sort_order
  const availableModules = useMemo(
    () =>
      (modules || [])
        .filter((m) => m.code && m.is_active !== false)
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [modules]
  );

  const isChecked = (code: string, action: PermissionAction) => !!permissions[code]?.[action];

  const selectedCount = useMemo(
    () =>
      availableModules.filter((m) =>
        ACTIONS.some(({ key }) => !!permissions[m.code as string]?.[key])
      ).length,
    [availableModules, permissions]
  );

  const toggleAction = (code: string, action: PermissionAction) => {
    setPermissions((prev) => {
      const current = prev[code] || { module: code };
      return { ...prev, [code]: { ...current, [action]: !current[action] } };
    });
  };

  // A module counts as selected while any one of its actions is on
  const isModuleSelected = (code: string) => ACTIONS.some(({ key }) => isChecked(code, key));

  const toggleModule = (code: string) => {
    setPermissions((prev) => {
      const anyOn = ACTIONS.some(({ key }) => !!prev[code]?.[key]);
      // Turning a module on grants View only; turning it off clears every action
      return { ...prev, [code]: anyOn ? { module: code } : { module: code, can_view: true } };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Role name is required');
      return;
    }

    setLoading(true);
    try {
      if (isEdit && roleData?.id) {
        // Collect modules that either have active permissions or were previously assigned
        const initialModules = new Set(
          (rolePermissions?.permissions || roleData?.permissions || [])
            .map((p) => p.module)
            .filter(Boolean)
        );

        const permissionsToUpdate = availableModules
          .filter((m) => {
            const code = m.code as string;
            const hasAnySelected = ACTIONS.some(({ key }) => isChecked(code, key));
            return hasAnySelected || initialModules.has(code);
          })
          .map((m) => {
            const code = m.code as string;
            return {
              module: code,
              can_view: isChecked(code, 'can_view'),
              can_add: isChecked(code, 'can_add'),
              can_change: isChecked(code, 'can_change'),
              can_export: isChecked(code, 'can_export'),
              can_delete: isChecked(code, 'can_delete'),
            };
          });

        const payload = {
          permissions: permissionsToUpdate,
          replace: false,
        };

        await dispatch(
          updateRolePermissions({
            id: roleData.id,
            payload,
          })
        ).unwrap();
        toast.success('Role permissions updated successfully');
      } else {
        const cleanedPermissions: RolePermission[] = [];
        availableModules.forEach((m) => {
          const code = m.code as string;
          const row: RolePermission = { module: code };
          let hasAny = false;
          ACTIONS.forEach(({ key }) => {
            if (isChecked(code, key)) {
              row[key] = true;
              hasAny = true;
            }
          });
          if (hasAny) cleanedPermissions.push(row);
        });

        await dispatch(
          createRole({ name, description, permissions: cleanedPermissions })
        ).unwrap();
        toast.success('Role created successfully');
      }
      dispatch(fetchRoles());
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Role Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Counsellor, Manager..."
            required
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
          />
        </div>
      )}

      {/* Description */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this role..."
            rows={3}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm resize-y"
          />
        </div>
      )}

      {/* Module permissions */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Module Permissions ({selectedCount} of {availableModules.length} selected)
        </label>

        <div className="max-h-[300px] overflow-y-auto border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
          {modulesLoading || (isEdit && rolePermissionsLoading) ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs">
              {modulesLoading ? 'Loading modules...' : 'Loading permissions...'}
            </div>
          ) : availableModules.length === 0 ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs">
              No modules found
            </div>
          ) : (
            availableModules.map((m) => {
              const code = m.code as string;
              const moduleSelected = isModuleSelected(code);
              return (
                <div key={m.id ?? code} className="px-3.5 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none min-w-[150px]">
                      <input
                        type="checkbox"
                        checked={moduleSelected}
                        onChange={() => toggleModule(code)}
                        className="accent-minor h-3.5 w-3.5 rounded"
                      />
                      <span className="text-xs font-bold text-crmText">{m.name}</span>
                      <span className="text-[10px] font-mono text-crmText-tertiary">
                        {code}
                      </span>
                    </label>

                    <div className="flex items-center gap-3 ml-auto">
                      {ACTIONS.map(({ key, label }) => (
                        <label
                          key={key}
                          className="flex items-center gap-1.5 cursor-pointer text-xs text-crmText-secondary hover:text-crmText transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked(code, key)}
                            onChange={() => toggleAction(code, key)}
                            className="accent-minor h-3.5 w-3.5 rounded"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {m.description && (
                    <p className="mt-1 text-[11px] text-crmText-tertiary line-clamp-1">
                      {m.description}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={hideModal}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none"
        >
          {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Permissions' : 'Create Role')}
        </button>
      </div>
    </form>
  );
};

export default RoleForm;
