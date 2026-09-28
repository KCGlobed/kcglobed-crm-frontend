import React, { useEffect } from 'react';
import { BadgeCheck, MapPin, UserRound } from 'lucide-react';
import moment from 'moment';
import PageHeader from '../../components/common/PageHeader';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useRedux';
import { fetchProfile } from '../../store/slices/profileSlice';
import type { User } from '../../utils/types';

const ManageProfile: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { profile } = useAppSelector((state) => state.profile);

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
  const isActive = current.is_active !== false;
  const joinedAt = current.date_joined || current.created_at;

  const formatDate = (dateStr?: string | null, withTime = true) => {
    if (!dateStr) return '-';
    try {
      return moment(dateStr).format(withTime ? 'MMM DD, YYYY hh:mm A' : 'MMM DD, YYYY');
    } catch {
      return dateStr;
    }
  };

  const sections: {
    title: string;
    hint: string;
    icon: React.ReactNode;
    fields: { label: string; value: string; mono?: boolean }[];
  }[] = [
    {
      title: 'Personal Information',
      hint: 'Your name and contact details.',
      icon: <UserRound size={16} />,
      fields: [
        { label: 'First Name', value: current.first_name || '-' },
        { label: 'Last Name', value: current.last_name || '-' },
        { label: 'Email Address', value: current.email || '-' },
        { label: 'Date of Birth', value: current.dob ? formatDate(current.dob, false) : '-' },
        { label: 'Phone 1', value: current.phone1 || current.phone || '-' },
        { label: 'Phone 2', value: current.phone2 || '-' },
      ],
    },
    {
      title: 'Address',
      hint: 'Where you are located.',
      icon: <MapPin size={16} />,
      fields: [
        { label: 'Address', value: current.address || '-' },
        { label: 'City', value: current.city || '-' },
        { label: 'State', value: current.state || '-' },
        { label: 'Country', value: current.country || '-' },
        { label: 'Pincode', value: current.pincode || '-', mono: true },
      ],
    },
  ];

  const accountRows: { label: string; value: string; sub?: string | null }[] = [
    { label: 'Role', value: roleName || '-', sub: roleSlug },
    { label: 'Reports To', value: reportsToName || '-', sub: reportsToEmail },
    { label: 'Date Joined', value: formatDate(joinedAt) },
    { label: 'Last Login', value: formatDate(current.last_login) },
    { label: 'Last Updated', value: formatDate(current.updated_at) },
  ];

  const labelClass = 'text-[10px] font-bold uppercase tracking-wider text-crmText-tertiary';

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader title="My Profile" description="Your account details, role and reporting line." />

      {/* Identity */}
      <div className="overflow-hidden rounded-2xl border border-crmBorder bg-major shadow-crm-card">
        <div className="h-20 bg-gradient-to-r from-minor via-minor-hover to-minor-active" />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:gap-5">
          <span className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-major bg-gradient-to-br from-minor to-minor-hover text-2xl font-bold text-white shadow-crm-md">
            {initials}
          </span>
          <div className="min-w-0 flex-1 sm:pb-1">
            <h2 className="truncate font-outfit text-xl font-bold text-crmText">{fullName}</h2>
            <p className="truncate text-sm text-crmText-secondary">{current.email || '-'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:pb-1">
            <span className="inline-flex items-center rounded-full border border-minor/20 bg-minor-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-minor-contrast">
              {roleName || '-'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                isActive
                  ? 'border-crmSuccess-border bg-crmSuccess-bg text-crmSuccess'
                  : 'border-crmDanger-border bg-crmDanger-bg text-crmDanger'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-crmSuccess' : 'bg-crmDanger'}`} />
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Details */}
        <div className="flex min-w-0 flex-col gap-6">
          {sections.map((section) => (
            <div key={section.title} className="rounded-2xl border border-crmBorder bg-major shadow-crm-card">
              <div className="flex items-center gap-3 border-b border-crmBorder px-5 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-minor-soft text-minor-contrast">
                  {section.icon}
                </span>
                <div>
                  <h3 className="font-outfit text-[15px] font-semibold text-crmText">{section.title}</h3>
                  <p className="text-[11px] text-crmText-secondary">{section.hint}</p>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-x-8 px-5 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <div key={field.label} className="border-b border-crmBorder py-3.5">
                    <dt className={labelClass}>{field.label}</dt>
                    <dd
                      className={`mt-1 truncate font-semibold text-crmText ${field.mono ? 'font-mono text-xs' : 'text-sm'}`}
                      title={field.value}
                    >
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* Account */}
        <div className="h-fit rounded-2xl border border-crmBorder bg-major shadow-crm-card">
          <div className="flex items-center gap-3 border-b border-crmBorder px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-soft text-secondary-contrast">
              <BadgeCheck size={16} />
            </span>
            <div>
              <h3 className="font-outfit text-[15px] font-semibold text-crmText">Account</h3>
              <p className="text-[11px] text-crmText-secondary">Role, reporting line and activity.</p>
            </div>
          </div>
          <dl className="px-5">
            {accountRows.map((row) => (
              <div key={row.label} className="border-b border-crmBorder py-3.5 last:border-b-0">
                <dt className={labelClass}>{row.label}</dt>
                <dd className="mt-1 truncate text-sm font-semibold text-crmText" title={row.value}>
                  {row.value}
                </dd>
                {row.sub && <dd className="truncate font-mono text-[11px] text-crmText-tertiary">{row.sub}</dd>}
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
};

export const ProfilePage = ManageProfile;
export default ManageProfile;
