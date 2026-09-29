import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { createLead, fetchLeads } from '../../../store/slices/leadSlice';
import { LEAD_SOURCES } from '../../../utils/mockLeads';
import toast from 'react-hot-toast';
import type { Lead } from '../../../utils/types';

interface LeadFormProps {
  leadData?: Lead;
}

type LeadFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  source: string;
  remarks: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  landing_page: string;
  referrer: string;
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
      first_name: leadData?.first_name || '',
      last_name: leadData?.last_name || '',
      email: leadData?.email || '',
      phone: leadData?.phone || '',
      city: leadData?.city || '',
      state: leadData?.state || '',
      country: leadData?.country || '',
      source: leadData?.source || '',
      remarks: leadData?.remarks || '',
      utm_source: leadData?.utm_source || '',
      utm_medium: leadData?.utm_medium || '',
      utm_campaign: leadData?.utm_campaign || '',
      utm_term: leadData?.utm_term || '',
      utm_content: leadData?.utm_content || '',
      landing_page: leadData?.landing_page || '',
      referrer: leadData?.referrer || '',
    },
  });

  const onSubmit = async (data: LeadFormValues) => {
    setSubmitting(true);
    try {
      // Only send fields the user filled in
      const payload = Object.fromEntries(
        Object.entries({
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          phone: data.phone.trim(),
          email: data.email.trim(),
          city: data.city.trim(),
          state: data.state.trim(),
          country: data.country.trim(),
          source: data.source,
          remarks: data.remarks.trim(),
          utm_source: data.utm_source.trim(),
          utm_medium: data.utm_medium.trim(),
          utm_campaign: data.utm_campaign.trim(),
          utm_term: data.utm_term.trim(),
          utm_content: data.utm_content.trim(),
          landing_page: data.landing_page.trim(),
          referrer: data.referrer.trim(),
        }).filter(([, value]) => value !== '')
      ) as Lead;

      await dispatch(createLead(payload)).unwrap();
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
        {/* First Name */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('first_name', {
              required: 'First name is required',
              minLength: { value: 2, message: 'First name must be at least 2 characters' },
              validate: (val) => val.trim().length > 0 || 'First name cannot be empty or only spaces',
            })}
            placeholder="e.g. Riya"
            autoFocus
            className={inputClass(!!errors.first_name)}
          />
          {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>}
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Last Name</label>
          <input
            type="text"
            {...register('last_name')}
            placeholder="e.g. Sharma"
            className={inputClass(false)}
          />
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
            placeholder="e.g. riya.sharma@example.com"
            className={inputClass(!!errors.email)}
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Registered Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            {...register('phone', {
              required: 'Phone is required',
              pattern: { value: /^[0-9+\-\s]{10,15}$/, message: 'Enter a valid phone number' },
            })}
            placeholder="e.g. 9179066647"
            className={inputClass(!!errors.phone)}
          />
          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">City</label>
          <input
            type="text"
            {...register('city')}
            placeholder="e.g. Pune"
            className={inputClass(false)}
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">State</label>
          <input
            type="text"
            {...register('state')}
            placeholder="e.g. Maharashtra"
            className={inputClass(false)}
          />
        </div>

        {/* Country */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Country</label>
          <input
            type="text"
            {...register('country')}
            placeholder="e.g. India"
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
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Remarks</label>
        <textarea
          {...register('remarks')}
          placeholder="e.g. Asked about MBA"
          rows={2}
          className={`${inputClass(false)} resize-y`}
        />
      </div>

      {/* Marketing Attribution (optional) */}
      <div>
        <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
          Marketing Attribution (optional)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">UTM Source</label>
            <input type="text" {...register('utm_source')} placeholder="e.g. google" className={inputClass(false)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">UTM Medium</label>
            <input type="text" {...register('utm_medium')} placeholder="e.g. cpc" className={inputClass(false)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">UTM Campaign</label>
            <input type="text" {...register('utm_campaign')} placeholder="e.g. admissions_2026" className={inputClass(false)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">UTM Term</label>
            <input type="text" {...register('utm_term')} placeholder="e.g. mba admission" className={inputClass(false)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">UTM Content</label>
            <input type="text" {...register('utm_content')} placeholder="e.g. ad_1" className={inputClass(false)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">Landing Page</label>
            <input type="text" {...register('landing_page')} placeholder="e.g. https://example.com/mba" className={inputClass(false)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">Referrer</label>
            <input type="text" {...register('referrer')} placeholder="e.g. https://www.google.com/" className={inputClass(false)} />
          </div>
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
