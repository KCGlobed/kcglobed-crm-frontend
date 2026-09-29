import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { createLead, fetchLeads } from '../../../store/slices/leadSlice';
import { LEAD_STAGES, LEAD_SOURCES } from '../../../utils/mockLeads';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface LeadFormProps {
  leadData?: Lead;
}

type LeadFormValues = {
  name: string;
  email: string;
  mobile: string;
  course: string;
  source: string;
  medium: string;
  campaign: string;
  lead_stage: string;
};

const inputClass = (hasError: boolean) =>
  `w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
    hasError
      ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
      : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
  }`;

const LeadForm: React.FC<LeadFormProps> = ({ leadData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();

  const isEdit = !!leadData;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LeadFormValues>({
    defaultValues: {
      name: leadData?.name || '',
      email: leadData?.email || '',
      mobile: leadData?.mobile || '',
      course: leadData?.course || '',
      source: leadData?.source || '',
      medium: leadData?.medium || '',
      campaign: leadData?.campaign || '',
      lead_stage: leadData?.lead_stage || 'Untouched',
    },
  });

  const onSubmit = async (data: LeadFormValues) => {
    setSubmitting(true);
    try {
      await dispatch(
        createLead({
          name: data.name.trim(),
          email: data.email.trim(),
          mobile: data.mobile.trim(),
          course: data.course.trim(),
          source: data.source || 'direct',
          medium: data.medium.trim() || 'direct',
          campaign: data.campaign.trim() || 'direct',
          lead_stage: data.lead_stage,
        })
      ).unwrap();
      toast.success('Lead created successfully');
      dispatch(fetchLeads());
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to save lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Registered Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
              validate: (val) => val.trim().length > 0 || 'Name cannot be empty or only spaces',
            })}
            placeholder="e.g. Rahul Kumar"
            autoFocus
            className={inputClass(!!errors.name)}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Registered Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
            })}
            placeholder="e.g. rahul.kumar@gmail.com"
            className={inputClass(!!errors.email)}
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Mobile */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Registered Mobile <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            {...register('mobile', {
              required: 'Mobile is required',
              pattern: { value: /^[0-9+\-\s]{10,15}$/, message: 'Enter a valid mobile number' },
            })}
            placeholder="e.g. 9910000017"
            className={inputClass(!!errors.mobile)}
          />
          {errors.mobile && <p className="mt-1 text-xs text-red-500">{errors.mobile.message}</p>}
        </div>

        {/* Course */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Course</label>
          <input
            type="text"
            {...register('course')}
            placeholder="e.g. MBA, BTech..."
            className={inputClass(false)}
          />
        </div>

        {/* Source */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Source</label>
          <select {...register('source')} className={`${inputClass(false)} cursor-pointer appearance-none`}>
            <option value="">Select Source</option>
            {LEAD_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        {/* Medium */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Medium</label>
          <input
            type="text"
            {...register('medium')}
            placeholder="e.g. banner, searchAd..."
            className={inputClass(false)}
          />
        </div>

        {/* Campaign */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Campaign</label>
          <input
            type="text"
            {...register('campaign')}
            placeholder="e.g. launch, BTech..."
            className={inputClass(false)}
          />
        </div>

        {/* Lead Stage */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Lead Stage</label>
          <select {...register('lead_stage')} className={`${inputClass(false)} cursor-pointer appearance-none`}>
            {LEAD_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>
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
              <span>{isEdit ? 'Updating...' : 'Creating...'}</span>
            </>
          ) : (
            isEdit ? 'Update Lead' : 'Create Lead'
          )}
        </button>
      </div>
    </form>
  );
};

export default LeadForm;
