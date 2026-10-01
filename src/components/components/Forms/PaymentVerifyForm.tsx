import React, { useState } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { verifyOfflinePayment, fetchPayments } from '../../../store/slices/paymentSlice';
import { fetchLeadById, fetchLeadPayment } from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Payment } from '../../../utils/types';

interface PaymentVerifyFormProps {
  paymentData: Payment;
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring';

const PaymentVerifyForm: React.FC<PaymentVerifyFormProps> = ({ paymentData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const [approve, setApprove] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (approve === null) {
      toast.error('Please choose Approve or Reject');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(
        verifyOfflinePayment({ uid: paymentData.uid!, approve, notes: notes.trim() || undefined })
      ).unwrap();
      toast.success(approve ? 'Payment verified' : 'Payment rejected');
      dispatch(fetchPayments());
      if (paymentData.lead?.uid) {
        dispatch(fetchLeadById(paymentData.lead.uid));
        dispatch(fetchLeadPayment(paymentData.lead.uid));
      }
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to verify payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
        <span className="font-bold text-crmText">{paymentData.lead?.full_name || '-'}</span> ·{' '}
        {paymentData.currency || 'INR'} {paymentData.amount} · {(paymentData.payment_mode || '').toUpperCase() || paymentData.method}
        {paymentData.transaction_id ? ` · ${paymentData.transaction_id}` : ''}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setApprove(true)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            approve === true
              ? 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border'
              : 'bg-major text-crmText-secondary border-crmBorder hover:bg-major-tint'
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setApprove(false)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            approve === false
              ? 'bg-crmDanger-bg text-crmDanger border-crmDanger-border'
              : 'bg-major text-crmText-secondary border-crmBorder hover:bg-major-tint'
          }`}
        >
          Reject
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Verification notes..."
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
              <span>Submitting...</span>
            </>
          ) : (
            'Submit Verification'
          )}
        </button>
      </div>
    </form>
  );
};

export default PaymentVerifyForm;
