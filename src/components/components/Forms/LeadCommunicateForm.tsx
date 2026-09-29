import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

// TODO: Wire to the communication API (email/WhatsApp/SMS) once it exists.

interface LeadCommunicateFormProps {
  leadData?: Lead;
  bulkCount?: number;
}

type CommunicateFormValues = {
  channel: string;
  subject: string;
  message: string;
};

const CHANNELS = ['Email', 'WhatsApp', 'SMS'];

const inputClass = (hasError: boolean) =>
  `w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
    hasError
      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
      : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
  }`;

const LeadCommunicateForm: React.FC<LeadCommunicateFormProps> = ({ leadData, bulkCount }) => {
  const { hideModal } = useModal();
  const [submitting, setSubmitting] = useState(false);

  const recipient = leadData?.full_name || `${bulkCount ?? 0} filtered leads`;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CommunicateFormValues>({
    defaultValues: { channel: 'Email', subject: '', message: '' },
  });

  const onSubmit = async (data: CommunicateFormValues) => {
    setSubmitting(true);
    try {
      await '';
      toast.success(`${data.channel} sent to ${recipient}`);
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
        Sending to: <span className="font-bold text-crmText">{recipient}</span>
      </div>

      {/* Channel */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Channel <span className="text-red-500">*</span>
        </label>
        <select {...register('channel')} className={`${inputClass(false)} cursor-pointer appearance-none`}>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('subject', {
            required: 'Subject is required',
            validate: (val) => val.trim().length > 0 || 'Subject cannot be empty or only spaces',
          })}
          placeholder="e.g. Your application update..."
          autoFocus
          className={inputClass(!!errors.subject)}
        />
        {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject.message}</p>}
      </div>

      {/* Message */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Message <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('message', {
            required: 'Message is required',
            validate: (val) => val.trim().length > 0 || 'Message cannot be empty or only spaces',
          })}
          placeholder="Type your message..."
          rows={4}
          className={`${inputClass(!!errors.message)} resize-y`}
        />
        {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message.message}</p>}
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
              <span>Sending...</span>
            </>
          ) : (
            'Send Message'
          )}
        </button>
      </div>
    </form>
  );
};

export default LeadCommunicateForm;
