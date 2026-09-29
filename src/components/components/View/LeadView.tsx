import React, { useState } from 'react';
import { FileText, HelpCircle, Clock } from 'lucide-react';
import type { Lead } from '../../../utils/types';
import moment from 'moment';

interface LeadViewProps {
  leadData: Lead;
  initialTab?: 'details' | 'queries' | 'activity';
}

const TABS: { key: 'details' | 'queries' | 'activity'; label: string; icon: React.ElementType }[] = [
  { key: 'details', label: 'Application', icon: FileText },
  { key: 'queries', label: 'Queries', icon: HelpCircle },
  { key: 'activity', label: 'Activity', icon: Clock },
];

const LeadView: React.FC<LeadViewProps> = ({ leadData, initialTab = 'details' }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'queries' | 'activity'>(initialTab);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  const detailFields = [
    { label: 'First Name', value: leadData.first_name },
    { label: 'Last Name', value: leadData.last_name },
    { label: 'Registered Email', value: leadData.email },
    { label: 'Registered Phone', value: leadData.phone },
    { label: 'City', value: leadData.city },
    { label: 'Source', value: leadData.source },
    { label: 'UTM Source', value: leadData.utm_source },
    { label: 'UTM Campaign', value: leadData.utm_campaign },
    { label: 'Lead Stage', value: leadData.stage?.name },
    { label: 'Assigned To', value: leadData.assigned_to || 'Unassigned' },
    { label: 'Registration Date', value: formatDate(leadData.created_at) },
    { label: 'Last Updated', value: formatDate(leadData.updated_at) },
  ];

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 rounded-2xl bg-minor-soft border border-minor-subtle">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-minor text-white text-xl font-bold shadow-sm">
          {(leadData.full_name || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-crmText truncate">{leadData.full_name || '-'}</h3>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-major-tint text-crmText-secondary border-crmBorder"
            >
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: leadData.stage?.color || '#2563eb' }}
              />
              {leadData.stage?.name || '-'}
            </span>
          </div>
          <div className="mt-0.5 text-xs font-mono text-crmText-tertiary">{leadData.uid || '-'}</div>
          <p className="mt-2 text-xs leading-relaxed text-crmText-secondary">
            {leadData.phone || '-'} · {leadData.city || '-'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-crmBorder bg-major p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-3 py-2 text-xs font-bold transition-all ${
              activeTab === key
                ? 'bg-minor text-white shadow-crm-sm'
                : 'bg-transparent text-crmText-secondary hover:bg-major-muted'
            }`}
          >
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Details */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 mb-6">
          {detailFields.map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-1">
                {label}
              </div>
              <div className="text-sm font-semibold text-crmText">{value || '-'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Queries */}
      {activeTab === 'queries' && (
        <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
          {(leadData.queries || []).length === 0 ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs italic">
              No queries raised by this lead.
            </div>
          ) : (
            (leadData.queries || []).map((query) => (
              <div key={query.id} className="px-3.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-crmText">{query.question || '-'}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      query.status === 'Answered'
                        ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
                        : 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
                    }`}
                  >
                    {query.status || 'Open'}
                  </span>
                </div>
                <div className="mt-1 text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                  {formatDate(query.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Activity */}
      {activeTab === 'activity' && (
        <div className="border border-crmBorder rounded-xl bg-major divide-y divide-crmBorder">
          {(leadData.activities || []).length === 0 ? (
            <div className="p-6 text-center text-crmText-tertiary text-xs italic">
              No activity recorded for this lead.
            </div>
          ) : (
            (leadData.activities || []).map((activity) => (
              <div key={activity.id} className="px-3.5 py-2.5">
                <div className="text-xs font-semibold text-crmText">{activity.action || '-'}</div>
                {activity.description && (
                  <p className="mt-0.5 text-[11px] text-crmText-tertiary line-clamp-1">
                    {activity.description}
                  </p>
                )}
                <div className="mt-1 text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider">
                  {formatDate(activity.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default LeadView;
