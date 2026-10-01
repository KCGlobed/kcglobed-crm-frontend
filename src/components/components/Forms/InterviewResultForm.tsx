import React, { useState } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { updateInterviewResult, fetchInterviews, fetchLeadInterview } from '../../../store/slices/interviewSlice';
import { fetchLeadById } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Interview } from '../../../utils/types';

interface InterviewResultFormProps {
  interviewData: Interview;
  // uid of the lead whose detail view opened this form (refreshes that lead)
  leadUid?: string;
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring';

const InterviewResultForm: React.FC<InterviewResultFormProps> = ({ interviewData, leadUid }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const [result, setResult] = useState<'SELECTED' | 'NOT_SELECTED' | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result) {
      toast.error('Please choose a result');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(
        updateInterviewResult({
          id: interviewData.id!,
          payload: notes.trim() ? { result, notes: notes.trim() } : { result },
        })
      ).unwrap();
      toast.success(result === 'SELECTED' ? 'Student selected' : 'Student not selected');
      dispatch(fetchInterviews());
      if (leadUid) {
        dispatch(fetchLeadById(leadUid));
        dispatch(fetchLeadInterview(leadUid));
      }
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to record interview result');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
        Recording result for{' '}
        <span className="font-bold text-crmText">
          {interviewData.lead?.full_name || interviewData.full_name || 'this interview'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setResult('SELECTED')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            result === 'SELECTED'
              ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
              : 'bg-major text-crmText-secondary border-crmBorder hover:bg-major-tint'
          }`}
        >
          Selected
        </button>
        <button
          type="button"
          onClick={() => setResult('NOT_SELECTED')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            result === 'NOT_SELECTED'
              ? 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              : 'bg-major text-crmText-secondary border-crmBorder hover:bg-major-tint'
          }`}
        >
          Not Selected
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Interview feedback..."
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
            'Record Result'
          )}
        </button>
      </div>
    </form>
  );
};

export default InterviewResultForm;
