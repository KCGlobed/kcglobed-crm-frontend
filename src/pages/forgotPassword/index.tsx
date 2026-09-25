import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { sendPasswordResetLink } from '../../store/slices/authSlice';
import kcglobedLogo from '../../assets/kcglobed-logo.svg';

type Step = 'email' | 'sent';

type EmailFormValues = { email: string };

const RESEND_SECONDS = 30;

const ManageForgotPassword: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(user?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const backTarget = isAuthenticated ? '/profile' : '/login';
  const backLabel = isAuthenticated ? 'Back to Profile' : 'Back to Login';

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailFormValues>({
    defaultValues: { email: user?.email || '' },
  });

  const requestLink = async (targetEmail: string) => {
    await dispatch(sendPasswordResetLink({ email: targetEmail })).unwrap();
    setEmail(targetEmail);
    setResendIn(RESEND_SECONDS);
  };

  const onSendLink = async (data: EmailFormValues) => {
    setSubmitting(true);
    try {
      await requestLink(data.email.trim());
      toast.success('Password reset link sent to your email');
      setStep('sent');
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to send reset link');
    } finally {
      setSubmitting(false);
    }
  };

  const onResendLink = async () => {
    if (resendIn > 0 || submitting) return;
    setSubmitting(true);
    try {
      await requestLink(email);
      toast.success('A new reset link has been sent');
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to resend reset link');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-major-tint px-4 py-8 sm:px-6 sm:py-10">
      <div className="w-full max-w-[500px] rounded-[28px] border border-crmBorder bg-major p-6 shadow-[0_24px_70px_-28px_rgba(61,31,115,0.28)] sm:p-10">
        {/* Brand */}
        <div className="mb-8 w-fit rounded-2xl dark:bg-white/95 dark:px-3.5 dark:py-2.5 dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
          <img src={kcglobedLogo} alt="KC Globed" width={490} height={128} className="h-10 w-auto sm:h-11" />
        </div>

        {step === 'email' ? (
          <>
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary-soft text-primary-contrast">
              <KeyRound size={22} />
            </span>
            <h1 className="font-outfit text-[26px] font-semibold leading-tight tracking-tight text-crmText">
              Forgot Password?
            </h1>
            <p className="mt-2 text-sm text-crmText-secondary">
              Enter your account email and we will send you a link to reset your password.
            </p>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit(onSendLink)}>
              <div>
                <label htmlFor="fp-email" className="mb-2 block text-[13px] font-medium text-crmText">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-crmText-tertiary"
                  />
                  <input
                    id="fp-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    {...register('email', {
                      required: 'Email address is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Please enter a valid email address',
                      },
                    })}
                    className={`h-12 w-full rounded-xl border bg-major pl-11 pr-4 text-[15px] text-crmText outline-none transition placeholder:text-crmText-tertiary ${
                      errors.email
                        ? 'border-red-500 focus:ring-4 focus:ring-red-500/20'
                        : 'border-crmBorder hover:border-crmBorder-strong focus:border-primary focus:ring-4 focus:ring-primary-ring'
                    }`}
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-white shadow-crm-accent transition hover:bg-primary-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring active:translate-y-[1px] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        ) : (
          <>
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-crmSuccess-border bg-crmSuccess-bg text-crmSuccess">
              <Mail size={22} />
            </span>
            <h1 className="font-outfit text-[26px] font-semibold leading-tight tracking-tight text-crmText">
              Check Your Email
            </h1>
            <p className="mt-2 text-sm text-crmText-secondary">
              We have sent a password reset link to{' '}
              <span className="font-semibold text-crmText">{email}</span>. Open the email and click
              the link to set a new password.
            </p>

            <div className="mt-6 rounded-xl border border-crmBorder bg-major-tint p-4 text-[13px] text-crmText-secondary">
              <p>
                The link will expire after a short time. If you do not see the email, check your
                spam or junk folder.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onResendLink}
                disabled={resendIn > 0 || submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-white shadow-crm-accent transition hover:bg-primary-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring active:translate-y-[1px] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? 'Sending...' : resendIn > 0 ? `Resend Link in ${resendIn}s` : 'Resend Link'}
              </button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-crmBorder bg-major text-[15px] font-semibold text-crmText transition hover:bg-major-tint cursor-pointer"
              >
                Use a Different Email
              </button>
            </div>
          </>
        )}

        {/* Back link */}
        <button
          type="button"
          onClick={() => navigate(backTarget)}
          className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-crmText-secondary transition hover:text-crmText"
        >
          <ArrowLeft size={15} />
          {backLabel}
        </button>
      </div>
    </div>
  );
};

export const ForgotPasswordPage = ManageForgotPassword;
export default ManageForgotPassword;
