import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { loginUser } from '../../store/slices/authSlice';
import kcglobedLogo from '../../assets/kcglobed-logo.svg';

/**
 * Login screen (UI only).
 * Two-column card: form on the left, CRM illustration on the right.
 * Uses the shared CRM theme tokens, so the form side follows light/dark mode
 * while the illustration panel stays on its light brand gradient.
 */
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading } = useAppSelector((state) => state.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password');
      return;
    }
    try {
      const actionResult = await dispatch(loginUser({ email, password }));
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
      <div className="grid w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-crmBorder bg-major shadow-[0_24px_70px_-28px_rgba(112,26,117,0.28)] lg:grid-cols-2">
        {/* ---------------------------------------------------------------- */}
        {/* Left : login form                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
          {/* Brand - the lockup keeps a light backing in dark mode so the
              dark wordmark inside the SVG stays readable. */}
          <div className="mb-10 w-fit rounded-xl dark:bg-white dark:px-3 dark:py-2">
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
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-medium text-crmText"
              >
                Email Address
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-crmBorder bg-major pl-11 pr-4 text-[15px] text-crmText outline-none transition placeholder:text-crmText-tertiary hover:border-crmBorder-strong focus:border-minor focus:ring-4 focus:ring-minor-ring"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[13px] font-medium text-crmText"
              >
                Password
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-crmBorder bg-major pl-11 pr-12 text-[15px] text-crmText outline-none transition placeholder:text-crmText-tertiary hover:border-crmBorder-strong focus:border-minor focus:ring-4 focus:ring-minor-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-crmText-tertiary transition hover:bg-major-tint hover:text-minor-contrast focus:outline-none focus-visible:ring-2 focus-visible:ring-minor-ring"
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <a
                href="#"
                className="text-[13px] font-medium text-minor-contrast transition hover:text-minor-hover hover:underline"
              >
                Forgot Password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-minor text-[15px] font-semibold text-white shadow-[0_12px_26px_-10px_rgba(112,26,117,0.75)] transition hover:bg-minor-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-minor-ring active:translate-y-[1px] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right : CRM illustration                                         */}
        {/* ---------------------------------------------------------------- */}
        <div className="relative hidden items-center justify-center overflow-hidden bg-gradient-to-br from-[#FBF5FC] via-[#F7EDF9] to-[#F3E4F6] p-10 lg:flex">
          <svg
            viewBox="0 0 520 460"
            role="img"
            aria-label="Illustration of a CRM dashboard with leads, analytics and sales performance"
            className="h-auto w-full max-w-[460px]"
          >
            <defs>
              <linearGradient id="loginBarGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#A855C0" />
                <stop offset="100%" stopColor="#701A75" />
              </linearGradient>
              <linearGradient id="loginPillGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#701A75" />
                <stop offset="100%" stopColor="#9B2FA0" />
              </linearGradient>
              <filter id="loginCardShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow
                  dx="0"
                  dy="10"
                  stdDeviation="12"
                  floodColor="#701A75"
                  floodOpacity="0.14"
                />
              </filter>
            </defs>

            {/* Soft background shapes */}
            <circle cx="432" cy="86" r="62" fill="#EFD9F3" opacity="0.65" />
            <circle cx="74" cy="392" r="48" fill="#E6C9EC" opacity="0.6" />
            <circle cx="256" cy="228" r="180" fill="#F6E9F8" opacity="0.5" />

            {/* Main dashboard card */}
            <g filter="url(#loginCardShadow)">
              <rect
                x="56"
                y="70"
                width="352"
                height="250"
                rx="20"
                fill="#FFFFFF"
                stroke="#EEDCF1"
                strokeWidth="1.5"
              />
            </g>

            {/* Dashboard header */}
            <rect x="80" y="94" width="96" height="10" rx="5" fill="#701A75" />
            <rect x="80" y="112" width="62" height="8" rx="4" fill="#D9BBE0" />
            <rect x="322" y="94" width="62" height="22" rx="11" fill="#F7EDF9" />
            <rect x="334" y="102" width="38" height="6" rx="3" fill="#C79AD1" />

            {/* KPI tiles */}
            {[
              { x: 80, value: '#701A75' },
              { x: 184, value: '#9B2FA0' },
              { x: 288, value: '#C07FC9' },
            ].map((tile) => (
              <g key={tile.x}>
                <rect
                  x={tile.x}
                  y="136"
                  width="96"
                  height="54"
                  rx="10"
                  fill="#FAF3FC"
                  stroke="#F2E4F5"
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
                  fill="#D9BBE0"
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
              fill="#FFFFFF"
              stroke="#F2E4F5"
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
                fill={bar.accent ? 'url(#loginBarGrad)' : '#EBD8F0'}
              />
            ))}
            <rect x="100" y="288" width="264" height="2" rx="1" fill="#F2E4F5" />

            {/* Analytics card */}
            <g filter="url(#loginCardShadow)">
              <rect
                x="336"
                y="24"
                width="150"
                height="120"
                rx="16"
                fill="#FFFFFF"
                stroke="#EEDCF1"
                strokeWidth="1.5"
              />
            </g>
            <g transform="rotate(-90 374 84)">
              <circle cx="374" cy="84" r="26" fill="none" stroke="#F1E1F5" strokeWidth="11" />
              <circle
                cx="374"
                cy="84"
                r="26"
                fill="none"
                stroke="#701A75"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray="73 164"
              />
              <circle
                cx="374"
                cy="84"
                r="26"
                fill="none"
                stroke="#B563C8"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray="45 164"
                strokeDashoffset="-78"
              />
            </g>
            {[
              { y: 62, color: '#701A75', w: 44 },
              { y: 80, color: '#B563C8', w: 36 },
              { y: 98, color: '#E3C7EA', w: 40 },
            ].map((legend) => (
              <g key={legend.y}>
                <rect x="412" y={legend.y} width="8" height="8" rx="2" fill={legend.color} />
                <rect
                  x="426"
                  y={legend.y + 1}
                  width={legend.w}
                  height="6"
                  rx="3"
                  fill="#EADDEE"
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
                fill="#FFFFFF"
                stroke="#EEDCF1"
                strokeWidth="1.5"
              />
            </g>
            <rect x="44" y="304" width="66" height="9" rx="4.5" fill="#701A75" />
            <rect x="188" y="304" width="26" height="9" rx="4.5" fill="#E3C7EA" />
            {[
              { cy: 336, avatar: '#701A75', pill: '#F1DFF5' },
              { cy: 368, avatar: '#A855C0', pill: '#F6ECF9' },
              { cy: 398, avatar: '#D2A5DB', pill: '#F6ECF9' },
            ].map((lead) => (
              <g key={lead.cy}>
                <circle cx="60" cy={lead.cy} r="13" fill={lead.avatar} />
                <circle cx="60" cy={lead.cy - 4} r="4.2" fill="#FFFFFF" />
                <path
                  d={`M52.5 ${lead.cy + 9} a7.5 7.5 0 0 1 15 0 z`}
                  fill="#FFFFFF"
                />
                <rect x="82" y={lead.cy - 9} width="76" height="8" rx="4" fill="#EADDEE" />
                <rect x="82" y={lead.cy + 3} width="50" height="6" rx="3" fill="#F4EAF7" />
                <rect x="168" y={lead.cy - 8} width="42" height="16" rx="8" fill={lead.pill} />
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
