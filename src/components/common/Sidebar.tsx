import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ChevronLeft,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PieChart,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { logout } from '../../store/slices/authSlice';

interface SidebarProps {
  activePage?: string;
  onSelectPage?: (page: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Drawer state below the `lg` breakpoint. */
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  const { data: roles } = useAppSelector((state) => state.roles);
  const { data: users } = useAppSelector((state) => state.users);

  // Derive current page either from prop or URL pathname
  const currentPath = location?.pathname ? location.pathname.replace(/^\//, '') : '';
  const currentPage = activePage || currentPath || 'dashboard';

  const displayName: string = user?.full_name || user?.email || user?.name || 'Super Admin';
  const displayRole: string = user?.role_name || (user?.is_superadmin ? 'Super Admin' : 'Staff');
  const userInitials =
    displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'SA';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
    {
      id: 'roles',
      label: 'Roles & Permissions',
      badge: roles && roles.length > 0 ? `${roles.length}` : undefined,
      icon: <ShieldCheck size={19} />,
    },
    {
      id: 'users',
      label: 'Users & Staff',
      badge: users && users.length > 0 ? `${users.length}` : undefined,
      icon: <Users size={19} />,
    },
    { id: 'leads', label: 'Leads & Pipeline', icon: <BarChart3 size={19} /> },
    { id: 'admissions', label: 'Admissions', icon: <GraduationCap size={19} /> },
    { id: 'followups', label: 'Follow-ups & Notes', icon: <MessageSquare size={19} /> },
    { id: 'reports', label: 'Reports & Export', icon: <PieChart size={19} /> },
  ];

  const handleNavClick = (id: string) => {
    if (onSelectPage) {
      onSelectPage(id);
    }
    navigate(`/${id}`);
    onCloseMobile?.();
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <>
      {/* Drawer backdrop (mobile / tablet) */}
      {isMobileOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col justify-between border-r border-crmBorder bg-major transition-[transform,width] duration-300 lg:static lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-[82px]' : 'lg:w-[270px]'} w-[270px]`}
      >
        {/* Brand Header */}
        <div
          className={`flex min-h-[64px] items-center justify-between gap-3 border-b border-crmBorder ${
            isCollapsed ? 'lg:flex-col lg:justify-center lg:p-4' : ''
          } px-5 py-3.5`}
        >
          <div
            className="flex cursor-pointer select-none items-center gap-3 overflow-hidden whitespace-nowrap border-none bg-transparent p-0 text-inherit no-underline outline-none transition-opacity hover:opacity-90"
            onClick={() => handleNavClick('dashboard')}
            role="button"
            tabIndex={0}
            title="KC Globed CRM - Go to Dashboard"
          >
            <div className="flex h-[34px] w-[34px] min-w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-minor to-minor-hover text-sm font-extrabold text-white shadow-crm-accent">
              KC
            </div>
            <div className={`flex items-baseline gap-1.5 font-outfit leading-none ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="text-[1.1rem] font-bold tracking-tight text-crmText">KC Globed</span>
              <span className="text-[1.1rem] font-extrabold tracking-tight text-minor-contrast">CRM</span>
            </div>
          </div>

          {/* Collapse (desktop) */}
          <button
            type="button"
            className="hidden h-[30px] w-[30px] min-w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-crmBorder bg-major-tint text-crmText-secondary transition-all hover:border-minor/30 hover:bg-minor-soft hover:text-minor-contrast lg:flex"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              size={16}
              strokeWidth={2.5}
              className={`transition-transform duration-200 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
            />
          </button>

          {/* Close (mobile) */}
          <button
            type="button"
            className="flex h-[30px] w-[30px] min-w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-crmBorder bg-major-tint text-crmText-secondary transition-all hover:border-crmDanger/30 hover:bg-crmDanger-bg hover:text-crmDanger lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <div
            className={`whitespace-nowrap px-3 py-2 text-[0.7rem] font-bold uppercase tracking-wider text-crmText-tertiary ${
              isCollapsed ? 'lg:hidden' : ''
            }`}
          >
            Core Modules
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = currentPage === item.id || currentPath === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex w-full cursor-pointer items-center gap-3.5 whitespace-nowrap rounded-xl border-none px-3.5 py-2.5 text-left font-sans text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-minor text-white shadow-crm-accent'
                      : 'bg-transparent text-crmText-secondary hover:bg-minor-soft hover:text-minor-contrast'
                  } ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center transition-colors">
                    {item.icon}
                  </span>
                  <span className={isCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[0.72rem] font-bold ${
                        isActive ? 'bg-white/25 text-white' : 'bg-minor-soft text-minor-contrast'
                      } ${isCollapsed ? 'lg:hidden' : ''}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Authenticated User Footer */}
        <div className="border-t border-crmBorder bg-major p-3.5">
          <div
            className={`flex items-center gap-3 rounded-xl border border-crmBorder bg-major-tint p-2 ${
              isCollapsed ? 'lg:justify-center' : ''
            }`}
            title={`Logged in as ${displayName}`}
          >
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-minor to-minor-hover text-sm font-bold text-white shadow-crm-sm">
              {userInitials}
            </div>
            <div className={`min-w-0 flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <div className="truncate text-xs font-bold text-crmText">{displayName}</div>
              <div className="truncate text-[10px] font-semibold text-minor-contrast">{displayRole}</div>
            </div>
            <button
              type="button"
              className={`flex cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-1.5 text-crmText-tertiary transition-colors hover:bg-crmDanger-bg hover:text-crmDanger ${
                isCollapsed ? 'lg:hidden' : ''
              }`}
              onClick={handleLogout}
              title="Logout of CRM session"
              aria-label="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
