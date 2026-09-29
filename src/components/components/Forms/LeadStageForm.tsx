import React, { useState } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { updateLeadStage } from '../../../store/slices/leadSlice';
import { LEAD_STAGES } from '../../../utils/mockLeads';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface LeadStageFormProps {
  leadData?: Lead;
  bulkIds?: number[];
}

const LeadStageForm: React.FC<LeadStageFormProps> = ({ leadData, bulkIds }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const [stage, setStage] = useState(leadData?.lead_stage || '');
  const [submitting, setSubmitting] = useState(false);

  const ids = leadData?.id != null ? [leadData.id] : bulkIds || [];
  const target = leadData?.name || `${ids.length} filtered leads`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage) {
      toast.error('Please select a lead stage');
      return;
    }
    if (ids.length === 0) {
      toast.error('No leads to update');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(updateLeadStage({ ids, lead_stage: stage })).unwrap();
      toast.success(`Lead stage changed to ${stage} for ${target}`);
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to update lead stage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
        Changing stage for: <span className="font-bold text-crmText">{target}</span>
        {leadData?.lead_stage && (
          <>
            {' '}(current: <span className="font-bold text-crmText">{leadData.lead_stage}</span>)
          </>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Lead Stage <span className="text-red-500">*</span>
        </label>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring cursor-pointer appearance-none"
        >
          <option value="">Select Stage</option>
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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
          className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Updating...</span>
            </>
          ) : (
            'Change Stage'
          )}
        </button>
      </div>
    </form>
  );
};

export default LeadStageForm;
