import React from 'react';
import type { RoleItem } from '../../../utils/types';

interface RoleViewProps {
  roleData: RoleItem;
}

const RoleView: React.FC<RoleViewProps> = ({ roleData }) => {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Group permissions by module
  const permsByModule: Record<string, { name: string; code: string }[]> = {};
  (roleData.permissions_detail || []).forEach((p) => {
    const mod = p.module || 'General';
    if (!permsByModule[mod]) permsByModule[mod] = [];
    permsByModule[mod].push({ name: p.name, code: p.code });
  });

  return (
    <div className="w-full">
      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Role Name</div>
          <div className="text-sm font-semibold text-crmText">{roleData.name}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Slug</div>
          <div className="text-xs font-mono text-crmText-secondary font-medium">{roleData.slug}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Status</div>
          <span
            className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
              roleData.is_active
                ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
            }`}
          >
            {roleData.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">System Role</div>
          <div className="text-sm font-medium text-crmText">{roleData.is_system ? 'Yes' : 'No'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Users Count</div>
          <div className="text-sm font-medium text-crmText">{roleData.user_count ?? '-'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Created By</div>
          <div className="text-sm font-medium text-crmText">{roleData.created_by_name || '-'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Created At</div>
          <div className="text-sm font-medium text-crmText">{formatDate(roleData.created_at)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Updated At</div>
          <div className="text-sm font-medium text-crmText">{formatDate(roleData.updated_at)}</div>
        </div>
      </div>

      {/* Description */}
      {roleData.description && (
        <div className="mb-6">
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">Description</div>
          <div className="text-sm text-crmText-secondary leading-relaxed">{roleData.description}</div>
        </div>
      )}

      {/* Permissions */}
      <div>
        <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-3">
          Permissions ({roleData.permission_codes?.length || 0})
        </div>
        {Object.keys(permsByModule).length === 0 ? (
          <div className="text-xs text-crmText-tertiary italic">
            No permissions assigned to this role.
          </div>
        ) : (
          <div className="max-h-[250px] overflow-y-auto border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
            {Object.entries(permsByModule).map(([module, perms]) => (
              <div key={module} className="border-b border-crmBorder last:border-b-0">
                <div className="px-3.5 py-2 bg-major-tint text-[11px] font-bold text-crmText uppercase tracking-wider flex items-center">
                  {module}
                  <span className="text-crmText-tertiary font-medium ml-2">({perms.length})</span>
                </div>
                <div className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {perms.map((p) => (
                      <span
                        key={p.code}
                        title={p.code}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-minor-soft text-minor-contrast border border-minor"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleView;
