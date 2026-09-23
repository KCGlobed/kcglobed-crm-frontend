import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
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

type RoleFormValues = {
  name: string;
  description: string;
};

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
  const [submitting, setSubmitting] = useState(false);

  // Selected actions keyed by module code
  const [permissions, setPermissions] = useState<Record<string, RolePermission>>(() => {
    const initial: Record<string, RolePermission> = {};
    (roleData?.permissions || []).forEach((p) => {
      if (p.module) initial[p.module] = p;
    });
    return initial;
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RoleFormValues>({
    defaultValues: {
      name: roleData?.name || '',
      description: roleData?.description || '',
    },
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

  useEffect(() => {
    if (roleData) {
      reset({
        name: roleData.name || '',
        description: roleData.description || '',
      });
    }
  }, [roleData, reset]);

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

  const isModuleSelected = (code: string) => ACTIONS.some(({ key }) => isChecked(code, key));

  const toggleModule = (code: string) => {
    setPermissions((prev) => {
      const anyOn = ACTIONS.some(({ key }) => !!prev[code]?.[key]);
      return { ...prev, [code]: anyOn ? { module: code } : { module: code, can_view: true } };
    });
  };

  const onSubmit = async (data: RoleFormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && roleData?.id) {
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
          createRole({
            name: data.name.trim(),
            description: data.description.trim(),
            permissions: cleanedPermissions,
          })
        ).unwrap();
        toast.success('Role created successfully');
      }
      dispatch(fetchRoles());
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to save role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Role Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name', {
              required: 'Role name is required',
              minLength: { value: 2, message: 'Role name must be at least 2 characters' },
              validate: (val) => val.trim().length > 0 || 'Role name cannot be empty or only spaces',
            })}
            placeholder="e.g. Counsellor, Manager..."
            autoFocus
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>
      )}

      {/* Description */}
      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Description
          </label>
          <textarea
            {...register('description')}
            placeholder="Brief description of this role..."
            rows={3}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm resize-y ${
              errors.description
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
          )}
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
                        className="accent-primary h-3.5 w-3.5 rounded"
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
                            className="accent-primary h-3.5 w-3.5 rounded"
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
      <div className="flex justify-end gap-3 pt-2 border-t border-crmBorder">
        <button
          type="button"
          onClick={hideModal}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>{isEdit ? 'Updating...' : 'Creating...'}</span>
            </>
          ) : (
            isEdit ? 'Update Permissions' : 'Create Role'
          )}
        </button>
      </div>
    </form>
  );
};

export default RoleForm;
