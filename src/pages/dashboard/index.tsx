import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';

const shortcuts = [
  {
    to: '/roles',
    label: 'Roles & Permissions',
    description: 'Define access levels for every team member.',
    icon: <ShieldCheck size={20} />,
    iconClass: 'border-primary/20 bg-primary-soft text-primary-contrast',
  },
  {
    to: '/users',
    label: 'Users & Staff',
    description: 'Manage staff accounts and role assignments.',
    icon: <Users size={20} />,
    iconClass: 'border-secondary/25 bg-secondary-soft text-secondary-contrast',
  },
];

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Your CRM overview. Module widgets will appear here as they are enabled."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut.to}
            type="button"
            onClick={() => navigate(shortcut.to)}
            className="flex cursor-pointer items-start gap-4 rounded-2xl border border-crmBorder bg-major p-5 text-left shadow-crm-card transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-crm-md"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${shortcut.iconClass}`}>
              {shortcut.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-outfit text-[15px] font-semibold text-crmText">
                {shortcut.label}
              </span>
              <span className="mt-0.5 block text-xs text-crmText-secondary">
                {shortcut.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-crmBorder bg-major p-12 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-crmBorder bg-major-muted text-crmText-tertiary">
          <LayoutDashboard size={24} />
        </span>
        <h3 className="font-outfit text-base font-semibold text-crmText">No widgets configured</h3>
        <p className="mt-1 max-w-sm text-sm text-crmText-secondary">
          Reporting widgets for leads, admissions and follow-ups will show up here once those
          modules go live.
        </p>
        <Button variant="secondary" className="mt-5" onClick={() => navigate('/users')}>
          Go to Users & Staff
        </Button>
      </div>
    </div>
  );
}

export default Dashboard;
