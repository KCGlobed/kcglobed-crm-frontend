import React from 'react';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'subtle'
  | 'success'
  | 'dangerSoft';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-minor text-white border border-transparent shadow-crm-accent hover:bg-minor-hover active:bg-minor-active',
  secondary:
    'bg-major text-crmText border border-crmBorder hover:border-minor/30 hover:bg-minor-soft hover:text-minor-contrast',
  ghost:
    'bg-transparent text-crmText-secondary border border-transparent hover:bg-major-muted hover:text-crmText',
  danger:
    'bg-crmDanger text-white border border-transparent hover:opacity-90 active:opacity-100',
  subtle:
    'bg-minor-soft text-minor-contrast border border-minor/20 hover:bg-minor-subtle',
  success:
    'bg-major text-crmSuccess border border-crmSuccess-border hover:bg-crmSuccess-bg',
  dangerSoft:
    'bg-major text-crmText-secondary border border-crmBorder hover:text-crmDanger hover:border-crmDanger-border hover:bg-crmDanger-bg',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-[13px] gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
};

/** Shared action button for toolbars, forms and modals. */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={`inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-55 ${
      variantClasses[variant]
    } ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    {...rest}
  >
    {loading ? (
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    ) : (
      icon && iconPosition === 'left' && <span className="flex shrink-0 items-center">{icon}</span>
    )}
    {children}
    {!loading && icon && iconPosition === 'right' && (
      <span className="flex shrink-0 items-center">{icon}</span>
    )}
  </button>
);

export default Button;
