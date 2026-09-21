import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { createRole, updateRolePermissions, fetchPermissionsByModule, fetchRoles } from '../../../store/slices/roleSlice';
import toast from 'react-hot-toast';
import type { RoleItem } from '../../../utils/types';

interface RoleFormProps {
  roleData?: RoleItem;
}

const RoleForm: React.FC<RoleFormProps> = ({ roleData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { permissionsByModule, permissionsLoading } = useAppSelector((state) => state.roles);

  const isEdit = !!roleData;

  const [name, setName] = useState(roleData?.name || '');
  const [description, setDescription] = useState(roleData?.description || '');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    roleData?.permission_codes || []
  );
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch permissions by module when modal opens
  useEffect(() => {
    if (!permissionsByModule || permissionsByModule.length === 0) {
      dispatch(fetchPermissionsByModule());
    }
  }, [dispatch, permissionsByModule]);

  const togglePermission = (code: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const toggleModuleAll = (moduleName: string, perms: { code: string }[]) => {
    const codes = perms.map((p) => p.code);
    const allSelected = codes.every((c) => selectedPermissions.includes(c));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !codes.includes(p)));
    } else {
      setSelectedPermissions((prev) => [...new Set([...prev, ...codes])]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Role name is required');
      return;
    }

    setLoading(true);
    try {
      if (isEdit && roleData) {
        await dispatch(updateRolePermissions({ id: roleData.id, permissions: selectedPermissions })).unwrap();
        toast.success('Role permissions updated successfully');
      } else {
        await dispatch(createRole({ name, description, permissions: selectedPermissions })).unwrap();
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

  const filteredModules = (permissionsByModule || [])
    .map((group) => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return group;
      const matching = group.permissions.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term) ||
          group.module.toLowerCase().includes(term)
      );
      return { ...group, permissions: matching };
    })
    .filter((g) => g.permissions.length > 0);

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
            placeholder="e.g. Editor, Manager..."
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

      {/* Permissions search */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Permissions ({selectedPermissions.length} selected)
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search permissions..."
          className="w-full px-3.5 py-2 bg-major border border-crmBorder focus:border-minor rounded-xl text-xs text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
        />
      </div>

      {/* Permissions list by module */}
      <div className="max-h-[300px] overflow-y-auto border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
        {permissionsLoading ? (
          <div className="p-6 text-center text-crmText-tertiary text-xs">
            Loading permissions...
          </div>
        ) : filteredModules.length === 0 ? (
          <div className="p-6 text-center text-crmText-tertiary text-xs">
            No permissions found
          </div>
        ) : (
          filteredModules.map((group) => {
            const allSelected = group.permissions.every((p) =>
              selectedPermissions.includes(p.code)
            );
            return (
              <div key={group.module} className="border-b border-crmBorder last:border-b-0">
                <div
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-major-tint hover:bg-major-muted transition-colors cursor-pointer select-none"
                  onClick={() => toggleModuleAll(group.module, group.permissions)}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    readOnly
                    className="accent-minor h-3.5 w-3.5 rounded"
                  />
                  <span className="text-xs font-bold text-crmText uppercase tracking-wider">
                    {group.module}
                  </span>
                  <span className="text-[10px] font-semibold text-crmText-tertiary ml-auto">
                    {group.permissions.filter((p) => selectedPermissions.includes(p.code)).length}/{group.permissions.length}
                  </span>
                </div>
                <div className="px-3.5 py-1.5 divide-y divide-crmBorder">
                  {group.permissions.map((perm) => (
                    <label
                      key={perm.code}
                      className="flex items-center gap-2 py-1.5 cursor-pointer text-xs text-crmText-secondary hover:text-crmText transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm.code)}
                        onChange={() => togglePermission(perm.code)}
                        className="accent-minor h-3.5 w-3.5 rounded"
                      />
                      <span>{perm.name}</span>
                      <span className="text-[10px] text-crmText-tertiary ml-1">({perm.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
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
