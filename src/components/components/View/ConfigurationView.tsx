import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchConfigurationById } from '../../../store/slices/configurationSlice';
import { Settings2, Calendar } from 'lucide-react';
import type { Configuration } from '../../../utils/types';
import moment from 'moment';

interface ConfigurationViewProps {
  configurationData: Configuration;
}

const renderValue = (value: any): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const ConfigurationView: React.FC<ConfigurationViewProps> = ({ configurationData }) => {
  const dispatch = useAppDispatch();
  const { selectedConfiguration, selectedConfigurationLoading } = useAppSelector(
    (state) => state.configurations
  );

  // Fetch live configuration detail by ID on mount
  useEffect(() => {
    if (configurationData.id != null) {
      dispatch(fetchConfigurationById(configurationData.id));
    }
  }, [dispatch, configurationData.id]);

  const config = useMemo(
    () =>
      selectedConfiguration?.id === configurationData.id
        ? { ...configurationData, ...selectedConfiguration }
        : configurationData,
    [configurationData, selectedConfiguration]
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  const detailFields = [
    { label: 'Group', value: config.group || '-' },
    { label: 'Data Type', value: config.data_type || '-' },
    { label: 'Min Value', value: config.min_value != null ? String(config.min_value) : '-' },
    { label: 'Max Value', value: config.max_value != null ? String(config.max_value) : '-' },
    { label: 'Updated By', value: config.updated_by || '-' },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white shadow-sm">
          <Settings2 size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{config.name || '-'}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                config.is_active
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {config.is_active ? 'Active' : 'Inactive'}
            </span>
            {config.is_system && (
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-secondary-soft text-secondary-contrast border-secondary/25">
                System
              </span>
            )}
            {selectedConfigurationLoading && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary-soft border border-primary/20 animate-pulse ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                Syncing
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{config.key || '-'}</div>
          <p
            className={`mt-2 text-xs leading-relaxed ${
              config.description ? 'text-crmText-secondary' : 'text-crmText-tertiary italic'
            }`}
          >
            {config.description || 'No description provided.'}
          </p>
        </div>
      </div>

      {/* Current / default value */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
            Current Value
          </div>
          <pre className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText font-mono overflow-x-auto max-h-[140px]">
            {renderValue(config.value)}
          </pre>
        </div>
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
            Default Value
          </div>
          <pre className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText font-mono overflow-x-auto max-h-[140px]">
            {renderValue(config.default_value)}
          </pre>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        {detailFields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
              {label}
            </div>
            <div className="text-sm font-semibold text-crmText">{value}</div>
          </div>
        ))}
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-crmBorder bg-major">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-crmBorder flex items-center justify-center text-crmText-tertiary">
            <Calendar size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
              Created On
            </div>
            <div className="text-xs font-semibold text-crmText">{formatDate(config.created_at)}</div>
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
            <div className="text-xs font-semibold text-crmText">{formatDate(config.updated_at)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationView;
