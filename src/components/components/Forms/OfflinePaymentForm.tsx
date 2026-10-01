import React, { useState, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { recordOfflinePayment, fetchLeadById, fetchLeadPayment } from '../../../store/slices/leadSlice';
import { fetchPaymentGateway } from '../../../store/slices/paymentSlice';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface OfflinePaymentFormProps {
  leadData: Lead;
}

const PAYMENT_MODES = ['cash', 'cheque', 'dd', 'neft', 'rtgs', 'imps', 'upi', 'card', 'other'];

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-primary rounded-xl text-sm text-crmText outline-none transition-all shadow-sm focus:ring-2 focus:ring-primary-ring';

const OfflinePaymentForm: React.FC<OfflinePaymentFormProps> = ({ leadData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { gateway } = useAppSelector((state) => state.payments);

  const [paymentMode, setPaymentMode] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load the configured amount once when the modal opens (GET /api/payments/gateway/)
  useEffect(() => {
    dispatch(fetchPaymentGateway());
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMode || !paymentDate) {
      toast.error('Payment mode and date are required');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('payment_mode', paymentMode);
      formData.append('payment_date', paymentDate);
      if (transactionId.trim()) formData.append('transaction_id', transactionId.trim());
      if (proof) formData.append('proof', proof);
      if (notes.trim()) formData.append('notes', notes.trim());
      await dispatch(recordOfflinePayment({ uid: leadData.uid!, formData })).unwrap();
      toast.success('Offline payment recorded. Awaiting verification.');
      dispatch(fetchLeadById(leadData.uid!));
      dispatch(fetchLeadPayment(leadData.uid!));
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to record offline payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {gateway?.amount != null && (
        <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
          Amount to collect:{' '}
          <span className="font-bold text-crmText">
            {gateway.currency || 'INR'} {gateway.amount}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Payment Mode <span className="text-red-500">*</span>
          </label>
          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className={`${inputClass} cursor-pointer appearance-none`}
          >
            <option value="">Select Mode</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Transaction ID</label>
        <input
          type="text"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          placeholder="e.g. UTR / cheque number"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Payment Proof</label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setProof(e.target.files?.[0] || null)}
          className={`${inputClass} cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-minor-soft file:px-3 file:py-1 file:text-xs file:font-semibold file:text-minor-contrast`}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Payment notes..."
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
              <span>Recording...</span>
            </>
          ) : (
            'Record Payment'
          )}
        </button>
      </div>
    </form>
  );
};

export default OfflinePaymentForm;
