import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { loginUser } from '../../store/slices/authSlice';
import kcglobedLogo from '../../assets/kcglobed-logo.svg';

type LoginFormValues = {
  email: string;
  password: string;
};

/**
 * Login screen (UI only).
 * Two-column card: form on the left, CRM illustration on the right.
 * Uses the shared CRM theme tokens, so the form side follows light/dark mode
 * while the illustration panel stays on its light brand gradient.
 */
const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading } = useAppSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const actionResult = await dispatch(loginUser({ email: data.email.trim(), password: data.password }));
      if (loginUser.fulfilled.match(actionResult)) {
        toast.success('Login successful');
        navigate('/dashboard');
      } else {
        toast.error((actionResult.payload as string) || 'Login failed');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-major-tint px-4 py-8 sm:px-6 sm:py-10">
      <div className="grid w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-crmBorder bg-major shadow-[0_24px_70px_-28px_rgba(61,31,115,0.28)] lg:grid-cols-2">
        {/* ---------------------------------------------------------------- */}
        {/* Left : login form                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
          {/* Brand - clean backdrop in dark mode with smooth radius */}
          <div className="mb-10 w-fit rounded-2xl dark:bg-white/95 dark:px-3.5 dark:py-2.5 dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
            <img
              src={kcglobedLogo}
              alt="KC Globed"
              width={490}
              height={128}
              className="h-11 w-auto sm:h-12"
            />
          </div>

          {/* Heading */}
          <h1 className="font-outfit text-[28px] font-semibold leading-tight tracking-tight text-crmText sm:text-[32px]">
            Welcome Back
          </h1>
          <p className="mt-2 text-[15px] text-crmText-secondary">Login to your CRM account</p>

          {/* Form */}
          <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-medium text-crmText"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-crmText-tertiary"
                />
                <input
                  id="email"
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
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[13px] font-medium text-crmText"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-crmText-tertiary"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  className={`h-12 w-full rounded-xl border bg-major pl-11 pr-12 text-[15px] text-crmText outline-none transition placeholder:text-crmText-tertiary ${
                    errors.password
                      ? 'border-red-500 focus:ring-4 focus:ring-red-500/20'
                      : 'border-crmBorder hover:border-crmBorder-strong focus:border-primary focus:ring-4 focus:ring-primary-ring'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-crmText-tertiary transition hover:bg-major-tint hover:text-secondary-contrast focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <a
                href="#"
                className="text-[13px] font-semibold text-secondary-contrast transition hover:underline"
              >
                Forgot Password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-white shadow-crm-accent transition hover:bg-primary-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-ring active:translate-y-[1px] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right : CRM illustration                                         */}
        {/* ---------------------------------------------------------------- */}
        <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-[#F8F5FC] via-[#F4EEFA] to-[#FCF8F2] dark:from-[#181322] dark:via-[#130f1a] dark:to-[#0f0c15] p-10 lg:flex border-l border-crmBorder">
          <svg
            viewBox="0 0 520 460"
            role="img"
            aria-label="Illustration of a CRM dashboard with leads, analytics and sales performance"
            className="h-auto w-full max-w-[460px]"
          >
            <defs>
              <linearGradient id="loginBarGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#FBB03B" />
                <stop offset="100%" stopColor="#3D1F73" />
              </linearGradient>
              <linearGradient id="loginPillGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3D1F73" />
                <stop offset="100%" stopColor="#FBB03B" />
              </linearGradient>
              <filter id="loginCardShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="10"
                  stdDeviation="12"
                  floodColor="#3D1F73"
                  floodOpacity="0.14"
                />
              </filter>
            </defs>

            {/* Soft background shapes */}
            <circle cx="432" cy="86" r="62" className="fill-[#FBB03B] dark:fill-[#FBB03B] opacity-20 dark:opacity-15" />
            <circle cx="74" cy="392" r="48" className="fill-[#3D1F73] dark:fill-[#3D1F73] opacity-20 dark:opacity-15" />
            <circle cx="256" cy="228" r="180" className="fill-[#3D1F73] dark:fill-[#3D1F73] opacity-10 dark:opacity-10" />

            {/* Main dashboard card */}
            <g filter="url(#loginCardShadow)">
              <rect
                x="56"
                y="70"
                width="352"
                height="250"
                rx="20"
                className="fill-white dark:fill-[#1f1a29] stroke-[#E9E1F3] dark:stroke-[#3d3449]"
                strokeWidth="1.5"
              />
            </g>

            {/* Dashboard header */}
            <rect x="80" y="94" width="96" height="10" rx="5" className="fill-[#3D1F73] dark:fill-[#8352e8]" />
            <rect x="80" y="112" width="62" height="8" rx="4" className="fill-[#D8CCE8] dark:fill-[#5f576b]" />
            <rect x="322" y="94" width="62" height="22" rx="11" className="fill-[#F5EFFC] dark:fill-[#2b2236]" />
            <rect x="334" y="102" width="38" height="6" rx="3" className="fill-[#9581B8] dark:fill-[#8b8096]" />

            {/* KPI tiles */}
            {[
              { x: 80, value: '#3D1F73' },
              { x: 184, value: '#FBB03B' },
              { x: 288, value: '#6333bf' },
            ].map((tile) => (
              <g key={tile.x}>
                <rect
                  x={tile.x}
                  y="136"
                  width="96"
                  height="54"
                  rx="10"
                  className="fill-[#FAF6FD] dark:fill-[#261f30] stroke-[#EDE4F6] dark:stroke-[#3d3449]"
                />
                <rect
                  x={tile.x + 12}
                  y="150"
                  width="34"
                  height="10"
                  rx="5"
                  fill={tile.value}
                />
                <rect
                  x={tile.x + 12}
                  y="168"
                  width="54"
                  height="6"
                  rx="3"
                  className="fill-[#D8CCE8] dark:fill-[#5f576b]"
                />
              </g>
            ))}

            {/* Bar chart */}
            <rect
              x="80"
              y="204"
              width="304"
              height="96"
              rx="12"
              className="fill-white dark:fill-[#1f1a29] stroke-[#EDE4F6] dark:stroke-[#3d3449]"
            />
            {[
              { x: 114, h: 34, accent: false },
              { x: 150, h: 52, accent: false },
              { x: 186, h: 28, accent: false },
              { x: 222, h: 66, accent: true },
              { x: 258, h: 44, accent: false },
              { x: 294, h: 74, accent: true },
              { x: 330, h: 56, accent: false },
            ].map((bar) => (
              <rect
                key={bar.x}
                x={bar.x}
                y={288 - bar.h}
                width="20"
                height={bar.h}
                rx="6"
                fill={bar.accent ? 'url(#loginBarGrad)' : undefined}
                className={bar.accent ? undefined : 'fill-[#E8DDF4] dark:fill-[#3d3449]'}
              />
            ))}
            <rect x="100" y="288" width="264" height="2" rx="1" className="fill-[#EDE4F6] dark:fill-[#3d3449]" />

            {/* Analytics card */}
            <g filter="url(#loginCardShadow)">
              <rect
                x="336"
                y="24"
                width="150"
                height="120"
                rx="16"
                className="fill-white dark:fill-[#1f1a29] stroke-[#E9E1F3] dark:stroke-[#3d3449]"
                strokeWidth="1.5"
              />
            </g>
            <g transform="rotate(-90 374 84)">
              <circle cx="374" cy="84" r="26" fill="none" className="stroke-[#F0E8F8] dark:stroke-[#2e2739]" strokeWidth="11" />
              <circle
                cx="374"
                cy="84"
                r="26"
                fill="none"
                stroke="#3D1F73"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray="73 164"
              />
              <circle
                cx="374"
                cy="84"
                r="26"
                fill="none"
                stroke="#FBB03B"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray="45 164"
                strokeDashoffset="-78"
              />
            </g>
            {[
              { y: 62, color: '#3D1F73', w: 44 },
              { y: 80, color: '#FBB03B', w: 36 },
              { y: 98, color: '#D5C4EB', w: 40 },
            ].map((legend) => (
              <g key={legend.y}>
                <rect x="412" y={legend.y} width="8" height="8" rx="2" fill={legend.color} />
                <rect
                  x="426"
                  y={legend.y + 1}
                  width={legend.w}
                  height="6"
                  rx="3"
                  className="fill-[#E5DAF2] dark:fill-[#5f576b]"
                />
              </g>
            ))}

            {/* Leads card */}
            <g filter="url(#loginCardShadow)">
              <rect
                x="24"
                y="284"
                width="210"
                height="132"
                rx="16"
                className="fill-white dark:fill-[#1f1a29] stroke-[#E9E1F3] dark:stroke-[#3d3449]"
                strokeWidth="1.5"
              />
            </g>
            <rect x="44" y="304" width="66" height="9" rx="4.5" className="fill-[#3D1F73] dark:fill-[#8352e8]" />
            <rect x="188" y="304" width="26" height="9" rx="4.5" className="fill-[#DFD0F1] dark:fill-[#5f576b]" />
            {[
              { cy: 336, avatar: '#3D1F73' },
              { cy: 368, avatar: '#FBB03B' },
              { cy: 398, avatar: '#5c30ad' },
            ].map((lead) => (
              <g key={lead.cy}>
                <circle cx="60" cy={lead.cy} r="13" fill={lead.avatar} />
                <circle cx="60" cy={lead.cy - 4} r="4.2" fill="#FFFFFF" />
                <path
                  d={`M52.5 ${lead.cy + 9} a7.5 7.5 0 0 1 15 0 z`}
                  fill="#FFFFFF"
                />
                <rect x="82" y={lead.cy - 9} width="76" height="8" rx="4" className="fill-[#E5DAF2] dark:fill-[#3d3449]" />
                <rect x="82" y={lead.cy + 3} width="50" height="6" rx="3" className="fill-[#F2EBF9] dark:fill-[#2d2438]" />
                <rect x="168" y={lead.cy - 8} width="42" height="16" rx="8" className="fill-[#EFE4F8] dark:fill-[#30233b]" />
              </g>
            ))}

            {/* Sales performance pill */}
            <g filter="url(#loginCardShadow)">
              <rect x="286" y="350" width="162" height="58" rx="16" fill="url(#loginPillGrad)" />
            </g>
            <circle cx="316" cy="379" r="16" fill="#FFFFFF" opacity="0.18" />
            <polyline
              points="308,384 314,377 319,381 325,372"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="321,372 325,372 325,376"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="344" y="368" width="62" height="9" rx="4.5" fill="#FFFFFF" opacity="0.9" />
            <rect x="344" y="384" width="42" height="7" rx="3.5" fill="#FFFFFF" opacity="0.5" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
