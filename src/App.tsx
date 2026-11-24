import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { PortalLanding } from './components/PortalLanding.tsx';
import { StaffDashboard } from './components/StaffDashboard.tsx';
import { PatientDashboard } from './components/PatientDashboard.tsx';

const PortalRouter: React.FC = () => {
  const { loading, accountUser, patientSession } = useAuth();
  const [adminPreviewingPatient, setAdminPreviewingPatient] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Authenticated via verified Patient Report ID + OTP session
  if (patientSession) {
    return <PatientDashboard />;
  }

  // Authenticated via Firebase Google account
  if (accountUser) {
    const isLabStaff = accountUser.role === 'admin' || accountUser.role === 'staff';
    if (isLabStaff && !adminPreviewingPatient) {
      return (
        <StaffDashboard
          onSwitchToPatientPreview={() => setAdminPreviewingPatient(true)}
        />
      );
    }
    return (
      <PatientDashboard
        onReturnToStaffConsole={
          isLabStaff ? () => setAdminPreviewingPatient(false) : undefined
        }
      />
    );
  }

  return <PortalLanding />;
};

export default function App() {
  return (
    <AuthProvider>
      <PortalRouter />
    </AuthProvider>
  );
}
