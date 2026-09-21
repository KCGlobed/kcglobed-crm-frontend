import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { FaChevronDown, FaChevronUp, FaUser, FaSignOutAlt } from 'react-icons/fa';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { logout } from '../../store/slices/authSlice';

const DashboardHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const userTypeRaw = localStorage.getItem('userID') || '';
  const userType = userTypeRaw.split(',')[0];

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getPageTitle = (): string => {
    const segments = location.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    
    // 1. Specific check: If the last segment is an ID (detected by seeing 'view' before it)
    const secondLast = segments[segments.length - 2];
    if (secondLast === 'view') {
      const entity = segments[segments.length - 3] || 'Course';
      
      if (entity === 'university-subscription') {
        return 'University Request Details';
      }

      // Format 'students' to 'Student Details', 'course' to 'Course Details'
      let formattedEntity = entity.replace(/-/g, ' ');
      if (formattedEntity.endsWith('s')) formattedEntity = formattedEntity.slice(0, -1);
      formattedEntity = formattedEntity.charAt(0).toUpperCase() + formattedEntity.slice(1);
      return `${formattedEntity} Details`;
    }

    // 2. Default dashboard title
    if (!last || last === 'dashboard') return 'Dashboard';

    if (last === 'university-subscription') {
      return 'University Request';
    }

    // 3. Convert path segments like 'manage-courses' to 'Manage Courses'
    return last
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm h-16 flex items-center px-6 gap-4">

      {/* Page title */}
      <h2 className="text-lg font-semibold text-gray-800 flex-1 truncate">
        {getPageTitle()}
      </h2>

      {/* Search bar */}
      {/* <div className="relative hidden sm:flex items-center">
        <Search size={15} className="absolute left-3 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search…"
          className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-52 transition"
        />
      </div> */}

      {/* Notification bell */}
      <button
        className="relative p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {/* Red dot badge */}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      {/* User avatar + dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-100 transition"
          aria-haspopup="true"
          aria-expanded={dropdownOpen}
        >
          {/* Avatar circle */}
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
            text-white text-sm font-semibold shrink-0">
            {userType?.slice(0, 2)?.toUpperCase() ?? 'AD'}
          </div>

          {/* Name (hidden on mobile) */}
          <span className="hidden md:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
            {userType}
          </span>

          {dropdownOpen
            ? <FaChevronUp className="w-3 h-3 text-gray-500" />
            : <FaChevronDown className="w-3 h-3 text-gray-500" />}
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg
            border border-gray-100 py-1 z-50">
            <button
              onClick={() => { navigate('/dashboard/profile'); setDropdownOpen(false); }}
              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <FaUser className="w-4 h-4 mr-2 text-gray-400" />
              Profile
            </button>

            <div className="my-1 border-t border-gray-100" />

            <button
              onClick={() => { handleLogout(); setDropdownOpen(false); }}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <FaSignOutAlt className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default DashboardHeader;
