import React, { useState } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { createLeadFollowUp, fetchLeadById } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface FollowUpFormProps {
  leadData: Lead;
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring';

const FollowUpForm: React.FC<FollowUpFormProps> = ({ leadData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpDate || !followUpTime) {
      toast.error('Follow-up date and time are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        follow_up_date: followUpDate,
        follow_up_time: followUpTime,
      };
      if (notes.trim()) payload.notes = notes.trim();
      await dispatch(createLeadFollowUp({ uid: leadData.uid!, payload })).unwrap();
      toast.success('Follow-up scheduled');
      dispatch(fetchLeadById(leadData.uid!));
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to create follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="What should be discussed on this follow-up..."
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
              <span>Scheduling...</span>
            </>
          ) : (
            'Schedule Follow-up'
          )}
        </button>
      </div>
    </form>
  );
};

export default FollowUpForm;
