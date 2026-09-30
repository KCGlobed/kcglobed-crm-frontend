import React, { useEffect, useMemo } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { fetchAuditLogById } from '../../../store/slices/auditLogSlice';
import { ScrollText } from 'lucide-react';
import type { AuditLog } from '../../../utils/types';
import moment from 'moment';

interface AuditLogViewProps {
  auditLogData: AuditLog;
}

const AuditLogView: React.FC<AuditLogViewProps> = ({ auditLogData }) => {
  const dispatch = useAppDispatch();
  const { selectedAuditLog, selectedAuditLogLoading } = useAppSelector(
    (state) => state.auditLogs
  );

  // The detail endpoint adds old_data / new_data / metadata
  useEffect(() => {
    if (auditLogData.id != null) {
      dispatch(fetchAuditLogById(auditLogData.id));
    }
  }, [dispatch, auditLogData.id]);

  const log = useMemo(
    () =>
      selectedAuditLog?.id === auditLogData.id
        ? { ...auditLogData, ...selectedAuditLog }
        : auditLogData,
    [auditLogData, selectedAuditLog]
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
    { label: 'Actor', value: log.actor?.name || log.actor_email },
    { label: 'Actor Email', value: log.actor_email },
    { label: 'Action', value: log.action_display || log.action },
    { label: 'Module', value: log.module },
    { label: 'Object Type', value: log.object_type },
    { label: 'Object', value: log.object_repr },
    { label: 'Object ID', value: log.object_id },
    { label: 'IP Address', value: log.ip_address },
    { label: 'Request ID', value: log.request_id },
    { label: 'Timestamp', value: formatDate(log.created_at) },
  ];

  const hasChanges =
    (log.old_data && Object.keys(log.old_data).length > 0) ||
    (log.new_data && Object.keys(log.new_data).length > 0);

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white shadow-sm">
          <ScrollText size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">
              {log.action_display || log.action || 'Audit Entry'}
            </h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                log.success
                  ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                  : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              }`}
            >
              {log.success ? 'Success' : 'Failure'}
            </span>
            {selectedAuditLogLoading && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-primary bg-primary-soft border border-primary/20 animate-pulse ml-auto">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                Syncing
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">
            {log.module || '-'} · {log.object_repr || log.object_type || '-'}
          </div>
          {log.message && (
            <p className="mt-2 text-xs leading-relaxed text-crmText-secondary">{log.message}</p>
          )}
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
        {detailFields.map(({ label, value }) => (
          <div key={label}>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
              {label}
            </div>
            <div className="text-sm font-semibold text-crmText break-all">{value || '-'}</div>
          </div>
        ))}
      </div>

      {/* Old / new data */}
      {hasChanges && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
              Old Data
            </div>
            <pre className="p-3 rounded-xl border border-crmDanger-border bg-crmDanger-bg text-[11px] text-crmText font-mono overflow-x-auto max-h-[200px]">
              {JSON.stringify(log.old_data || {}, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
              New Data
            </div>
            <pre className="p-3 rounded-xl border border-crmSuccess-border bg-crmSuccess-bg text-[11px] text-crmText font-mono overflow-x-auto max-h-[200px]">
              {JSON.stringify(log.new_data || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* User agent */}
      {log.user_agent && (
        <div>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
            User Agent
          </div>
          <div className="text-xs text-crmText-secondary break-all">{log.user_agent}</div>
        </div>
      )}
    </div>
  );
};

export default AuditLogView;
