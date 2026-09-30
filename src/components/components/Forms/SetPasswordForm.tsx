import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { setUserPassword } from '../../../store/slices/userSlice';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import type { User } from '../../../utils/types';

interface SetPasswordFormProps {
  userData: User;
}

type SetPasswordFormValues = {
  new_password: string;
  confirm_password: string;
};

const SetPasswordForm: React.FC<SetPasswordFormProps> = ({ userData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SetPasswordFormValues>({
    defaultValues: { new_password: '', confirm_password: '' },
  });

  const fullName =
    [userData.first_name, userData.last_name].filter(Boolean).join(' ') || userData.email || 'User';

  const onSubmit = async (data: SetPasswordFormValues) => {
    if (!userData.uid) {
      toast.error('User identifier is missing');
      return;
    }
    setSubmitting(true);
    try {
      await dispatch(
        setUserPassword({
          userUid: userData.uid,
          new_password: data.new_password,
          confirm_password: data.confirm_password,
        })
      ).unwrap();
      toast.success(`Password for ${fullName} has been reset. They are logged out everywhere.`);
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to set password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="p-3 rounded-xl border border-crmBorder bg-major-tint text-xs text-crmText-secondary">
        Setting a new password for <span className="font-bold text-crmText">{fullName}</span>.
        This logs them out of all devices.
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          New Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            {...register('new_password', {
              required: 'New password is required',
              minLength: { value: 8, message: 'Password must be at least 8 characters' },
            })}
            placeholder="Enter new password"
            autoFocus
            className={`w-full px-3.5 py-2.5 pr-10 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.new_password
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
        {errors.new_password && (
          <p className="mt-1 text-xs text-red-500">{errors.new_password.message}</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <input
          type={showPassword ? 'text' : 'password'}
          {...register('confirm_password', {
            required: 'Please confirm the password',
            validate: (val) => val === watch('new_password') || 'Passwords do not match',
          })}
          placeholder="Re-enter new password"
          className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
            errors.confirm_password
              ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
          }`}
        />
        {errors.confirm_password && (
          <p className="mt-1 text-xs text-red-500">{errors.confirm_password.message}</p>
        )}
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
              <span>Setting...</span>
            </>
          ) : (
            'Set Password'
          )}
        </button>
      </div>
    </form>
  );
};

export default SetPasswordForm;
