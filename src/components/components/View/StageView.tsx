import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchStageById } from '../../../store/slices/stageSlice';
import { Users, ArrowUpDown, Flag, Calendar, Palette } from 'lucide-react';
import type { Stage } from '../../../utils/types';
import moment from 'moment';

interface StageViewProps {
  stageData: Stage;
}

const KIND_BADGE_CLASSES: Record<string, string> = {
  open: 'bg-crmInfo-bg text-crmInfo border-crmInfo-border',
  won: 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border',
  lost: 'bg-crmDanger-bg text-crmDanger border-crmDanger-border',
};

const StageView: React.FC<StageViewProps> = ({ stageData }) => {
  const dispatch = useAppDispatch();
  const { selectedStage, selectedStageLoading } = useAppSelector((state) => state.stages);

  // Fetch live stage detail by ID on mount
  useEffect(() => {
    if (stageData.id != null) {
      dispatch(fetchStageById(stageData.id));
    }
  }, [dispatch, stageData.id]);

  // Show table row data immediately, then seamlessly refine with live detail response
  const stage = useMemo(
    () => (selectedStage?.id === stageData.id ? { ...stageData, ...selectedStage } : stageData),
    [stageData, selectedStage]
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full space-y-5">
      {/* Header Profile Card */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white text-xl font-bold shadow-sm"
          style={{ backgroundColor: stage.color || '#2563eb' }}
        >
          {(stage.name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{stage.name || '-'}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                KIND_BADGE_CLASSES[stage.kind || ''] || 'bg-major-tint text-crmText-secondary border-crmBorder'
              }`}
            >
              {stage.kind || '-'}
            </span>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                stage.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {stage.is_active ? 'Active' : 'Inactive'}
            </span>
            {stage.is_default && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-crmInfo-bg text-crmInfo border-crmInfo-border">
                Default
              </span>
            )}
            {selectedStageLoading && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary-soft border border-primary/20 animate-pulse ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                Syncing
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{stage.code || '-'}</div>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { icon: Users, label: 'Lead Count', value: stage.lead_count ?? 0 },
          { icon: ArrowUpDown, label: 'Sort Order', value: stage.sort_order ?? 0 },
          { icon: Flag, label: 'Kind', value: stage.kind ? stage.kind.charAt(0).toUpperCase() + stage.kind.slice(1) : '-' },
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
            <Palette size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              Color
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-crmText">
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-crmBorder shrink-0"
                style={{ backgroundColor: stage.color || '#2563eb' }}
              />
              <span className="font-mono">{stage.color || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-crmBorder flex items-center justify-center text-crmText-tertiary">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              Created On
            </div>
            <div className="text-xs font-semibold text-crmText">{formatDate(stage.created_at)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-crmBorder flex items-center justify-center text-crmText-tertiary">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              Updated On
            </div>
            <div className="text-xs font-semibold text-crmText">{formatDate(stage.updated_at)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageView;
