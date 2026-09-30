import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { reassignLead, fetchLeadAssignees } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface LeadReassignFormProps {
  leadData: Lead;
}

const LeadReassignForm: React.FC<LeadReassignFormProps> = ({ leadData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { assignees, assigneesLoading } = useAppSelector((state) => state.leads);
  const [assigneeUid, setAssigneeUid] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load assignee options once when the modal opens (GET /api/leads/assignees/)
  useEffect(() => {
    dispatch(fetchLeadAssignees());
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selected = (assignees || []).find((a) => a.uid === assigneeUid);
    if (!selected) {
      toast.error('Please select an assignee');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(reassignLead({ uid: leadData.uid, assigned_to: selected })).unwrap();
      toast.success(`Lead re-assigned to ${selected.name || selected.email}`);
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to re-assign lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
        <span className="font-bold text-crmText">{leadData.full_name || '-'}</span> is currently assigned
        to <span className="font-bold text-crmText">{leadData.assigned_to?.name || 'Unassigned'}</span>
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Re-assign To <span className="text-red-500">*</span>
        </label>
        <select
          value={assigneeUid}
          onChange={(e) => setAssigneeUid(e.target.value)}
          disabled={assigneesLoading}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring cursor-pointer appearance-none disabled:opacity-60"
        >
          <option value="">{assigneesLoading ? 'Loading assignees...' : 'Select Assignee'}</option>
          {(assignees || []).map((a) => (
            <option key={a.uid} value={a.uid}>
              {a.name || a.email}
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
              <span>Re-assigning...</span>
            </>
          ) : (
            'Re-assign Lead'
          )}
        </button>
      </div>
    </form>
  );
};

export default LeadReassignForm;
