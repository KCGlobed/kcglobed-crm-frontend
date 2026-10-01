import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import {
  createRole,
  updateRole,
  updateRolePermissions,
  fetchModules,
  fetchRoles,
  fetchRolePermissions,
  fetchPermissionCatalog,
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

type PermissionAction =
  | 'can_view'
  | 'can_add'
  | 'can_change'
  | 'can_delete'
  | 'can_export'
  | 'can_import'
  | 'can_assign'
  | 'can_approve'
  | 'can_manage';

const ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'can_view', label: 'View' },
  { key: 'can_add', label: 'Add' },
  { key: 'can_change', label: 'Change' },
  { key: 'can_delete', label: 'Delete' },
  { key: 'can_export', label: 'Export' },
  { key: 'can_import', label: 'Import' },
  { key: 'can_assign', label: 'Assign' },
  { key: 'can_approve', label: 'Approve' },
  { key: 'can_manage', label: 'Manage' },
];

const RoleForm: React.FC<RoleFormProps> = ({ roleData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { modules, modulesLoading, rolePermissions, rolePermissionsLoading, catalog, catalogLoading } = useAppSelector(
    (state) => state.roles
  );

  const isEdit = !!roleData;
  const [submitting, setSubmitting] = useState(false);

  // Data scopes from the permission catalog (GET /access/permissions/)
  const scopes = useMemo(
    () => catalog?.scopes || [{ value: 'own', label: 'Own records only' }],
    [catalog]
  );

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

  // Fetch modules + permission catalog once when the modal opens
  useEffect(() => {
    dispatch(fetchModules());
    dispatch(fetchPermissionCatalog());
  }, [dispatch]);

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
            can_delete: Boolean(p.can_delete),
            can_export: Boolean(p.can_export),
            can_import: Boolean(p.can_import),
            can_assign: Boolean(p.can_assign),
            can_approve: Boolean(p.can_approve),
            can_manage: Boolean(p.can_manage),
            data_scope: p.data_scope || 'own',
          };
        }
      });
      setPermissions(initial);
    }
  }, [isEdit, rolePermissions]);

  // The permission catalog is the authoritative module list for the matrix —
  // it includes permission-only modules (e.g. sensitive-data, which controls
  // data masking) that never appear in the menu-driven modules list.
  const availableModules = useMemo(() => {
    const source = catalog?.modules && catalog.modules.length > 0 ? catalog.modules : modules || [];
    return source
      .filter((m) => m.code && m.is_active !== false)
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [catalog, modules]);

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
      const current = prev[code] || { module: code, data_scope: 'own' };
      return { ...prev, [code]: { ...current, [action]: !current[action] } };
    });
  };

  const setScope = (code: string, data_scope: string) => {
    setPermissions((prev) => {
      const current = prev[code] || { module: code };
      return { ...prev, [code]: { ...current, data_scope } };
    });
  };

  const isModuleSelected = (code: string) => ACTIONS.some(({ key }) => isChecked(code, key));

  const toggleModule = (code: string) => {
    setPermissions((prev) => {
      const anyOn = ACTIONS.some(({ key }) => !!prev[code]?.[key]);
      return {
        ...prev,
        [code]: anyOn
          ? { module: code, data_scope: prev[code]?.data_scope || 'own' }
          : { module: code, can_view: true, data_scope: prev[code]?.data_scope || 'own' },
      };
    });
  };

  const buildRow = (code: string): RolePermission => ({
    module: code,
    can_view: isChecked(code, 'can_view'),
    can_add: isChecked(code, 'can_add'),
    can_change: isChecked(code, 'can_change'),
    can_delete: isChecked(code, 'can_delete'),
    can_export: isChecked(code, 'can_export'),
    can_import: isChecked(code, 'can_import'),
    can_assign: isChecked(code, 'can_assign'),
    can_approve: isChecked(code, 'can_approve'),
    can_manage: isChecked(code, 'can_manage'),
    data_scope: permissions[code]?.data_scope || 'own',
  });

  const onSubmit = async (data: RoleFormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && roleData?.id) {
        // Name / description via PATCH (system roles keep their name — backend validates)
        if (!roleData.is_system && (data.name.trim() !== roleData.name || data.description.trim() !== (roleData.description || ''))) {
          await dispatch(
            updateRole({
              id: roleData.id,
              payload: { name: data.name.trim(), description: data.description.trim() },
            })
          ).unwrap();
        }

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
          .map((m) => buildRow(m.code as string));

        await dispatch(
          updateRolePermissions({
            id: roleData.id,
            payload: { permissions: permissionsToUpdate, replace: false },
          })
        ).unwrap();
        toast.success('Role updated successfully');
      } else {
        const cleanedPermissions: RolePermission[] = [];
        availableModules.forEach((m) => {
          const code = m.code as string;
          if (ACTIONS.some(({ key }) => isChecked(code, key))) {
            cleanedPermissions.push(buildRow(code));
          }
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
          autoFocus={!isEdit}
          disabled={isEdit && !!roleData?.is_system}
          className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm disabled:opacity-60 ${
            errors.name
              ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
          }`}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
        )}
        {isEdit && roleData?.is_system && (
          <p className="mt-1 text-[11px] text-crmText-tertiary">System roles cannot be renamed.</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('description', {
            required: 'Description is required',
            minLength: { value: 2, message: 'Description must be at least 2 characters' },
            validate: (val) => val.trim().length > 0 || 'Description cannot be empty or only spaces',
          })}
          placeholder="Brief description of this role..."
          rows={2}
          disabled={isEdit && !!roleData?.is_system}
          className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm resize-y disabled:opacity-60 ${
            errors.description
              ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
          }`}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Module permissions */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Module Permissions ({selectedCount} of {availableModules.length} selected)
        </label>

        <div className="max-h-[300px] overflow-y-auto border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
          {(availableModules.length === 0 && (modulesLoading || catalogLoading)) || (isEdit && rolePermissionsLoading) ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs">
              {availableModules.length === 0 ? 'Loading modules...' : 'Loading permissions...'}
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

                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">Scope</span>
                      <select
                        value={permissions[code]?.data_scope || 'own'}
                        onChange={(e) => setScope(code, e.target.value)}
                        disabled={!moduleSelected}
                        className="px-2 py-1 bg-major border border-crmBorder rounded-lg text-[11px] text-crmText outline-none focus:border-primary transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {scopes.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
            isEdit ? 'Update Role' : 'Create Role'
          )}
        </button>
      </div>
    </form>
  );
};

export default RoleForm;
