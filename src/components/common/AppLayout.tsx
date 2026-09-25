import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import type { Breadcrumb } from './Header';

interface AppLayoutProps {
  activePage?: string;
  onSelectPage?: (page: string) => void;
  children?: React.ReactNode;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  roles: 'Roles & Permissions',
  'roles-old': 'Roles & Permissions',
  users: 'Users & Staff',
  profile: 'Profile Settings',
  leads: 'Leads & Pipeline',
  admissions: 'Admissions',
  followups: 'Follow-ups & Notes',
  reports: 'Reports & Export',
  'reporting-management': "Reporting Management",
};

export const AppLayout: React.FC<AppLayoutProps> = ({
  activePage,
  onSelectPage,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  const currentPath = location?.pathname ? location.pathname.replace(/^\//, '') : '';
  const currentPage = activePage || currentPath || 'dashboard';
  const pageTitle = PAGE_TITLES[currentPage] || 'CRM Executive Dashboard';

  const breadcrumbs: Breadcrumb[] =
    currentPage === 'dashboard'
      ? [{ label: 'Dashboard' }]
      : [{ label: 'Dashboard', to: '/dashboard' }, { label: pageTitle }];

  // The drawer should never stay open across a navigation.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-major-tint">
      {/* Left Sidebar */}
      <Sidebar
        activePage={currentPage}
        onSelectPage={onSelectPage}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Viewport */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <Header breadcrumbs={breadcrumbs} onOpenSidebar={() => setIsMobileOpen(true)} />

        {/* Dynamic Content Viewport */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
