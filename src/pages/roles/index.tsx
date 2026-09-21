import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import {
  fetchRoles,
  fetchPermissionsByModule,
  createRole,
  updateRolePermissions,
  updateRoleStatus,
  deleteRole,
} from '../../store/slices/roleSlice';
import type { RoleItem, PermissionDetail } from '../../utils/types';

export const RolesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { data: roles, loading, error, permissionsByModule, permissionsLoading } = useAppSelector((state) => state.roles);
  const { baseUrl } = useAppSelector((state) => state.auth);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [inspectRole, setInspectRole] = useState<RoleItem | null>(null);
  const [activeRole, setActiveRole] = useState<RoleItem | null>(null);
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  // Form states matching exact API payload { name, description, permissions }
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalPermSearch, setModalPermSearch] = useState('');
  const [successToast, setSuccessToast] = useState<{ message: string; roleId?: number } | null>(null);
  const [highlightedRoleId, setHighlightedRoleId] = useState<number | null>(null);

  // Delete modal state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingRoleId, setTogglingRoleId] = useState<number | null>(null);

  // Fetch roles from API on mount (do NOT call /api/permissions/by-module/ on roles page)
  useEffect(() => {
    dispatch(fetchRoles());
  }, [dispatch]);

  // Permissions catalogue derived from roles (and populated further when by-module is opened)
  const allPermissionsCatalogue = useMemo(() => {
    const map = new Map<string, PermissionDetail>();
    (roles || []).forEach((r) => {
      (r.permissions_detail || []).forEach((pd) => {
        if (pd && pd.code && !map.has(pd.code)) {
          map.set(pd.code, pd);
        }
      });
    });
    (permissionsByModule || []).forEach((group) => {
      (group.permissions || []).forEach((p) => {
        if (p && p.code && !map.has(p.code)) {
          map.set(p.code, p);
        }
      });
    });
    return Array.from(map.values());
  }, [roles, permissionsByModule]);

  const moduleNames = useMemo(() => {
    const set = new Set<string>();
    (roles || []).forEach((r) => {
      (r.permissions_detail || []).forEach((pd) => {
        if (pd?.module) set.add(pd.module);
      });
    });
    (permissionsByModule || []).forEach((g) => {
      if (g?.module) set.add(g.module);
    });
    return Array.from(set).sort();
  }, [roles, permissionsByModule]);

  // Filter permissions inside Create/Edit modal from /api/permissions/by-module/ data
  const modalModulesGrouped = useMemo(() => {
    const term = modalPermSearch.toLowerCase().trim();
    if (!term) return permissionsByModule || [];

    return (permissionsByModule || [])
      .map((group) => {
        const matching = (group.permissions || []).filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.code.toLowerCase().includes(term) ||
            p.description.toLowerCase().includes(term) ||
            group.module.toLowerCase().includes(term)
        );
        return {
          module: group.module,
          permissions: matching,
        };
      })
      .filter((group) => group.permissions.length > 0);
  }, [permissionsByModule, modalPermSearch]);

  // Filtered roles based on search and module
  const filteredRoles = (roles || []).filter((role) => {
    if (!role) return false;
    const term = searchTerm.toLowerCase();
    const matchName = (role.name || '').toLowerCase().includes(term);
    const matchSlug = (role.slug || '').toLowerCase().includes(term);
    const matchDesc = (role.description || '').toLowerCase().includes(term);
    const matchPerm = Array.isArray(role.permission_codes) && role.permission_codes.some((p) => typeof p === 'string' && p.toLowerCase().includes(term));
    const matchesSearch = matchName || matchSlug || matchDesc || matchPerm;

    if (selectedModuleFilter === 'ALL') return matchesSearch;
    const hasModulePerm = Array.isArray(role.permissions_detail) && role.permissions_detail.some((pd) => pd?.module === selectedModuleFilter);
    return matchesSearch && hasModulePerm;
  });

  // Group permissions specifically for the active inspected role
  const inspectedPermissionsGrouped = useMemo(() => {
    if (!inspectRole) return {};
    const detailMap = new Map<string, PermissionDetail>();

    // 1. Add detailed objects from role if present
    if (Array.isArray(inspectRole.permissions_detail)) {
      inspectRole.permissions_detail.forEach((pd) => {
        if (pd && pd.code) detailMap.set(pd.code, pd);
      });
    }

    // 2. Resolve any remaining permission_codes from permissionsByModule
    const catalogueMap = new Map<string, PermissionDetail>();
    (permissionsByModule || []).forEach((g) => {
      (g.permissions || []).forEach((p) => {
        catalogueMap.set(p.code, p);
      });
    });

    (inspectRole.permission_codes || []).forEach((code) => {
      if (!detailMap.has(code)) {
        const found = catalogueMap.get(code);
        if (found) {
          detailMap.set(code, found);
        } else {
          const parts = code.split('.');
          const mod = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          detailMap.set(code, {
            id: Math.random(),
            code,
            name: parts.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
            module: mod,
            description: `Privilege access for ${code}`,
          });
        }
      }
    });

    // Group by module with live search filter
    const groups: Record<string, PermissionDetail[]> = {};
    detailMap.forEach((pd) => {
      const term = inspectorSearch.toLowerCase().trim();
      const match =
        !term ||
        pd.name.toLowerCase().includes(term) ||
        pd.code.toLowerCase().includes(term) ||
        pd.description.toLowerCase().includes(term) ||
        pd.module.toLowerCase().includes(term);

      if (match) {
        const mod = pd.module || 'General';
        if (!groups[mod]) groups[mod] = [];
        groups[mod].push(pd);
      }
    });

    return groups;
  }, [inspectRole, permissionsByModule, inspectorSearch]);

  // Open Create Modal
  const handleOpenCreate = () => {
    dispatch(fetchPermissionsByModule());
    setFormData({
      name: '',
      description: '',
      permissions: [],
    });
    setModalError(null);
    setModalPermSearch('');
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (role: RoleItem) => {
    dispatch(fetchPermissionsByModule());
    setActiveRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: [...(role.permission_codes || [])],
    });
    setModalError(null);
    setModalPermSearch('');
    setIsEditOpen(true);
  };

  // Open Delete Confirmation
  const handleOpenDelete = (role: RoleItem) => {
    setActiveRole(role);
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  // Open Permissions Detailed Inspector
  const handleInspectPermissions = (role: RoleItem) => {
    setInspectRole(role);
    setInspectorSearch('');
    setCollapsedModules({});
  };

  // Toggle individual permission code
  const handleTogglePermission = (code: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(code);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== code)
          : [...prev.permissions, code],
      };
    });
  };

  // Toggle entire module category
  const handleToggleModule = (modulePermissions: PermissionDetail[]) => {
    const moduleCodes = modulePermissions.map((p) => p.code);
    const allSelected = moduleCodes.every((c) => formData.permissions.includes(c));

    setFormData((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((c) => !moduleCodes.includes(c))
        : Array.from(new Set([...prev.permissions, ...moduleCodes])),
    }));
  };

  // Handle Create Submit via POST {{baseUrl}}/api/roles/
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setModalError('Role name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      const result = await dispatch(
        createRole({
          name: formData.name.trim(),
          description: formData.description.trim(),
          permissions: formData.permissions,
        })
      ).unwrap();

      setIsCreateOpen(false);
      setHighlightedRoleId(result.id);
      setSuccessToast({
        message: `Role "${result.name}" (ID #${result.id}) created successfully with ${result.permission_codes?.length || 0} permissions!`,
        roleId: result.id,
      });

      // Auto-clear highlight and toast
      setTimeout(() => setHighlightedRoleId(null), 5000);
      setTimeout(() => setSuccessToast(null), 8000);
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : 'Failed to create role on server.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Submit via PATCH {{baseUrl}}/api/roles/{id}/
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRole) {
      setModalError('Role not found.');
      return;
    }

    try {
      setIsSubmitting(true);
      setModalError(null);

      const result = await dispatch(
        updateRolePermissions({
          id: activeRole.id,
          permissions: formData.permissions,
        })
      ).unwrap();

      setIsEditOpen(false);
      setActiveRole(null);
      setHighlightedRoleId(result.id);
      setSuccessToast({
        message: `Role "${result.name}" permissions updated successfully (PATCH /api/roles/${result.id}/)!`,
        roleId: result.id,
      });

      setTimeout(() => setHighlightedRoleId(null), 5000);
      setTimeout(() => setSuccessToast(null), 8000);
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : 'Failed to update role permissions on server.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Submit via DELETE {{baseUrl}}/api/roles/{id}/
  const handleDeleteConfirm = async () => {
    if (!activeRole) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const deletedId = activeRole.id;
      const deletedName = activeRole.name;

      await dispatch(deleteRole(deletedId)).unwrap();

      setIsDeleteOpen(false);
      setActiveRole(null);
      setSuccessToast({
        message: `Role "${deletedName}" was successfully deleted (DELETE /api/roles/${deletedId}/).`,
      });
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : 'Failed to delete role on server.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Toggle Role Status (Deactivate / Reactivate) via PATCH {{baseUrl}}/api/roles/{id}/
  const handleToggleStatus = async (role: RoleItem) => {
    if (role.is_system) return;
    const nextStatus = !role.is_active;

    try {
      setTogglingRoleId(role.id);
      const result = await dispatch(
        updateRoleStatus({
          id: role.id,
          is_active: nextStatus,
        })
      ).unwrap();

      setSuccessToast({
        message: `Role "${result.name}" is now ${result.is_active ? 'Active' : 'Deactivated'} (PATCH /api/roles/${result.id}/ with { is_active: ${result.is_active} }).`,
        roleId: result.id,
      });
      setTimeout(() => setSuccessToast(null), 6000);
    } catch (err: unknown) {
      const msg = typeof err === 'string' ? err : 'Failed to update role status on server.';
      alert(msg);
    } finally {
      setTogglingRoleId(null);
    }
  };

  const totalPermissionsAvailable = allPermissionsCatalogue.length || 47;
  const totalAssignedUsers = (roles || []).reduce((sum, r) => sum + (r?.user_count || 0), 0);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div className="flex flex-col">
          <div className="inline-flex items-center gap-2 mb-1.5">
            <span className="text-[0.8rem] font-bold text-minor-contrast bg-minor-soft px-2.5 py-1 rounded">
              API: {baseUrl}/api/roles/
            </span>
            {loading && (
              <span className="text-xs text-crmTextSecondary inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-minor border-t-transparent animate-spin" />
                Syncing roles...
              </span>
            )}
          </div>
          <h2 className="font-heading text-[1.75rem] font-bold text-crmText">Roles & Permission Management</h2>
          <p className="text-crmTextSecondary text-[0.92rem] mt-1">Configure operational access levels, lead visibility rules, and module privileges.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary font-semibold text-sm transition-all shadow-sm cursor-pointer"
            onClick={() => dispatch(fetchRoles())}
            title="Refresh roles from API"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-minor hover:bg-minor-hover text-white font-semibold text-sm transition-all shadow-accent active:scale-[0.98] cursor-pointer"
            onClick={handleOpenCreate}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Create New Role</span>
          </button>
        </div>
      </div>

      {/* Success Notification Toast */}
      {successToast && (
        <div className="mb-5 flex items-center justify-between p-4 rounded-xl bg-crmSuccess-bg border border-crmSuccess-border text-crmSuccess shadow-[0_4px_12px_rgba(16,185,129,0.15)]">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold text-crmSuccess">
              ✓
            </div>
            <div>
              <strong className="text-sm font-bold block">Operation Successful</strong>
              <div className="text-xs text-crmSuccess">{successToast.message}</div>
            </div>
          </div>
          <button
            type="button"
            className="text-xl text-crmSuccess hover:text-crmSuccess p-1 cursor-pointer bg-transparent"
            onClick={() => setSuccessToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Backend Notification Banner if error occurs */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-crmDanger-bg border border-crmDanger-border text-crmDanger">
          <div className="text-lg">⚠️</div>
          <div>
            <strong className="block font-bold text-sm">Server Sync Notice</strong>
            <div className="text-xs text-crmDanger">{error}</div>
            <div className="text-[11px] text-crmDanger mt-1 opacity-85">
              Showing active cached/synchronized role records.
            </div>
          </div>
        </div>
      )}

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-major border border-crmBorder rounded-2xl p-5 px-6 shadow-sm flex items-center gap-5 hover:-translate-y-0.5 hover:shadow-md hover:border-minor/25 transition-all">
          <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 bg-minor-soft text-minor-contrast">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <circle cx="12" cy="11" r="3"></circle>
            </svg>
          </div>
          <div>
            <div className="font-heading text-2xl font-bold text-crmText">{(roles || []).length}</div>
            <div className="text-xs text-crmTextSecondary font-medium">Total System Roles</div>
          </div>
        </div>

        <div className="bg-major border border-crmBorder rounded-2xl p-5 px-6 shadow-sm flex items-center gap-5 hover:-translate-y-0.5 hover:shadow-md hover:border-minor/25 transition-all">
          <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 bg-crmSuccess-bg text-crmSuccess">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div>
            <div className="font-heading text-2xl font-bold text-crmText">{totalAssignedUsers}</div>
            <div className="text-xs text-crmTextSecondary font-medium">Active Assigned Users</div>
          </div>
        </div>

        <div className="bg-major border border-crmBorder rounded-2xl p-5 px-6 shadow-sm flex items-center gap-5 hover:-translate-y-0.5 hover:shadow-md hover:border-minor/25 transition-all">
          <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 bg-[#eef2ff] text-minor-contrast">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div>
            <div className="font-heading text-2xl font-bold text-crmText">{totalPermissionsAvailable}</div>
            <div className="text-xs text-crmTextSecondary font-medium">Total Permission Codes</div>
          </div>
        </div>

        <div className="bg-major border border-crmBorder rounded-2xl p-5 px-6 shadow-sm flex items-center gap-5 hover:-translate-y-0.5 hover:shadow-md hover:border-minor/25 transition-all">
          <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 bg-crmWarning-bg text-crmWarning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </div>
          <div>
            <div className="font-heading text-2xl font-bold text-crmText">{moduleNames.length || 11}</div>
            <div className="text-xs text-crmTextSecondary font-medium">Security Modules</div>
          </div>
        </div>
      </div>

      {/* Search and Module Filter Toolbar */}
      <div className="bg-major border border-crmBorder rounded-2xl p-4 px-6 mb-6 flex items-center justify-between flex-wrap gap-4 shadow-sm">
        <div className="relative min-w-[300px] flex-1 max-w-[480px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-crmTextTertiary pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 border border-crmBorder rounded-xl text-sm outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
            placeholder="Search roles by name, slug (e.g. counselor), description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="px-4 py-2.5 border border-crmBorder rounded-xl text-sm outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 bg-major"
            value={selectedModuleFilter}
            onChange={(e) => setSelectedModuleFilter(e.target.value)}
          >
            <option value="ALL">All Modules ({moduleNames.length})</option>
            {moduleNames.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>

          <span className="text-xs text-crmTextSecondary">
            Showing <strong className="text-crmText">{filteredRoles.length}</strong> of {(roles || []).length} roles
          </span>
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-major border border-crmBorder rounded-2xl shadow-md overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="bg-crmBgTint px-6 py-4 text-xs font-bold uppercase tracking-wider text-crmTextSecondary border-b border-crmBorder w-[28%]">Role & Slug</th>
              <th className="bg-crmBgTint px-6 py-4 text-xs font-bold uppercase tracking-wider text-crmTextSecondary border-b border-crmBorder w-[28%]">Description</th>
              <th className="bg-crmBgTint px-6 py-4 text-xs font-bold uppercase tracking-wider text-crmTextSecondary border-b border-crmBorder w-[16%]">Permission Codes</th>
              <th className="bg-crmBgTint px-6 py-4 text-xs font-bold uppercase tracking-wider text-crmTextSecondary border-b border-crmBorder w-[12%]">Status & Users</th>
              <th className="bg-crmBgTint px-6 py-4 text-xs font-bold uppercase tracking-wider text-crmTextSecondary border-b border-crmBorder w-[16%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoles.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-crmTextSecondary">
                  No roles match your search criteria.
                </td>
              </tr>
            ) : (
              filteredRoles.map((role) => {
                const permCount = role.permission_codes ? role.permission_codes.length : 0;
                return (
                  <tr
                    key={role.id}
                    className={`hover:bg-crmBgTint/50 transition-colors ${
                      highlightedRoleId === role.id ? 'bg-minor-subtle' : ''
                    }`}
                  >
                    <td className="px-6 py-4 border-b border-crmBorder align-middle text-[0.88rem]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-crmText text-[0.95rem]">{role.name}</span>
                          <span className="font-mono text-xs bg-crmBgTint text-minor-contrast px-1.5 py-0.5 rounded border border-crmBorder">
                            #{role.slug}
                          </span>
                          {role.is_system && <span className="bg-minor-soft text-minor-contrast border border-minor/20 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">System</span>}
                        </div>
                        <div className="text-xs text-crmTextTertiary mt-0.5">
                          ID: {role.id} • Created: {role.created_at ? new Date(role.created_at).toLocaleDateString() : 'Recently'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 border-b border-crmBorder align-middle text-[0.88rem]">
                      <p className="text-xs text-crmTextSecondary max-w-[380px] leading-relaxed">
                        {role.description || 'No specific description documented.'}
                      </p>
                    </td>
                    <td className="px-6 py-4 border-b border-crmBorder align-middle text-[0.88rem]">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#fbf0fa] text-minor-contrast border border-minor/20 hover:bg-minor-soft transition-all cursor-pointer"
                        onClick={() => handleInspectPermissions(role)}
                        title="Click to view full permission matrix & detailed descriptions"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        <span>{permCount} Privileges</span>
                      </button>
                    </td>
                    <td className="px-6 py-4 border-b border-crmBorder align-middle text-[0.88rem]">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => !role.is_system && handleToggleStatus(role)}
                          disabled={togglingRoleId === role.id || role.is_system}
                          title={
                            role.is_system
                              ? 'System role status is fixed'
                              : role.is_active
                              ? 'Click to Deactivate (PATCH { is_active: false })'
                              : 'Click to Reactivate (PATCH { is_active: true })'
                          }
                          className="bg-transparent border-none p-0 text-left cursor-pointer inline-flex items-center disabled:cursor-default"
                        >
                          <span
                            className={`text-[11px] font-bold inline-flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all ${
                              role.is_active
                                ? 'text-crmSuccess bg-crmSuccess-bg border-crmSuccess-border'
                                : 'text-crmDanger bg-crmDanger-bg border-crmDanger-border'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                role.is_active ? 'bg-crmSuccess' : 'bg-crmDanger'
                              }`}
                            />
                            {role.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </button>
                        <span className="text-xs text-crmTextSecondary">
                          <strong>{role.user_count ?? 0}</strong> staff assigned
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 border-b border-crmBorder align-middle text-[0.88rem] text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-xs font-semibold text-crmTextSecondary transition-all cursor-pointer disabled:opacity-40"
                          onClick={() => handleToggleStatus(role)}
                          disabled={togglingRoleId === role.id || role.is_system}
                          title={
                            role.is_system
                              ? 'System role status cannot be modified'
                              : role.is_active
                              ? 'Deactivate Role (PATCH /api/roles/{id}/ { is_active: false })'
                              : 'Reactivate Role (PATCH /api/roles/{id}/ { is_active: true })'
                          }
                        >
                          {togglingRoleId === role.id ? (
                            <span className="w-3 h-3 rounded-full border-2 border-minor border-t-transparent animate-spin" />
                          ) : role.is_active ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                          )}
                          {role.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-crmBorder bg-major hover:bg-minor-soft hover:text-minor-contrast hover:border-minor/35 text-xs font-semibold text-crmTextSecondary transition-all cursor-pointer"
                          onClick={() => handleOpenEdit(role)}
                          title="Edit Role & Assigned Permissions"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                          Edit
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-crmBorder bg-major hover:bg-crmDanger-bg hover:text-crmDanger hover:border-crmDanger-border text-xs font-semibold text-crmTextSecondary transition-all cursor-pointer disabled:opacity-40"
                          onClick={() => handleOpenDelete(role)}
                          disabled={role.is_system}
                          title={role.is_system ? 'System role cannot be deleted' : 'Delete Role'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ======================================================================
          CREATE & EDIT ROLE MODAL
         ====================================================================== */}
      {(isCreateOpen || isEditOpen) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => {
            if (!isSubmitting) {
              setIsCreateOpen(false);
              setIsEditOpen(false);
            }
          }}
        >
          <div
            className="max-w-[820px] w-full h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden bg-major rounded-2xl shadow-[0_25px_50px_-12px_rgba(91,33,182,0.25),0_0_0_1px_rgba(160,63,153,0.15)] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 px-7 border-b border-crmBorder bg-gradient-to-b from-major to-crmBgTint flex items-center justify-between m-0 shrink-0">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="m-0 text-xl font-bold text-crmText flex items-center gap-2">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-minor-contrast">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    {isCreateOpen ? 'Create New Role' : `Edit Role: ${activeRole?.name}`}
                  </h3>
                  <span className="text-[11px] bg-minor-soft text-minor-contrast px-2 py-0.5 rounded font-bold font-mono">
                    {isCreateOpen ? 'POST /api/roles/' : `PATCH /api/roles/${activeRole?.id}/`}
                  </span>
                </div>
                <p className="text-xs text-crmTextSecondary mt-1 m-0">
                  {isCreateOpen
                    ? 'Define role name, description, and assign granted permission codes.'
                    : `Update permission codes for ${activeRole?.name} via PATCH /api/roles/${activeRole?.id}/.`}
                </p>
              </div>

              <button
                type="button"
                className="text-crmText-tertiary hover:text-crmText text-2xl font-bold leading-none p-1 cursor-pointer bg-transparent transition-colors"
                onClick={() => {
                  if (!isSubmitting) {
                    setIsCreateOpen(false);
                    setIsEditOpen(false);
                  }
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form className="flex flex-col flex-1 min-h-0 overflow-hidden" onSubmit={isCreateOpen ? handleCreateSubmit : handleEditSubmit}>
              <div className="flex-1 min-h-0 overflow-y-auto p-6 px-7 flex flex-col gap-5 bg-major">
                {/* Inline Error Alert if any */}
                {modalError && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-crmDanger-bg border border-crmDanger-border text-crmDanger m-0">
                    <div className="text-base">⚠️</div>
                    <div>
                      <strong className="block text-xs font-bold">Submission Error</strong>
                      <div className="text-xs text-crmDanger">{modalError}</div>
                    </div>
                  </div>
                )}

                {/* Form Fields: Role Name & Description */}
                <div className="flex flex-col m-0">
                  <label className="font-semibold text-xs mb-1.5 flex justify-between text-crmText">
                    <span>
                      Role Name <span className="text-crmDanger">*</span>
                    </span>
                    <span className="text-[11px] text-crmTextTertiary">e.g. Front Desk 585</span>
                  </label>
                  <input
                    type="text"
                    className="w-full h-11 px-4 rounded-lg border border-crmBorder bg-major text-crmText text-sm font-medium focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                    placeholder="e.g. Front Desk 585"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (modalError) setModalError(null);
                    }}
                    required
                  />
                </div>

                <div className="flex flex-col m-0">
                  <label className="font-semibold text-xs mb-1.5 flex justify-between text-crmText">
                    <span>Role Description</span>
                    <span className="text-[11px] text-crmTextTertiary">Scope and pipeline visibility</span>
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 rounded-lg border border-crmBorder bg-major text-crmText text-sm h-16 resize-y focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                    placeholder="e.g. Walk-in reception: logs leads, cannot see the pipeline."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Permission Selection Matrix */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-crmText m-0">
                        Assign Permissions ({formData.permissions.length}/{totalPermissionsAvailable})
                      </h4>
                      <p className="text-xs text-crmTextSecondary mt-0.5 m-0">
                        Selected codes will be transmitted in the <code className="text-minor-contrast font-mono">permissions</code> array.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-1 text-xs font-semibold rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary cursor-pointer transition-all"
                        onClick={() => {
                          const allCodes = allPermissionsCatalogue.map((p) => p.code);
                          setFormData({ ...formData, permissions: allCodes });
                        }}
                      >
                        Select All ({totalPermissionsAvailable})
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 text-xs font-semibold rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary cursor-pointer transition-all"
                        onClick={() => setFormData({ ...formData, permissions: [] })}
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Search Permissions */}
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-crmTextTertiary pointer-events-none"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      type="text"
                      className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-crmBorder bg-major text-crmText text-xs focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                      placeholder="Filter permissions by code or title (e.g. leads.create, notes, interview)..."
                      value={modalPermSearch}
                      onChange={(e) => setModalPermSearch(e.target.value)}
                    />
                  </div>

                  {/* Modules Accordion */}
                  <div className="flex flex-col gap-3">
                    {permissionsLoading && permissionsByModule.length === 0 ? (
                      <div className="p-8 text-center text-crmTextSecondary bg-major rounded-xl border border-crmBorder">
                        <div className="w-6 h-6 rounded-full border-2 border-minor border-t-transparent animate-spin mx-auto mb-3" />
                        <div className="font-semibold text-sm text-minor-contrast">
                          Loading permissions from API...
                        </div>
                        <div className="text-xs text-crmTextTertiary mt-1">
                          Connecting to <code>GET {baseUrl}/api/permissions/by-module/</code>
                        </div>
                      </div>
                    ) : !permissionsLoading && permissionsByModule.length === 0 ? (
                      <div className="p-6 text-center bg-crmDanger-bg rounded-xl border border-crmDanger-border">
                        <p className="text-crmDanger font-semibold text-sm mb-1">
                          Could not load permissions from server
                        </p>
                        <p className="text-xs text-crmTextSecondary mb-3">
                          Failed to fetch from <code>GET {baseUrl}/api/permissions/by-module/</code>
                        </p>
                        <button
                          type="button"
                          className="px-4 py-1.5 rounded-lg bg-minor hover:bg-minor-hover text-white font-semibold text-xs shadow-sm cursor-pointer"
                          onClick={() => dispatch(fetchPermissionsByModule())}
                        >
                          Retry API Request
                        </button>
                      </div>
                    ) : modalModulesGrouped.length === 0 ? (
                      <div className="p-6 text-center text-crmTextSecondary text-sm bg-major rounded-xl border border-dashed border-crmBorder">
                        No permissions found matching &quot;{modalPermSearch}&quot;.
                      </div>
                    ) : (
                      modalModulesGrouped.map((group) => {
                        const moduleName = group.module;
                        const moduleItems = group.permissions || [];
                        const allSelected = moduleItems.length > 0 && moduleItems.every((item) => formData.permissions.includes(item.code));
                        const someSelected = moduleItems.some((item) => formData.permissions.includes(item.code));
                        const selectedCount = moduleItems.filter((i) => formData.permissions.includes(i.code)).length;

                        return (
                          <div key={moduleName} className="border border-crmBorder rounded-xl overflow-hidden bg-major shadow-sm">
                            <div className="bg-crmBgTint px-5 py-3 flex items-center justify-between border-b border-crmBorder">
                              <span className="text-sm font-bold text-crmText flex items-center gap-2">
                                <span className="text-minor-contrast font-extrabold">•</span>
                                <span>{moduleName}</span>
                                <span className="text-xs text-crmTextTertiary font-medium">
                                  ({selectedCount}/{moduleItems.length})
                                </span>
                              </span>

                              <button
                                type="button"
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary cursor-pointer transition-all"
                                onClick={() => handleToggleModule(moduleItems)}
                              >
                                {allSelected ? 'Deselect Module' : someSelected ? 'Select Remaining' : 'Select Module'}
                              </button>
                            </div>

                            <div className="p-4 px-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {moduleItems.map((perm) => {
                                const isChecked = formData.permissions.includes(perm.code);
                                return (
                                  <label
                                    key={perm.code}
                                    className={`flex items-center gap-2.5 text-xs text-crmTextSecondary cursor-pointer select-none p-2.5 rounded-lg border transition-all ${
                                      isChecked ? 'bg-minor-soft border-minor/30 text-minor-contrast font-semibold' : 'border-crmBorder/40 hover:border-crmBorder bg-major'
                                    }`}
                                    title={perm.description}
                                  >
                                    <input
                                      type="checkbox"
                                      className="rounded border-crmBorder text-minor-contrast focus:ring-minor"
                                      checked={isChecked}
                                      onChange={() => handleTogglePermission(perm.code)}
                                    />
                                    <div className="flex flex-col min-w-0">
                                      <span className={`truncate text-xs ${isChecked ? 'font-bold text-minor-contrast' : 'font-medium text-crmText'}`}>
                                        {perm.name}
                                      </span>
                                      <span className="text-[10px] text-crmTextTertiary font-mono truncate">
                                        {perm.code}
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-7 border-t border-crmBorder flex items-center justify-between shrink-0 bg-crmBgTint m-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-minor-contrast">
                    {formData.permissions.length}
                  </span>
                  <span className="text-xs text-crmTextSecondary">
                    permissions selected
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="px-5 py-2.5 rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary font-semibold text-sm transition-all cursor-pointer"
                    onClick={() => {
                      if (!isSubmitting) {
                        setIsCreateOpen(false);
                        setIsEditOpen(false);
                      }
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-lg bg-minor hover:bg-minor-hover text-white font-semibold text-sm transition-all shadow-accent cursor-pointer flex items-center gap-2 active:scale-[0.98] disabled:opacity-50"
                    disabled={isSubmitting || !formData.name.trim()}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-major border-t-transparent animate-spin inline-block" />
                        <span>{isCreateOpen ? 'Creating Role...' : 'Updating Permissions...'}</span>
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>{isCreateOpen ? 'Create Role' : 'Update Permissions'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          DELETE ROLE CONFIRMATION MODAL
         ====================================================================== */}
      {isDeleteOpen && activeRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => !isDeleting && setIsDeleteOpen(false)}>
          <div className="max-w-[460px] w-full p-6 bg-major rounded-2xl shadow-[0_25px_50px_-12px_rgba(239,68,68,0.2),0_0_0_1px_rgba(239,68,68,0.15)] animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-crmBorder mb-4">
              <h3 className="text-lg font-bold text-crmDanger flex items-center gap-2 m-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Delete Role?
              </h3>
              <button
                type="button"
                className="text-crmText-tertiary hover:text-crmText text-2xl font-bold leading-none p-1 cursor-pointer bg-transparent transition-colors"
                disabled={isDeleting}
                onClick={() => setIsDeleteOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3 text-sm text-crmTextSecondary">
              {deleteError && (
                <div className="mb-2 p-3 rounded-lg bg-crmDanger-bg border border-crmDanger-border text-crmDanger text-xs leading-relaxed">
                  <strong>Deletion Failed:</strong> {deleteError}
                </div>
              )}

              <p className="text-sm text-crmTextSecondary leading-relaxed mb-1">
                Are you sure you want to permanently delete the <strong className="text-crmText">{activeRole.name}</strong> role (<code className="text-minor-contrast font-mono text-xs">{activeRole.slug || activeRole.name.toLowerCase().replace(/\s+/g, '-')}</code>)?
              </p>

              {activeRole.user_count && activeRole.user_count > 0 ? (
                <div className="p-3 rounded-lg bg-crmWarning-bg border border-crmWarning-border text-crmWarning text-xs leading-relaxed">
                  ⚠️ <strong>Notice:</strong> This role is currently assigned to <strong>{activeRole.user_count}</strong> user{activeRole.user_count > 1 ? 's' : ''}. Deleting roles that are in use may be rejected by the server or require reassigning users first.
                </div>
              ) : null}

              <div className="text-xs text-crmTextTertiary bg-crmBgTint p-2.5 rounded-lg border border-crmBorder">
                Endpoint: <code className="text-minor-contrast font-mono">DELETE {baseUrl}/api/roles/{activeRole.id}/</code>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-crmBorder mt-4">
              <button
                type="button"
                className="px-5 py-2.5 rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary font-semibold text-sm transition-all cursor-pointer"
                disabled={isDeleting}
                onClick={() => setIsDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-5 py-2.5 rounded-lg bg-crmDanger hover:bg-crmDanger text-white font-semibold text-sm transition-all shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-major border-t-transparent animate-spin inline-block" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          DETAILED PERMISSION INSPECTOR MODAL
         ====================================================================== */}
      {inspectRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setInspectRole(null)}>
          <div className="bg-major rounded-2xl border border-crmBorder shadow-2xl w-full max-w-[860px] h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden relative animate-scale-up" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-5 px-7 border-b border-crmBorder flex items-center justify-between shrink-0 bg-major m-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="m-0 text-lg font-bold text-crmText">
                  <span>{inspectRole.name}</span> Permissions Detail
                </h3>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#fbf0fa] text-minor-contrast border border-minor/20">
                  {inspectRole.permission_codes ? inspectRole.permission_codes.length : 0} Granted
                </span>
                <span className="font-mono text-xs bg-crmBgTint text-minor-contrast px-2 py-0.5 rounded border border-crmBorder">
                  #{inspectRole.slug}
                </span>

                <button
                  type="button"
                  className="px-3 py-1 text-xs font-semibold rounded-lg border border-crmBorder bg-major hover:bg-minor-soft hover:text-minor-contrast hover:border-minor/30 text-crmTextSecondary cursor-pointer inline-flex items-center gap-1.5 transition-all ml-2"
                  onClick={() => {
                    const roleToEdit = inspectRole;
                    setInspectRole(null);
                    handleOpenEdit(roleToEdit);
                  }}
                  title="Update role permissions via PATCH"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit Permissions
                </button>
              </div>

              <button
                type="button"
                className="text-crmText-tertiary hover:text-crmText text-2xl font-bold leading-none p-1 cursor-pointer bg-transparent transition-colors"
                onClick={() => setInspectRole(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Quick Filter & Expand Controls */}
            <div className="p-3 px-7 bg-crmBgTint border-b border-crmBorder flex items-center justify-between flex-wrap gap-3 shrink-0">
              <div className="relative w-80 max-w-full">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-crmTextTertiary pointer-events-none"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-crmBorder bg-major text-crmText text-xs focus:outline-none focus:border-minor focus:ring-2 focus:ring-minor/20 transition-all"
                  placeholder="Filter privileges by name, code, description..."
                  value={inspectorSearch}
                  onChange={(e) => setInspectorSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-crmBorder bg-major hover:bg-crmBgTint text-crmTextSecondary cursor-pointer transition-all inline-flex items-center gap-1.5"
                  onClick={() => {
                    const allModNames = Object.keys(inspectedPermissionsGrouped);
                    const allAreCollapsed = allModNames.every((m) => collapsedModules[m]);
                    const next: Record<string, boolean> = {};
                    allModNames.forEach((m) => {
                      next[m] = !allAreCollapsed;
                    });
                    setCollapsedModules(next);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="7 13 12 18 17 13"></polyline>
                    <polyline points="7 6 12 11 17 6"></polyline>
                  </svg>
                  Toggle All Modules
                </button>
              </div>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 px-7 flex flex-col gap-4 bg-major">
              {Object.keys(inspectedPermissionsGrouped).length === 0 ? (
                <div className="text-center py-14 px-4 text-crmTextSecondary">
                  <div className="text-3xl mb-2">🔍</div>
                  <h4 className="text-crmText font-bold text-base mb-1">No Matching Privileges</h4>
                  <p className="text-xs">
                    No permissions found matching <strong>"{inspectorSearch}"</strong> in this role.
                  </p>
                </div>
              ) : (
                Object.entries(inspectedPermissionsGrouped).map(([modName, perms]) => {
                  const isCollapsed = Boolean(collapsedModules[modName]);
                  return (
                    <div key={modName} className="border border-crmBorder rounded-xl overflow-hidden bg-major shrink-0 shadow-sm">
                      {/* Module Header (Clickable to Collapse/Expand) */}
                      <div
                        className="bg-crmBgTint px-5 py-3 text-sm font-bold text-crmText border-b border-crmBorder flex items-center justify-between cursor-pointer select-none hover:bg-minor-soft transition-colors"
                        onClick={() =>
                          setCollapsedModules((prev) => ({
                            ...prev,
                            [modName]: !prev[modName],
                          }))
                        }
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-minor-contrast text-lg leading-none">•</span>
                          <span>{modName}</span>
                          <span className="text-xs font-bold text-minor-contrast bg-minor-soft px-2.5 py-0.5 rounded-full border border-minor/20">
                            {perms.length} privileges
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-crmTextTertiary">
                          <span className="text-xs">{isCollapsed ? 'Click to expand' : 'Click to collapse'}</span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      </div>

                      {/* Permissions Grid (Visible when not collapsed) */}
                      {!isCollapsed && (
                        <div className="p-4 px-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-major">
                          {perms.map((pd) => (
                            <div key={pd.code} className="bg-major border border-crmBorder rounded-lg p-3 flex flex-col gap-1.5 hover:border-minor/40 hover:shadow-sm transition-all">
                              <div className="font-bold text-xs text-crmText">
                                {pd.name || pd.code}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-minor-contrast bg-minor-soft px-1.5 py-0.5 rounded border border-minor/20">
                                  {pd.code}
                                </span>
                              </div>

                              <p className="text-xs text-crmTextSecondary leading-relaxed m-0">
                                {pd.description || 'Permission enables operations within this module.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-7 border-t border-crmBorder flex items-center justify-between shrink-0 bg-crmBgTint m-0">
              <span className="text-xs text-crmTextSecondary">
                Showing <strong>{Object.values(inspectedPermissionsGrouped).reduce((sum, p) => sum + p.length, 0)}</strong> of{' '}
                {inspectRole.permission_codes?.length || 0} permissions
              </span>

              <button
                type="button"
                className="px-6 py-2 rounded-lg bg-minor hover:bg-minor-hover text-white font-semibold text-sm transition-all shadow-accent cursor-pointer active:scale-[0.98]"
                onClick={() => setInspectRole(null)}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RolesPage;
