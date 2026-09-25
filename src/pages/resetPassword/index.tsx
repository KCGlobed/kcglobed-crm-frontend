import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, TriangleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { resetPassword, logout } from '../../store/slices/authSlice';
import kcglobedLogo from '../../assets/kcglobed-logo.svg';

type ResetFormValues = { new_password: string; confirm_password: string };

/**
 * Opened from the link in the reset email, e.g.
 *   /reset-password?token=<token>            (or)
 *   /reset-password?uid=<uid>&token=<token>
 */
const ManageResetPassword: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';
  const uid = searchParams.get('uid') || undefined;

  const [submitting, setSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetFormValues>({
    defaultValues: { new_password: '', confirm_password: '' },
  });

  const newPasswordValue = watch('new_password');

  const onResetPassword = async (data: ResetFormValues) => {
    setSubmitting(true);
    try {
      await dispatch(
        resetPassword({
          token,
          uid,
          new_password: data.new_password,
          confirm_password: data.confirm_password,
        })
      ).unwrap();
      toast.success('Password reset successfully. Please login with your new password');
      dispatch(logout());
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `h-12 w-full rounded-xl border bg-major pl-11 pr-12 text-[15px] text-crmText outline-none transition placeholder:text-crmText-tertiary ${
      hasError
        ? 'border-red-500 focus:ring-4 focus:ring-red-500/20'
        : 'border-crmBorder hover:border-crmBorder-strong focus:border-primary focus:ring-4 focus:ring-primary-ring'
    }`;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-major-tint px-4 py-8 sm:px-6 sm:py-10">
      <div className="w-full max-w-[500px] rounded-[28px] border border-crmBorder bg-major p-6 shadow-[0_24px_70px_-28px_rgba(61,31,115,0.28)] sm:p-10">
        {/* Brand */}
        <div className="mb-8 w-fit rounded-2xl dark:bg-white/95 dark:px-3.5 dark:py-2.5 dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
          <img src={kcglobedLogo} alt="KC Globed" width={490} height={128} className="h-10 w-auto sm:h-11" />
        </div>

        {!token ? (
          <>
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-crmDanger-border bg-crmDanger-bg text-crmDanger">
              <TriangleAlert size={22} />
            </span>
            <h1 className="font-outfit text-[26px] font-semibold leading-tight tracking-tight text-crmText">
              Invalid or Expired Link
            </h1>
            <p className="mt-2 text-sm text-crmText-secondary">
              This password reset link is missing or no longer valid. Request a new link to continue.
            </p>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-white shadow-crm-accent transition hover:bg-primary-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring active:translate-y-[1px] cursor-pointer"
            >
              Request a New Link
            </button>
          </>
        ) : (
          <>
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary-soft text-primary-contrast">
              <Lock size={22} />
            </span>
            <h1 className="font-outfit text-[26px] font-semibold leading-tight tracking-tight text-crmText">
              Set New Password
            </h1>
            <p className="mt-2 text-sm text-crmText-secondary">
              Choose a strong password of at least 8 characters. You will use it the next time you login.
            </p>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit(onResetPassword)}>
              <div>
                <label htmlFor="rp-new-password" className="mb-2 block text-[13px] font-medium text-crmText">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-crmText-tertiary"
                  />
                  <input
                    id="rp-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...register('new_password', {
                      required: 'New password is required',
                      minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    })}
                    className={inputClass(!!errors.new_password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-crmText-tertiary transition hover:bg-major-tint hover:text-secondary-contrast"
                  >
                    {showNewPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {errors.new_password && (
                  <p className="mt-1 text-xs text-red-500">{errors.new_password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="rp-confirm-password" className="mb-2 block text-[13px] font-medium text-crmText">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-crmText-tertiary"
                  />
                  <input
                    id="rp-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...register('confirm_password', {
                      required: 'Please confirm your new password',
                      validate: (val) => val === newPasswordValue || 'Passwords do not match',
                    })}
                    className={inputClass(!!errors.confirm_password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-crmText-tertiary transition hover:bg-major-tint hover:text-secondary-contrast"
                  >
                    {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="mt-1 text-xs text-red-500">{errors.confirm_password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-white shadow-crm-accent transition hover:bg-primary-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring active:translate-y-[1px] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-crmText-secondary transition hover:text-crmText"
        >
          <ArrowLeft size={15} />
          Back to Login
        </button>
      </div>
    </div>
  );
};

export const ResetPasswordPage = ManageResetPassword;
export default ManageResetPassword;
