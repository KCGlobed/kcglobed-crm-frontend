import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import Button from '../../components/common/Button';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-auto my-12 max-w-[600px] rounded-2xl border border-crmBorder bg-major p-8 text-center shadow-crm-card sm:p-12">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-minor to-minor-hover text-white shadow-crm-accent">
        <Lock size={26} />
      </div>
      <p className="font-outfit text-sm font-bold uppercase tracking-[0.2em] text-minor-contrast">
        Error 403
      </p>
      <h2 className="mt-2 font-outfit text-[1.6rem] font-bold text-crmText sm:text-[1.75rem]">
        Access Denied
      </h2>
      <p className="mb-7 mt-2 text-sm text-crmText-secondary">
        You do not have permission to view this module. Contact your administrator if you believe this is a mistake.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
