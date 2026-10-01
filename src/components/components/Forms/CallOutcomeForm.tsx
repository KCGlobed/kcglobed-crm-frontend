import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { recordCallOutcome, fetchLeadWorkflow, fetchLeadCalls } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface CallOutcomeFormProps {
  leadData: Lead;
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring';

const CallOutcomeForm: React.FC<CallOutcomeFormProps> = ({ leadData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { workflow } = useAppSelector((state) => state.leads);

  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load workflow options once when the modal opens (GET /api/leads/workflow/)
  useEffect(() => {
    dispatch(fetchLeadWorkflow());
  }, [dispatch]);

  // INTERESTED is only offered while the lead is in the follow-up stage
  const outcomes = (workflow?.call_outcomes || []).filter(
    (o) => o.value !== 'INTERESTED' || leadData.stage?.code === 'follow-up'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome) {
      toast.error('Please select a call outcome');
      return;
    }
    if (outcome === 'NOT_ELIGIBLE' && !reason) {
      toast.error('Reason is required');
      return;
    }
    if (outcome === 'NOT_ELIGIBLE' && reason === 'other' && !reasonDetail.trim()) {
      toast.error('Please describe the reason');
      return;
    }
    if (outcome === 'FOLLOW_UP' && (!followUpDate || !followUpTime)) {
      toast.error('Follow-up date and time are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, any> = { outcome };
      if (notes.trim()) payload.notes = notes.trim();
      if (outcome === 'NOT_ELIGIBLE') {
        payload.reason = reason;
        if (reason === 'other') payload.reason_detail = reasonDetail.trim();
      }
      if (outcome === 'FOLLOW_UP') {
        payload.follow_up_date = followUpDate;
        payload.follow_up_time = followUpTime;
      }
      await dispatch(recordCallOutcome({ uid: leadData.uid!, payload })).unwrap();
      toast.success('Call outcome recorded');
      dispatch(fetchLeadCalls(leadData.uid!));
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to record call outcome');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Call Outcome <span className="text-red-500">*</span>
        </label>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className={`${inputClass} cursor-pointer appearance-none`}
        >
          <option value="">Select Outcome</option>
          {outcomes.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {outcome === 'NOT_ELIGIBLE' && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Reason <span className="text-red-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputClass} cursor-pointer appearance-none`}
          >
            <option value="">Select Reason</option>
            {(workflow?.not_eligible_reasons || []).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {outcome === 'NOT_ELIGIBLE' && reason === 'other' && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Reason Detail <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reasonDetail}
            onChange={(e) => setReasonDetail(e.target.value)}
            rows={2}
            placeholder="Describe why the lead is not eligible..."
            className={`${inputClass} resize-y`}
          />
        </div>
      )}

      {outcome === 'FOLLOW_UP' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">
              Follow-up Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">
              Follow-up Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={followUpTime}
              onChange={(e) => setFollowUpTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Call notes..."
          className={`${inputClass} resize-y`}
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
              <span>Saving...</span>
            </>
          ) : (
            'Record Outcome'
          )}
        </button>
      </div>
    </form>
  );
};

export default CallOutcomeForm;
