import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchModuleById } from '../../../store/slices/moduleSlice';
import { Hash, Layers, ArrowUpDown, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Module } from '../../../utils/types';
import moment from 'moment';

interface ModuleViewProps {
  moduleData: Module;
}

const ModuleView: React.FC<ModuleViewProps> = ({ moduleData }) => {
  const dispatch = useAppDispatch();
  const { selectedModule, selectedModuleLoading, data: modules } = useAppSelector(
    (state) => state.modules
  );

  // Fetch live module detail by ID on mount
  useEffect(() => {
    if (moduleData.id != null) {
      dispatch(fetchModuleById(moduleData.id));
    }
  }, [dispatch, moduleData.id]);

  // Show table row data immediately, then seamlessly refine with live detail response
  const module = useMemo(
    () => (selectedModule?.id === moduleData.id ? { ...moduleData, ...selectedModule } : moduleData),
    [moduleData, selectedModule]
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  // Resolve parent module name from loaded list or display #id
  const parentName = useMemo(() => {
    if (module.parent == null) return 'Top level';
    const parentObj = (modules || []).find((m) => m.id === module.parent);
    return parentObj?.name || `#${module.parent}`;
  }, [module.parent, modules]);

  return (
    <div className="w-full space-y-5">
      {/* Header Profile Card */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white text-xl font-bold shadow-sm">
          {(module.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{module.name || '-'}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                module.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {module.is_active ? 'Active' : 'Inactive'}
            </span>
            {selectedModuleLoading && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary-soft border border-primary/20 animate-pulse ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                Syncing
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{module.code || '-'}</div>
          <p
            className={`mt-2 text-xs leading-relaxed ${
              module.description ? 'text-crmText-secondary' : 'text-crmText-tertiary italic'
            }`}
          >
            {module.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: Hash, label: 'Module ID', value: module.id != null ? `#${module.id}` : '-' },
          { icon: Layers, label: 'Parent Module', value: parentName },
          { icon: ArrowUpDown, label: 'Sort Order', value: module.sort_order ?? 0 },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-3.5 rounded-xl border border-crmBorder bg-major shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon size={13} strokeWidth={2.5} className="text-minor" />
              <span className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                {label}
              </span>
            </div>
            <div className="text-base font-bold text-crmText leading-none truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Metadata & Properties Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-crmBorder bg-major">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-crmBorder flex items-center justify-center text-crmText-tertiary">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              Created On
            </div>
            <div className="text-xs font-semibold text-crmText">{formatDate(module.created_at)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
              module.is_active
                ? 'bg-crmSuccess-bg border-crmSuccess-border text-crmSuccess'
                : 'bg-crmDanger-bg border-crmDanger-border text-crmDanger'
            }`}
          >
            {module.is_active ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              System Status
            </div>
            <div className="text-xs font-semibold text-crmText">
              {module.is_active ? 'Active & Available' : 'Inactive / Disabled'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleView;
