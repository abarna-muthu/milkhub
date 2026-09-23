import React from 'react';
import { ShieldAlert, ArrowLeft, UserCheck } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  onNavigate: (path: string) => void;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, onNavigate }) => {
  const { isAdmin, switchRole } = useAuth();

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-slate-200 rounded-lg shadow-subtle text-center">
      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4 border border-amber-300">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Administrator Access Required</h2>
      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
        This section (Milk Rates, Staff Management, and Admin Settings) is restricted to dairy administrators. Collection Staff accounts can record milk collections, view suppliers, and manage payments.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('dashboard')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Return to Dashboard
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => switchRole('admin')}
          icon={<UserCheck className="w-4 h-4" />}
        >
          Switch to Admin Role (Demo)
        </Button>
      </div>
    </div>
  );
};
