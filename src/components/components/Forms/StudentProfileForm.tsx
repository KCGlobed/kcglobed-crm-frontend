import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import {
  fetchLeadProfile,
  updateLeadProfile,
  completeLeadProfile,
  fetchLeadById,
} from '../../../store/slices/leadSlice';
import toast from 'react-hot-toast';
import type { Lead, Student } from '../../../utils/types';

interface StudentProfileFormProps {
  leadData: Lead;
  // Whether the current stage/permissions allow editing (available_actions has update_profile)
  editable: boolean;
  canComplete: boolean;
}

// Editable application fields, grouped for the form layout
const PROFILE_GROUPS: { title: string; fields: { name: keyof Student; label: string; type?: string; options?: { value: string; label: string }[] }[] }[] = [
  {
    title: 'Personal',
    fields: [
      { name: 'first_name', label: 'First Name' },
      { name: 'last_name', label: 'Last Name' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      {
        name: 'gender',
        label: 'Gender',
        type: 'select',
        options: [
          { value: '0', label: 'Male' },
          { value: '1', label: 'Female' },
          { value: '2', label: 'Other' },
        ],
      },
      { name: 'nationality', label: 'Nationality' },
      { name: 'address', label: 'Address' },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'pincode', label: 'Pincode' },
    ],
  },
  {
    title: 'Academic',
    fields: [
      { name: 'tenth_passing_year', label: '10th Passing Year' },
      { name: 'tenth_passing_percentage', label: '10th Percentage' },
      { name: 'twelveth_passing_year', label: '12th Passing Year' },
      { name: 'twelveth_passing_percentage', label: '12th Percentage' },
      { name: 'institution', label: 'Institution' },
      { name: 'higher_qualification', label: 'Higher Qualification' },
      { name: 'employement_status', label: 'Employment Status' },
    ],
  },
  {
    title: 'Guardian',
    fields: [
      {
        name: 'guardian_dropdown',
        label: 'Guardian',
        type: 'select',
        options: [
          { value: 'MOTHER', label: 'Mother' },
          { value: 'FATHER', label: 'Father' },
          { value: 'SPOUSE', label: 'Spouse' },
          { value: 'OTHER', label: 'Other' },
        ],
      },
      { name: 'guardian_name', label: 'Guardian Name' },
      { name: 'guardian_phone', label: 'Guardian Phone' },
      { name: 'guardian_email', label: 'Guardian Email', type: 'email' },
      { name: 'guardian_other_reason', label: 'Guardian Other Reason' },
    ],
  },
  {
    title: 'Program',
    fields: [
      { name: 'initial_program', label: 'Initial Program' },
      { name: 'final_program', label: 'Final Program' },
    ],
  },
];

const inputClass =
  'w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring disabled:opacity-60 disabled:cursor-not-allowed';

const StudentProfileForm: React.FC<StudentProfileFormProps> = ({ leadData, editable, canComplete }) => {
  const dispatch = useAppDispatch();
  const { profile, profileLoading, actionLoading } = useAppSelector((state) => state.leads);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Load the profile once when the tab opens (GET /api/leads/{uid}/profile/)
  useEffect(() => {
    if (leadData.uid) {
      dispatch(fetchLeadProfile(leadData.uid));
    }
  }, [dispatch, leadData.uid]);

  // Seed the form whenever a fresh application payload arrives
  useEffect(() => {
    if (profile?.application) {
      const seeded: Record<string, any> = {};
      PROFILE_GROUPS.forEach((group) =>
        group.fields.forEach(({ name }) => {
          const value = (profile.application as any)?.[name];
          seeded[name] = value === null || value === undefined ? '' : String(value);
        })
      );
      setValues(seeded);
    }
  }, [profile?.application]);

  const missingFields = profile?.missing_fields || [];

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!leadData.uid) return;
    setSaving(true);
    try {
      // Only send non-empty values (backend validates per field)
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      await dispatch(updateLeadProfile({ uid: leadData.uid, payload })).unwrap();
      toast.success('Profile updated');
      dispatch(fetchLeadProfile(leadData.uid));
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!leadData.uid) return;
    setCompleting(true);
    try {
      await dispatch(completeLeadProfile(leadData.uid)).unwrap();
      toast.success('Profile completed');
      dispatch(fetchLeadById(leadData.uid));
      dispatch(fetchLeadProfile(leadData.uid));
    } catch (err: any) {
      toast.error(err?.message || err || 'Please complete required student profile fields.');
      dispatch(fetchLeadProfile(leadData.uid));
    } finally {
      setCompleting(false);
    }
  };

  if (profileLoading && !profile) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <span className="inline-block h-7 w-7 rounded-full border-[3px] border-minor/30 border-t-minor animate-spin" />
      </div>
    );
  }

  if (!profile?.application) {
    return (
      <div className="p-6 text-center text-crmText-tertiary text-xs italic">
        No student application exists for this lead yet.
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      {missingFields.length > 0 && (
        <div className="p-3 rounded-xl border border-crmDanger-border bg-crmDanger-bg text-xs text-crmDanger">
          <span className="font-bold">Missing required fields:</span>{' '}
          {missingFields.map((f) => f.replace(/_/g, ' ')).join(', ')}
        </div>
      )}

      {PROFILE_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2">
            {group.title}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.fields.map(({ name, label, type, options }) => {
              const isMissing = missingFields.includes(name as string);
              return (
                <div key={name as string}>
                  <label className={`block text-xs font-semibold mb-1.5 ${isMissing ? 'text-crmDanger' : 'text-crmText'}`}>
                    {label}
                    {isMissing && <span className="text-red-500"> *</span>}
                  </label>
                  {type === 'select' ? (
                    <select
                      value={values[name as string] ?? ''}
                      onChange={(e) => handleChange(name as string, e.target.value)}
                      disabled={!editable}
                      className={`${inputClass} cursor-pointer appearance-none ${isMissing ? 'border-crmDanger-border' : ''}`}
                    >
                      <option value="">Select</option>
                      {(options || []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type || 'text'}
                      value={values[name as string] ?? ''}
                      onChange={(e) => handleChange(name as string, e.target.value)}
                      disabled={!editable}
                      className={`${inputClass} ${isMissing ? 'border-crmDanger-border' : ''}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {editable && (
        <div className="flex justify-end gap-3 pt-2 border-t border-crmBorder">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || actionLoading}
            className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-crmText/30 border-t-crmText rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              'Save Profile'
            )}
          </button>
          {canComplete && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing || actionLoading}
              className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
            >
              {completing ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                'Complete Profile'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentProfileForm;
