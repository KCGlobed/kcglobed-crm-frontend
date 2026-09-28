import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/common/PageHeader';
import LogoutAllModal from '../../components/components/Modal/LogoutAllModal';
import { useModal } from '../../context/ModalContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { changePassword } from '../../store/slices/profileSlice';

type PasswordFormValues = {
  old_password: string;
  new_password: string;
  confirm_password: string;
};

const ManageChangePassword: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showModal } = useModal();

  const [savingPassword, setSavingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<PasswordFormValues>({
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  });

  const oldPasswordValue = watch('old_password');
  const newPasswordValue = watch('new_password') || '';
  const confirmPasswordValue = watch('confirm_password');

  const passwordChecks = [
    { label: 'At least 8 characters', passed: newPasswordValue.length >= 8 },
    { label: 'Contains a number', passed: /\d/.test(newPasswordValue) },
    { label: 'Contains upper & lower case', passed: /[a-z]/.test(newPasswordValue) && /[A-Z]/.test(newPasswordValue) },
    { label: 'Contains a symbol', passed: /[^A-Za-z0-9]/.test(newPasswordValue) },
    { label: 'Different from current password', passed: !!newPasswordValue && newPasswordValue !== oldPasswordValue },
    { label: 'New and confirm passwords match', passed: !!newPasswordValue && newPasswordValue === confirmPasswordValue },
  ];

  // Strength: only the composition rules count (first four checks)
  const strengthScore = passwordChecks.slice(0, 4).filter((c) => c.passed).length;
  const strength = !newPasswordValue
    ? { label: 'Enter a password', bar: 'bg-crmBorder-strong', text: 'text-crmText-tertiary' }
    : strengthScore <= 1
      ? { label: 'Weak', bar: 'bg-crmDanger', text: 'text-crmDanger' }
      : strengthScore === 2
        ? { label: 'Fair', bar: 'bg-secondary', text: 'text-secondary-contrast' }
        : strengthScore === 3
          ? { label: 'Good', bar: 'bg-minor-light', text: 'text-minor-contrast' }
          : { label: 'Strong', bar: 'bg-crmSuccess', text: 'text-crmSuccess' };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setSavingPassword(true);
    try {
      await dispatch(
        changePassword({
          old_password: data.old_password,
          new_password: data.new_password,
          confirm_password: data.confirm_password,
        })
      ).unwrap();
      toast.success('Password changed successfully');
      reset();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3.5 py-2.5 pr-11 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm placeholder:text-crmText-tertiary ${
      hasError
        ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
        : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
    }`;

  const passwordFields: {
    name: keyof PasswordFormValues;
    label: string;
    placeholder: string;
    show: boolean;
    toggle: () => void;
    rules: Parameters<typeof register>[1];
  }[] = [
    {
      name: 'old_password',
      label: 'Current Password',
      placeholder: 'Enter current password',
      show: showOldPassword,
      toggle: () => setShowOldPassword((prev) => !prev),
      rules: { required: 'Current password is required' },
    },
    {
      name: 'new_password',
      label: 'New Password',
      placeholder: 'Enter new password',
      show: showNewPassword,
      toggle: () => setShowNewPassword((prev) => !prev),
      rules: {
        required: 'New password is required',
        minLength: { value: 8, message: 'Password must be at least 8 characters' },
        validate: (val: string) =>
          val !== oldPasswordValue || 'New password must be different from current password',
      },
    },
    {
      name: 'confirm_password',
      label: 'Confirm New Password',
      placeholder: 'Re-enter new password',
      show: showConfirmPassword,
      toggle: () => setShowConfirmPassword((prev) => !prev),
      rules: {
        required: 'Please confirm your new password',
        validate: (val: string) => val === newPasswordValue || 'Passwords do not match',
      },
    },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader
        title="Change Password"
        description="Update the password you use to sign in to KC Globed CRM."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Form */}
        <div className="rounded-2xl border border-crmBorder bg-major shadow-crm-card">
          <div className="flex items-center gap-3 border-b border-crmBorder px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-minor-soft text-minor-contrast">
              <KeyRound size={16} />
            </span>
            <div>
              <h3 className="font-outfit text-[15px] font-semibold text-crmText">New Password</h3>
              <p className="text-[11px] text-crmText-secondary">Confirm your current password, then choose a new one.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-5 p-5">
            {passwordFields.map((field) => (
              <div key={field.name}>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-crmText">
                    {field.label} <span className="text-red-500">*</span>
                  </label>
                  {field.name === 'old_password' && (
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs font-semibold text-secondary-contrast transition hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={field.show ? 'text' : 'password'}
                    autoComplete={field.name === 'old_password' ? 'current-password' : 'new-password'}
                    {...register(field.name, field.rules)}
                    placeholder={field.placeholder}
                    className={inputClass(!!errors[field.name])}
                  />
                  <button
                    type="button"
                    onClick={field.toggle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-crmText-tertiary hover:text-crmText cursor-pointer"
                    aria-label={field.show ? 'Hide password' : 'Show password'}
                  >
                    {field.show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors[field.name] && (
                  <p className="mt-1 text-xs text-red-500">{errors[field.name]?.message}</p>
                )}

                {field.name === 'new_password' && (
                  <div className="mt-2.5">
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <span
                          key={step}
                          className={`h-1.5 rounded-full transition-colors ${
                            newPasswordValue && step <= strengthScore ? strength.bar : 'bg-major-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-crmText-tertiary">Password strength</span>
                      <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-3 border-t border-crmBorder pt-5">
              <button
                type="button"
                onClick={() => reset()}
                disabled={savingPassword || !isDirty}
                className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={savingPassword}
                className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none"
              >
                {savingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Side */}
        <div className="flex h-fit flex-col gap-6">
          {/* Requirements */}
          <div className="rounded-2xl border border-crmBorder bg-major shadow-crm-card">
            <div className="flex items-center justify-between border-b border-crmBorder px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-soft text-secondary-contrast">
                  <ShieldCheck size={16} />
                </span>
                <h3 className="font-outfit text-[15px] font-semibold text-crmText">Requirements</h3>
              </div>
              <span className="rounded-full border border-crmBorder bg-major-tint px-2 py-0.5 font-mono text-[10px] font-bold text-crmText-secondary">
                {passwordChecks.filter((c) => c.passed).length}/{passwordChecks.length}
              </span>
            </div>
            <ul className="space-y-3 p-5">
              {passwordChecks.map((check) => (
                <li key={check.label} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      check.passed
                        ? 'border-crmSuccess-border bg-crmSuccess-bg text-crmSuccess'
                        : 'border-crmBorder bg-major-tint text-crmText-tertiary'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className={check.passed ? 'font-semibold text-crmText' : 'text-crmText-secondary'}>
                    {check.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sessions */}
          <div className="rounded-2xl border border-crmBorder bg-major shadow-crm-card">
            <div className="flex items-center gap-3 border-b border-crmBorder px-5 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-crmDanger-bg text-crmDanger">
                <LogOut size={16} />
              </span>
              <h3 className="font-outfit text-[15px] font-semibold text-crmText">Sessions</h3>
            </div>
            <div className="p-5">
              <p className="text-xs leading-relaxed text-crmText-secondary">
                Signed in on a shared device, or think someone else has your password? End every active
                session for your account, including this one.
              </p>
              <button
                type="button"
                onClick={() =>
                  showModal({
                    content: <LogoutAllModal />,
                    type: 'custom',
                    size: 'md',
                  })
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-crmDanger-border bg-major px-4 py-2.5 text-xs font-semibold text-crmDanger transition-all hover:bg-crmDanger-bg cursor-pointer"
              >
                <LogOut size={15} />
                Logout from all devices
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChangePasswordPage = ManageChangePassword;
export default ManageChangePassword;
