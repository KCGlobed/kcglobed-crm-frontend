import React from 'react';
import { Moon, Sun } from 'lucide-react';
import useTheme from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

/** Light/dark switch for the header. */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-crmBorder bg-major-tint text-crmText-secondary transition-all hover:border-minor/30 hover:bg-minor-soft hover:text-minor-contrast ${className}`}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
};

export default ThemeToggle;
