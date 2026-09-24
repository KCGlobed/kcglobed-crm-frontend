import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { createUser, fetchUsers } from '../../../store/slices/userSlice';
import { fetchRoles } from '../../../store/slices/roleSlice';
import { fetchReportingManagementOptions } from '../../../store/slices/reportingMangementSlice';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import type { User, Role, ReportingOption } from '../../../utils/types';

interface UserFormProps {
  userData?: User;
}

type UserFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone1: string;
  role: string;
  reports_to: string | null;
  password?: string;
};

const UserForm: React.FC<UserFormProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { data: roles, loading: rolesLoading } = useAppSelector((state) => state.roles);
  const { data: reportingUsers, loading: reportingLoading } = useAppSelector((state) => state.reportingManagement);

  const isEdit = !!userData;
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const roleList: Role[] = useMemo(() => {
    if (Array.isArray(roles)) return roles;
    if (Array.isArray((roles as any)?.results)) return (roles as any).results;
    if (Array.isArray((roles as any)?.data)) return (roles as any).data;
    return [];
  }, [roles]);

  // Fetch roles if not already in store
  useEffect(() => {
    if (!roleList || roleList.length === 0) {
      dispatch(fetchRoles());
    }
  }, [dispatch, roleList]);

  // Fetch reporting options if not already in store
  useEffect(() => {
    if (!reportingUsers || reportingUsers.length === 0) {
      dispatch(fetchReportingManagementOptions({ page_size: 1000 }));
    }
  }, [dispatch, reportingUsers]);

  const initialRoleId = (() => {
    if (typeof userData?.role === 'object' && userData?.role?.id != null) {
      return String(userData.role.id);
    }
    if (typeof userData?.role === 'number' || typeof userData?.role === 'string') {
      return String(userData.role);
    }
    return '';
  })();

  const initialReportsTo = (() => {
    if (typeof userData?.reports_to === 'object' && userData?.reports_to?.uid != null) {
      return String(userData.reports_to.uid);
    }
    if (typeof userData?.reports_to === 'number' || typeof userData?.reports_to === 'string') {
      return String(userData.reports_to);
    }
    return '';
  })();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<UserFormValues>({
    defaultValues: {
      first_name: userData?.first_name || '',
      last_name: userData?.last_name || '',
      email: userData?.email || '',
      phone1: userData?.phone1 || userData?.phone || '',
      role: initialRoleId,
      reports_to: initialReportsTo,
      password: '',
    },
  });

  useEffect(() => {
    if (userData) {
      reset({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        phone1: userData.phone1 || userData.phone || '',
        role: initialRoleId,
        reports_to: initialReportsTo,
        password: '',
      });
    }
  }, [userData, initialRoleId, reset]);

  const onSubmit = async (data: UserFormValues) => {
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

      await dispatch(createUser(payload)).unwrap();
      toast.success('User created successfully');
      dispatch(fetchUsers());
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            placeholder="e.g. Rahul"
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.first_name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.first_name && (
            <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('last_name', {
              required: 'Last name is required',
              minLength: { value: 1, message: 'Last name must be at least 1 character' },
              validate: (val) => val.trim().length > 0 || 'Last name cannot be empty or only spaces',
            })}
            placeholder="e.g. Kumar"
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.last_name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.last_name && (
            <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          {...register('email', {
            required: 'Email address is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Please enter a valid email address',
            },
          })}
          placeholder="e.g. rahul@gccschool.in"
          className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
            errors.email
              ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
          }`}
        />
        {errors.email && (
          <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Phone & Role Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <Controller
            name="phone1"
            control={control}
            rules={{
              required: 'Phone number is required',
              validate: (val) => {
                if (!val || !val.trim() || val.trim() === '+' || val.trim() === '+91') {
                  return 'Phone number is required';
                }
                const digits = val.replace(/\D/g, '');
                if (val.startsWith('+91')) {
                  const nationalNumber = digits.slice(2);
                  if (nationalNumber.length === 0) {
                    return 'Phone number is required';
                  }
                  if (nationalNumber.length !== 10) {
                    return 'Please enter a valid 10-digit Indian phone number';
                  }
                  if (!/^[6-9]/.test(nationalNumber)) {
                    return 'Indian mobile numbers must start with 6, 7, 8, or 9';
                  }
                } else {
                  if (digits.length < 8 || digits.length > 15) {
                    return 'Please enter a valid phone number (8-15 digits)';
                  }
                }
                return true;
              },
            }}
            render={({ field }) => (
              <PhoneInput
                defaultCountry="in"
                value={field.value}
                onChange={(phone) => field.onChange(phone)}
                className={`w-full ${errors.phone1 ? 'has-error' : ''}`}
                inputClassName="w-full flex-1"
              />
            )}
          />
          {errors.phone1 && (
            <p className="mt-1 text-xs text-red-500">{errors.phone1.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            {...register('role', {
              required: 'Please select a role',
            })}
            disabled={rolesLoading}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.role
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          >
            <option value="">{rolesLoading ? 'Loading roles...' : 'Select a role...'}</option>
            {roleList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {errors.role && (
            <p className="mt-1 text-xs text-red-500">{errors.role.message}</p>
          )}
        </div>
      </div>

      {/* Reports To & Password */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Reports To</label>
          <select
            {...register('reports_to')}
            disabled={reportingLoading}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm appearance-none"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.75rem center',
              backgroundSize: '1rem',
            }}
          >
            <option value="">{reportingLoading ? 'Loading managers...' : 'Select manager (Optional)'}</option>
            {reportingUsers?.map((opt: ReportingOption) => (
              <option key={opt.uid} value={opt.uid}>
                {opt.name || opt.email} ({opt.role})
              </option>
            ))}
          </select>
        </div>

        {/* Password */}
        {!isEdit && (
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
                placeholder="Enter account password"
                className={`w-full px-3.5 py-2.5 pr-10 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
                  errors.password
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-crmText-tertiary hover:text-crmText transition-colors p-0.5 bg-transparent border-none cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-crmBorder">
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
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            'Create User'
          )}
        </button>
      </div>
    </form>
  );
};

export default UserForm;
