import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import NotificationMenu from './NotificationMenu';
import ProfileMenu from './ProfileMenu';

export interface Breadcrumb {
  label: string;
  to?: string;
}

interface HeaderProps {
  /** Trail shown on the left. Falls back to `title` when omitted. */
  breadcrumbs?: Breadcrumb[];
  title?: string;
  /** Opens the sidebar drawer on tablet/mobile. */
  onOpenSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  title = 'CRM Executive Dashboard',
  onOpenSidebar,
}) => {
  const trail: Breadcrumb[] = breadcrumbs?.length ? breadcrumbs : [{ label: title }];
  const current = trail[trail.length - 1];

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-crmBorder bg-major px-4 sm:px-6 lg:px-8">
      {/* Left: drawer trigger + breadcrumbs */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-crmBorder bg-major-tint text-crmText-secondary transition-all hover:border-minor/30 hover:bg-minor-soft hover:text-minor-contrast lg:hidden"
        >
          <Menu size={18} />
        </button>

        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5">
            {trail.map((crumb, index) => {
              const isLast = index === trail.length - 1;
              return (
                <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && (
                    <ChevronRight size={14} className="hidden shrink-0 text-crmText-tertiary sm:block" />
                  )}
                  {isLast ? (
                    <span className="truncate font-outfit text-[15px] font-semibold text-crmText">
                      {crumb.label}
                    </span>
                  ) : crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="hidden shrink-0 text-[13px] font-medium text-crmText-tertiary transition-colors hover:text-minor-contrast sm:block"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="hidden shrink-0 text-[13px] font-medium text-crmText-tertiary sm:block">
                      {crumb.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="sr-only">Current page: {current.label}</p>
        </nav>
      </div>

      {/* Right: theme, notifications, account */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        <ThemeToggle />
        <NotificationMenu />
        <span className="hidden h-6 w-px bg-crmBorder sm:block" />
        <ProfileMenu />
      </div>
    </header>
  );
};

export default Header;
