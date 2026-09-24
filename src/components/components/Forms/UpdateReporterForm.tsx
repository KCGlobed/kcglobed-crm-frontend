import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { updateUserReportsTo, fetchUsers, fetchUserByUid } from '../../../store/slices/userSlice';
import { fetchReportingManagementOptionsApi } from '../../../services/apiServices';
import toast from 'react-hot-toast';
import { RefreshCw, Check } from 'lucide-react';
import type { User, ReportingOption } from '../../../utils/types';

interface UpdateReporterFormProps {
  userData: User;
}

type UpdateReporterFormValues = {
  reportsToUid: string;
};

const UpdateReporterForm: React.FC<UpdateReporterFormProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { actionLoading } = useAppSelector((state) => state.users);
  
  const [submitting, setSubmitting] = useState(false);
  const [reportingOptions, setReportingOptions] = useState<ReportingOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const initialReportsToUid = (() => {
    if (typeof userData.reports_to === 'object' && userData.reports_to?.uid) {
      return userData.reports_to.uid;
    }
    if (typeof userData.reports_to === 'string') {
      return userData.reports_to;
    }
    return '';
  })();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateReporterFormValues>({
    defaultValues: {
      reportsToUid: initialReportsToUid,
    },
  });

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const reportsToRes = await fetchReportingManagementOptionsApi({ page_size: 1000 });
        const reportsToData = Array.isArray(reportsToRes?.data) ? reportsToRes.data : 
                              Array.isArray(reportsToRes) ? reportsToRes : 
                              reportsToRes?.results || [];
        setReportingOptions(reportsToData);
      } catch (error) {
        toast.error("Failed to load reporting options");
      } finally {
        setLoadingOptions(false);
      }
    };
    
    fetchOptions();
  }, []);

  useEffect(() => {
    reset({ reportsToUid: initialReportsToUid });
  }, [initialReportsToUid, reset]);

  const fullName =
    [userData.first_name, userData.last_name].filter(Boolean).join(' ') ||
    userData.email ||
    'User';

  const currentReporterName =
    typeof userData.reports_to === 'object' && userData.reports_to
      ? userData.reports_to.name || userData.reports_to.email
      : userData.reports_to_name || 'No Manager Assigned';

  const onSubmit = async (data: UpdateReporterFormValues) => {
    if (!userData.uid) {
      toast.error('User identifier is missing');
      return;
    }

    const reportsToObj = data.reportsToUid 
      ? reportingOptions.find((r) => r.uid === data.reportsToUid) 
      : null;

    setSubmitting(true);
    try {
      await dispatch(
        updateUserReportsTo({
          userUid: userData.uid,
          reportsToUid: data.reportsToUid || null,
          reportsToObj,
        })
      ).unwrap();

      toast.success('Reporting manager updated successfully');
      dispatch(fetchUsers());
      dispatch(fetchUserByUid(userData.uid));
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to update reporting manager');
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-primary-soft border border-primary/20">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white text-base font-bold shadow-sm">
          {(userData.first_name || userData.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-crmText truncate">{fullName}</h4>
          </div>
          <div className="flex items-center gap-3 text-xs text-crmText-secondary mt-0.5">
            <span className="truncate">{userData.email}</span>
            <span>•</span>
            <span className="font-medium text-crmText">Current: {currentReporterName}</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5 flex items-center gap-1.5">
          <RefreshCw size={13} className="text-secondary" />
          <span>Reports To</span>
        </label>
        <div className="relative">
          <select
            {...register('reportsToUid')}
            disabled={loadingOptions || isLoading}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
              errors.reportsToUid
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          >
            <option value="">
              {loadingOptions ? 'Loading options...' : 'None / Clear Manager'}
            </option>
            {reportingOptions.map((opt) => (
              <option key={opt.uid} value={opt.uid}>
                 {opt.name || opt.email} ({opt.role || 'No Role'})
              </option>
            ))}
          </select>
        </div>
        {errors.reportsToUid ? (
          <p className="mt-1 text-xs text-red-500">{errors.reportsToUid.message}</p>
        ) : (
          <p className="text-[11px] text-crmText-secondary mt-1.5">
            Select the reporting manager for this user. Leave empty to clear.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-crmBorder/50">
        <button
          type="button"
          onClick={hideModal}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || loadingOptions}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Updating...</span>
            </>
          ) : (
            <>
              <Check size={14} />
              <span>Update Manager</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default UpdateReporterForm;
