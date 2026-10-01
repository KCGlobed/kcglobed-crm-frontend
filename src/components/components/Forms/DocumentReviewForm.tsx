import React, { useState } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { reviewStudentDocument, fetchPendingReviewDocuments } from '../../../store/slices/studentSlice';
import { fetchLeadDocuments, fetchLeadById } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { StudentDocument } from '../../../utils/types';

interface DocumentReviewFormProps {
  documentData: StudentDocument;
  // uid of the lead whose documents tab opened this form (refreshes that checklist)
  leadUid?: string;
  initialStatus?: 'APPROVED' | 'REJECTED';
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring';

const DocumentReviewForm: React.FC<DocumentReviewFormProps> = ({ documentData, leadUid, initialStatus }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const [status, setStatus] = useState<'APPROVED' | 'REJECTED' | ''>(initialStatus || '');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const documentId = documentData.document?.id ?? documentData.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) {
      toast.error('Please choose Approve or Reject');
      return;
    }
    if (status === 'REJECTED' && !rejectionReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(
        reviewStudentDocument({
          id: documentId!,
          status,
          rejection_reason: status === 'REJECTED' ? rejectionReason.trim() : undefined,
        })
      ).unwrap();
      toast.success(status === 'APPROVED' ? 'Document approved' : 'Document rejected');
      dispatch(fetchPendingReviewDocuments());
      if (leadUid) {
        dispatch(fetchLeadDocuments(leadUid));
        dispatch(fetchLeadById(leadUid));
      }
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to review document');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
        Reviewing <span className="font-bold text-crmText">{documentData.label || documentData.document_type || 'document'}</span>
        {documentData.application?.full_name || documentData.full_name || documentData.lead?.full_name ? (
          <>
            {' '}of <span className="font-bold text-crmText">{documentData.application?.full_name || documentData.full_name || documentData.lead?.full_name}</span>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setStatus('APPROVED')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            status === 'APPROVED'
              ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
              : 'bg-major text-crmText-secondary border-crmBorder hover:bg-major-tint'
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setStatus('REJECTED')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            status === 'REJECTED'
              ? 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              : 'bg-major text-crmText-secondary border-crmBorder hover:bg-major-tint'
          }`}
        >
          Reject
        </button>
      </div>

      {status === 'REJECTED' && (
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={2}
            placeholder="Why is this document being rejected..."
            className={`${inputClass} resize-y`}
          />
        </div>
      )}

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
              <span>Submitting...</span>
            </>
          ) : (
            'Submit Review'
          )}
        </button>
      </div>
    </form>
  );
};

export default DocumentReviewForm;
