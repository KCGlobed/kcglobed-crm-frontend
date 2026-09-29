import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { updateLeadStage, fetchStageOptions } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface LeadStageFormProps {
  leadData?: Lead;
  bulkUids?: string[];
}

const LeadStageForm: React.FC<LeadStageFormProps> = ({ leadData, bulkUids }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { stageOptions, stageOptionsLoading } = useAppSelector((state) => state.leads);
  const [stageCode, setStageCode] = useState(leadData?.stage?.code || '');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load stage options for the dropdown
  useEffect(() => {
    if (!stageOptions || stageOptions.length === 0) {
      dispatch(fetchStageOptions());
    }
  }, [dispatch, stageOptions]);

  const uids = leadData?.uid != null ? [leadData.uid] : bulkUids || [];
  const target = leadData?.full_name || `${uids.length} filtered leads`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selected = (stageOptions || []).find((s) => s.code === stageCode);
    if (!selected) {
      toast.error('Please select a lead stage');
      return;
    }
    if (uids.length === 0) {
      toast.error('No leads to update');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(updateLeadStage({ uids, stage: selected, remark: remark.trim() || undefined })).unwrap();
      toast.success(`Lead stage changed to ${selected.name} for ${target}`);
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
        {leadData?.stage?.name && (
          <>
            {' '}(current: <span className="font-bold text-crmText">{leadData.stage.name}</span>)
          </>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Lead Stage <span className="text-red-500">*</span>
        </label>
        <select
          value={stageCode}
          onChange={(e) => setStageCode(e.target.value)}
          disabled={stageOptionsLoading}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring cursor-pointer appearance-none disabled:opacity-60"
        >
          <option value="">{stageOptionsLoading ? 'Loading stages...' : 'Select Stage'}</option>
          {(stageOptions || []).map((s) => (
            <option key={s.id ?? s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Remark</label>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="e.g. Called, interested"
          rows={2}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring resize-y"
        />
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
