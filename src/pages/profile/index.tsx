import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Cake,
  Calendar,
  Check,
  Clock,
  Eye,
  EyeOff,
  Globe,
  Hash,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  Map,
  MapPin,
  Phone,
  Settings as SettingsIcon,
  ShieldCheck,
  User as UserIcon,
  UserRound,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import moment from 'moment';
import PageHeader from '../../components/common/PageHeader';
import LogoutAllModal from '../../components/components/Modal/LogoutAllModal';
import { useModal } from '../../context/ModalContext';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchProfile, changePassword } from '../../store/slices/profileSlice';
import type { User } from '../../utils/types';

type ProfileTab = 'profile' | 'settings';

type PasswordFormValues = {
  old_password: string;
  new_password: string;
  confirm_password: string;
};

const ManageProfile: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { showModal } = useModal();
  const { user } = useAppSelector((state) => state.auth);
  const { profile } = useAppSelector((state) => state.profile);

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch the logged-in user's record (GET /access/users/{uid}/)
  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchProfile(user.uid));
    }
  }, [dispatch, user?.uid]);

  // Show login data immediately, then refine with the API response
  const current: User = { ...(user || {}), ...(profile || {}) } as User;

  const fullName =
    current.full_name ||
    [current.first_name, current.last_name].filter(Boolean).join(' ') ||
    current.email ||
    '-';
  const roleName =
    typeof current.role === 'object' && current.role ? current.role.name : current.role_name || '-';
  const roleSlug = typeof current.role === 'object' && current.role ? current.role.slug : null;
  const reportsToName =
    typeof current.reports_to === 'object' && current.reports_to
      ? current.reports_to.name || current.reports_to.email
      : current.reports_to_name || null;
  const reportsToEmail =
    typeof current.reports_to === 'object' && current.reports_to ? current.reports_to.email : null;
  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .map((part: string) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'SA';

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format('MMM DD, YYYY hh:mm A');
    } catch {
      return dateStr;
    }
  };

  // ---------------- Change password form ---------------- //
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<PasswordFormValues>({
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  });

  const oldPasswordValue = watch('old_password');
  const newPasswordValue = watch('new_password');
  const confirmPasswordValue = watch('confirm_password');

  const passwordChecks = [
    { label: 'At least 8 characters', passed: (newPasswordValue || '').length >= 8 },
    {
      label: 'Different from current password',
      passed: !!newPasswordValue && newPasswordValue !== oldPasswordValue,
    },
    {
      label: 'New and confirm passwords match',
      passed: !!newPasswordValue && newPasswordValue === confirmPasswordValue,
    },
  ];

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

  const navItems: { key: ProfileTab; label: string; hint: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', hint: 'Your account details', icon: <UserIcon size={17} /> },
    { key: 'settings', label: 'Settings', hint: 'Password & security', icon: <SettingsIcon size={17} /> },
  ];

  const sections: {
    title: string;
    hint: string;
    icon: React.ReactNode;
    iconClass: string;
    fields: { label: string; value: string; sub?: string | null; mono?: boolean; icon: React.ReactNode }[];
  }[] = [
    {
      title: 'Basic Information',
      hint: 'Your personal and contact details.',
      icon: <UserRound size={17} />,
      iconClass: 'border-primary/20 bg-primary-soft text-primary-contrast',
      fields: [
        { label: 'First Name', value: current.first_name || '-', icon: <UserRound size={16} /> },
        { label: 'Last Name', value: current.last_name || '-', icon: <UserRound size={16} /> },
        { label: 'Email Address', value: current.email || '-', icon: <Mail size={16} /> },
        {
          label: 'Date of Birth',
          value: current.dob ? moment(current.dob).format('MMM DD, YYYY') : '-',
          icon: <Cake size={16} />,
        },
        { label: 'Phone 1', value: current.phone1 || current.phone || '-', icon: <Phone size={16} /> },
        { label: 'Phone 2', value: current.phone2 || '-', icon: <Phone size={16} /> },
      ],
    },
    {
      title: 'Address',
      hint: 'Where you are located.',
      icon: <MapPin size={17} />,
      iconClass: 'border-secondary/25 bg-secondary-soft text-secondary-contrast',
      fields: [
        { label: 'Address', value: current.address || '-', icon: <MapPin size={16} /> },
        { label: 'City', value: current.city || '-', icon: <Landmark size={16} /> },
        { label: 'State', value: current.state || '-', icon: <Map size={16} /> },
        { label: 'Country', value: current.country || '-', icon: <Globe size={16} /> },
        { label: 'Pincode', value: current.pincode || '-', mono: true, icon: <Hash size={16} /> },
      ],
    },
    {
      title: 'Account Details',
      hint: 'Role, reporting line and account activity.',
      icon: <BadgeCheck size={17} />,
      iconClass: 'border-minor/20 bg-minor-soft text-minor-contrast',
      fields: [
        { label: 'Role', value: roleName || '-', sub: roleSlug, icon: <ShieldCheck size={16} /> },
        { label: 'Reports To', value: reportsToName || '-', sub: reportsToEmail, icon: <Users size={16} /> },
        { label: 'Status', value: current.is_active ? 'Active' : 'Inactive', icon: <BadgeCheck size={16} /> },
        { label: 'Date Joined', value: formatDate(current.created_at), icon: <Calendar size={16} /> },
        { label: 'Last Updated', value: formatDate(current.updated_at), icon: <Clock size={16} /> },
      ],
    },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader
        title="Profile Settings"
        description="View your account details and manage your security settings."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Side Navigation */}
        <aside className="h-fit overflow-hidden rounded-2xl border border-crmBorder bg-major shadow-crm-card">
          <div className="flex flex-col items-center gap-3 border-b border-crmBorder bg-minor-soft px-4 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-minor to-minor-hover text-xl font-bold text-white shadow-crm-sm">
              {initials}
            </span>
            <div className="min-w-0 w-full">
              <div className="truncate font-outfit text-[15px] font-semibold text-crmText">{fullName}</div>
              <div className="truncate text-[11px] text-crmText-secondary">{current.email || '-'}</div>
            </div>
            <span className="inline-flex items-center rounded-full border border-minor/20 bg-major px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-minor-contrast">
              {roleName || '-'}
            </span>
          </div>

          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? 'bg-minor text-white shadow-crm-accent'
                      : 'bg-transparent text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? 'bg-white/20 text-white' : 'border border-crmBorder bg-major-tint'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className={`block truncate text-[11px] ${isActive ? 'text-white/80' : 'text-crmText-tertiary'}`}>
                      {item.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        {activeTab === 'profile' ? (
          <section className="flex min-w-0 flex-col gap-6">
            {/* Detail Sections */}
            {sections.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl border border-crmBorder bg-major p-5 shadow-crm-card"
              >
                <div className="mb-4 flex items-center gap-3 border-b border-crmBorder pb-4">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${section.iconClass}`}
                  >
                    {section.icon}
                  </span>
                  <div>
                    <h2 className="font-outfit text-[15px] font-semibold text-crmText">{section.title}</h2>
                    <p className="text-[11px] text-crmText-secondary">{section.hint}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {section.fields.map((field) => (
                    <div
                      key={field.label}
                      className="flex items-center gap-3 rounded-xl border border-crmBorder bg-major-tint px-4 py-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-crmBorder bg-major text-crmText-tertiary">
                        {field.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-crmText-tertiary">
                          {field.label}
                        </div>
                        <div
                          className={`truncate font-semibold text-crmText ${field.mono ? 'font-mono text-xs' : 'text-sm'}`}
                          title={field.value}
                        >
                          {field.value}
                        </div>
                        {field.sub && (
                          <div className="truncate font-mono text-[11px] text-crmText-tertiary">{field.sub}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section className="flex min-w-0 flex-col gap-6">
          <div className="rounded-2xl border border-crmBorder bg-major p-5 shadow-crm-card">
            <div className="mb-5 flex items-center gap-3 border-b border-crmBorder pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary-soft text-primary-contrast">
                <KeyRound size={17} />
              </span>
              <div>
                <h2 className="font-outfit text-[15px] font-semibold text-crmText">Change Password</h2>
                <p className="text-[11px] text-crmText-secondary">
                  Update the password you use to sign in to KC Globed CRM.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-xs font-semibold text-crmText">
                      Current Password <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs font-semibold text-secondary-contrast transition hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      {...register('old_password', { required: 'Current password is required' })}
                      placeholder="Enter current password"
                      className={`w-full px-3.5 py-2.5 pr-11 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
                        errors.old_password
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-crmText-tertiary hover:text-crmText"
                      aria-label={showOldPassword ? 'Hide password' : 'Show password'}
                    >
                      {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.old_password && (
                    <p className="mt-1 text-xs text-red-500">{errors.old_password.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-crmText">
                      New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        {...register('new_password', {
                          required: 'New password is required',
                          minLength: { value: 8, message: 'Password must be at least 8 characters' },
                          validate: (val) =>
                            val !== oldPasswordValue || 'New password must be different from current password',
                        })}
                        placeholder="Enter new password"
                        className={`w-full px-3.5 py-2.5 pr-11 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
                          errors.new_password
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-crmText-tertiary hover:text-crmText"
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.new_password && (
                      <p className="mt-1 text-xs text-red-500">{errors.new_password.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-crmText">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        {...register('confirm_password', {
                          required: 'Please confirm your new password',
                          validate: (val) => val === newPasswordValue || 'Passwords do not match',
                        })}
                        placeholder="Re-enter new password"
                        className={`w-full px-3.5 py-2.5 pr-11 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
                          errors.confirm_password
                            ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                            : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-crmText-tertiary hover:text-crmText"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirm_password && (
                      <p className="mt-1 text-xs text-red-500">{errors.confirm_password.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-crmBorder pt-4">
                  <button
                    type="button"
                    onClick={() => reset()}
                    disabled={savingPassword}
                    className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
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

              {/* Password Requirements */}
              <div className="h-fit rounded-xl border border-crmBorder bg-major-tint p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-crmText-tertiary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-crmText-tertiary">
                    Password Requirements
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {passwordChecks.map((check) => (
                    <li key={check.label} className="flex items-center gap-2.5 text-xs">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          check.passed
                            ? 'border-crmSuccess-border bg-crmSuccess-bg text-crmSuccess'
                            : 'border-crmBorder bg-major text-crmText-tertiary'
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
                <p className="mt-4 border-t border-crmBorder pt-3 text-[11px] leading-relaxed text-crmText-tertiary">
                  After changing your password, use the new password the next time you sign in.
                </p>
              </div>
            </div>
          </div>

          {/* Sessions & Devices */}
          <div className="rounded-2xl border border-crmBorder bg-major p-5 shadow-crm-card">
            <div className="mb-5 flex items-center gap-3 border-b border-crmBorder pb-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-crmDanger-border bg-crmDanger-bg text-crmDanger">
                <LogOut size={17} />
              </span>
              <div>
                <h2 className="font-outfit text-[15px] font-semibold text-crmText">Sessions &amp; Devices</h2>
                <p className="text-[11px] text-crmText-secondary">
                  Control where your account is signed in.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-crmBorder bg-major-tint p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-crmText">Logout from all devices</div>
                <p className="mt-0.5 text-xs leading-relaxed text-crmText-secondary">
                  Ends every active session for your account, including this one. Use this if you
                  think someone else has access to your account or you have signed in on a shared device.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  showModal({
                    content: <LogoutAllModal />,
                    type: 'custom',
                    size: 'md',
                  })
                }
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-crmDanger-border bg-major px-4 py-2.5 text-xs font-semibold text-crmDanger transition-all hover:bg-crmDanger-bg cursor-pointer"
              >
                <LogOut size={15} />
                Logout Everywhere
              </button>
            </div>
          </div>
          </section>
        )}
      </div>
    </div>
  );
};

export const ProfilePage = ManageProfile;
export default ManageProfile;
