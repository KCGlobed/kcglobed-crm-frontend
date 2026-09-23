import React from 'react';

export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'brand' | 'primary' | 'secondary';

interface StatusBadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  /** Leading status dot. */
  dot?: boolean;
  /** Renders as a button - used for inline status toggles in tables. */
  onClick?: () => void;
  title?: string;
  uppercase?: boolean;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  success: 'bg-crmSuccess-bg text-crmSuccess border-crmSuccess-border',
  danger: 'bg-crmDanger-bg text-crmDanger border-crmDanger-border',
  warning: 'bg-crmWarning-bg text-crmWarning border-crmWarning-border',
  info: 'bg-crmInfo-bg text-crmInfo border-crmInfo-border',
  neutral: 'bg-major-muted text-crmText-secondary border-crmBorder',
  brand: 'bg-primary-soft text-primary-contrast border-primary/20',
  primary: 'bg-primary-soft text-primary-contrast border-primary/20',
  secondary: 'bg-secondary-soft text-secondary-contrast border-secondary/25',
};

/** One pill style for every status, count and tag in the CRM. */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  children,
  tone = 'neutral',
  dot = false,
  onClick,
  title,
  uppercase = false,
  className = '',
}) => {
  const classes = `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] font-semibold ${
    toneClasses[tone]
  } ${uppercase ? 'uppercase tracking-wide text-[10px] font-bold' : ''} ${
    onClick ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
  } ${className}`;

  const content = (
    <>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <span title={title} className={classes}>
      {content}
    </span>
  );
};

export default StatusBadge;
