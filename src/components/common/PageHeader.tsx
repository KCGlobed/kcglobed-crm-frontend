import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, filters, ...). */
  actions?: React.ReactNode;
  className?: string;
}

/** Standard page title block used at the top of every module screen. */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  className = '',
}) => (
  <div
    className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
  >
    <div className="min-w-0">
      <h1 className="font-outfit text-xl font-bold tracking-tight text-crmText sm:text-[1.6rem]">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-[13px] text-crmText-secondary sm:text-sm">{description}</p>
      )}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
