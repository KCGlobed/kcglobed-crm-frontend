import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { logout } from '../../store/slices/authSlice';
import useClickOutside from '../../hooks/useClickOutside';

/** Header account dropdown: identity summary + Profile / Settings / Logout. */
export const ProfileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const close = useCallback(() => setIsOpen(false), []);
  const wrapperRef = useClickOutside<HTMLDivElement>(isOpen, close);

  const displayName = user?.full_name || user?.name || user?.email || 'Super Admin';
  const displayRole = user?.role_name || (user?.is_superadmin ? 'Super Admin' : 'Administrator');
  const displayEmail = user?.email || 'admin@kcglobed.com';
  const initials =
    displayName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'SA';

  const handleLogout = () => {
    close();
    dispatch(logout());
    navigate('/login');
    toast.success('You have been logged out');
  };

  const menuItemClass =
    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-crmText-secondary transition-colors hover:bg-major-tint hover:text-crmText';

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`Signed in as ${displayName}`}
        className={`flex items-center gap-2.5 rounded-xl border p-1 pr-2 transition-all sm:pr-3 ${
          isOpen
            ? 'border-minor/30 bg-minor-soft'
            : 'border-crmBorder bg-major-tint hover:border-minor/30 hover:bg-minor-soft'
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-minor to-minor-hover text-xs font-bold text-white">
          {initials}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-[9rem] truncate text-[13px] font-semibold leading-tight text-crmText">
            {displayName}
          </span>
          <span className="block max-w-[9rem] truncate text-[11px] leading-tight text-crmText-tertiary">
            {displayRole}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`hidden shrink-0 text-crmText-tertiary transition-transform duration-200 sm:block ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="animate-menu-in absolute right-0 z-50 mt-2 w-[min(17rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-crmBorder bg-major shadow-crm-lg"
        >
          {/* Identity */}
          <div className="flex items-center gap-3 border-b border-crmBorder bg-major-tint px-4 py-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-minor to-minor-hover text-sm font-bold text-white shadow-crm-sm">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-crmText">{displayName}</span>
              <span className="block truncate text-xs text-crmText-secondary">{displayEmail}</span>
              <span className="mt-1 inline-flex items-center rounded-full border border-minor/20 bg-minor-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-minor-contrast">
                {displayRole}
              </span>
            </span>
          </div>

          {/* Actions */}
          <div className="p-1.5">
            <button type="button" className={menuItemClass} onClick={close}>
              <User size={16} className="text-crmText-tertiary" />
              Profile
            </button>
            <button type="button" className={menuItemClass} onClick={close}>
              <Settings size={16} className="text-crmText-tertiary" />
              Settings
            </button>
          </div>

          <div className="border-t border-crmBorder p-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-crmDanger transition-colors hover:bg-crmDanger-bg"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
