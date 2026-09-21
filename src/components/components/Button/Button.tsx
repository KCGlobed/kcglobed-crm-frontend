// components/GlassButton.tsx - compact icon action used inside table rows
import React from 'react';

export interface GlassButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  color: 'green' | 'red' | 'blue' | 'gray';
  title?: string;
}

/** Colour keys are kept for backwards compatibility with existing call sites. */
const colorVariants: Record<GlassButtonProps['color'], string> = {
  green: 'text-crmSuccess border-crmSuccess-border hover:bg-crmSuccess-bg',
  red: 'text-crmDanger border-crmDanger-border hover:bg-crmDanger-bg',
  blue: 'text-minor-contrast border-minor/25 hover:bg-minor-soft',
  gray: 'text-crmText-secondary border-crmBorder hover:bg-major-muted hover:text-crmText',
};

const GlassButton: React.FC<GlassButtonProps> = ({ onClick, icon, color, title }) => {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      type="button"
      className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border bg-major leading-none transition-all duration-150 active:scale-95 ${colorVariants[color]}`}
    >
      {icon}
    </button>
  );
};

export default GlassButton;
