import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { createReportingUser, fetchReportingManagementOptions } from '../../../store/slices/reportingMangementSlice';
import { fetchRoleOptionsApi, fetchReportingManagementOptionsApi } from '../../../services/apiServices';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import type { Role, ReportingOption } from '../../../utils/types';

type ReportingFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone1: string;
  role: string;
  reports_to: string | null;
  password?: string;
};

const ReportingForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [reportingOptions, setReportingOptions] = useState<ReportingOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<ReportingFormValues>({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone1: '',
      role: '',
      reports_to: null,
      password: '',
    },
  });

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const [rolesRes, reportsToRes] = await Promise.all([
          fetchRoleOptionsApi(),
          fetchReportingManagementOptionsApi({ page_size: 1000 }) // Fetch enough options for dropdown
        ]);
        
        setRoles(rolesRes?.data || []);
        
        // Handle reporting options based on the provided sample response
        const reportsToData = Array.isArray(reportsToRes?.data) ? reportsToRes.data : 
                              Array.isArray(reportsToRes) ? reportsToRes : 
                              reportsToRes?.results || [];
        setReportingOptions(reportsToData);
      } catch (error) {
        toast.error("Failed to load form options");
      } finally {
        setLoadingOptions(false);
      }
    };
    
    fetchOptions();
  }, []);

  const onSubmit = async (data: ReportingFormValues) => {
    setSubmitting(true);
    try {
      const formattedPhone = (data.phone1 && data.phone1.trim() !== '+91') ? data.phone1.trim() : '';

      const payload: Record<string, any> = {
        email: data.email.trim(),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        phone1: formattedPhone,
        role: data.role,
        reports_to: data.reports_to || null,
      };

      if (data.password) {
        payload.password = data.password;
      }

      await dispatch(createReportingUser(payload)).unwrap();
      toast.success('Reporting user created successfully');
      
      // Refresh the table list (assumes current page is 1 for simplicity, or we just refresh)
      dispatch(fetchReportingManagementOptions({ page: 1, page_size: 10 }));
      
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to create reporting user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  if (loadingOptions) {
    return <div className="p-4 text-center text-sm text-crmText-secondary">Loading options...</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('first_name', {
              required: 'First name is required',
              minLength: { value: 2, message: 'Must be at least 2 characters' },
              validate: (val) => val.trim().length > 0 || 'Cannot be empty',
            })}
            placeholder="e.g. Tina"
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.first_name ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.first_name && <p className="text-red-500 text-xs mt-1.5">{errors.first_name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Last Name</label>
          <input
            type="text"
            {...register('last_name')}
            placeholder="e.g. Lead"
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: 'Invalid email address' },
            })}
            placeholder="e.g. teamlead@gccschool.in"
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.email ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Phone Number</label>
          <Controller
            name="phone1"
            control={control}
            render={({ field }) => (
              <PhoneInput
                {...field}
                defaultCountry="in"
                inputClassName={`w-full bg-major border-l-0 text-sm text-crmText outline-none transition-all ${
                  errors.phone1 ? 'border-red-500' : 'border-crmBorder'
                }`}
                className="phone-input-container rounded-xl overflow-hidden shadow-sm flex"
                style={{
                  '--react-international-phone-border-color': errors.phone1 ? '#ef4444' : '#e5e7eb',
                  '--react-international-phone-border-radius': '0.75rem',
                  '--react-international-phone-height': '42px',
                  '--react-international-phone-background': 'var(--color-bg-major)',
                } as React.CSSProperties}
              />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            {...register('role', { required: 'Role is required' })}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm appearance-none ${
              errors.role ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1rem',
            }}
          >
            <option value="">Select a role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {errors.role && <p className="text-red-500 text-xs mt-1.5">{errors.role.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Reports To</label>
          <select
            {...register('reports_to')}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm appearance-none"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1rem',
            }}
          >
            <option value="">Select manager (Optional)</option>
            {reportingOptions.map((opt) => (
              <option key={opt.uid} value={opt.uid}>
                {opt.name || opt.email} ({opt.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 6, message: 'Password must be at least 6 characters' },
            })}
            placeholder="Enter password"
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm pr-10 ${
              errors.password ? 'border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-3 flex items-center text-crmText-tertiary hover:text-crmText-secondary"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-crmBorder mt-6">
        <button
          type="button"
          onClick={hideModal}
          className="px-5 py-2 text-sm font-semibold text-crmText-secondary bg-major border border-crmBorder hover:bg-crmBorder/30 rounded-xl transition-all"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-5 py-2 text-sm font-semibold text-white bg-minor hover:bg-minor-hover rounded-xl shadow-minor/20 shadow-sm transition-all flex items-center justify-center min-w-[120px]"
          disabled={submitting}
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Add User'
          )}
        </button>
      </div>
    </form>
  );
};

export default ReportingForm;