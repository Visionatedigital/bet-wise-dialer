import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';


import Dashboard from '@/pages/Dashboard';
import AdminDashboard from '@/pages/AdminDashboard';
import ManagementDashboard from '@/pages/ManagementDashboard';
import { DashboardSelectionDialog } from './DashboardSelectionDialog';

export const RoleBasedDashboard = () => {
  const { user } = useAuth();
  const { role, loading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDashboardSelection, setShowDashboardSelection] = useState(false);

  useEffect(() => {
    if (!loading && role === 'admin') {
      const savedViewMode = localStorage.getItem('adminViewMode');
      const hasSeenDialog = sessionStorage.getItem('dashboardDialogShown');
      
      // Show dialog if no saved preference OR if they haven't seen it this session
      if (!savedViewMode || !hasSeenDialog) {
        setShowDashboardSelection(true);
        sessionStorage.setItem('dashboardDialogShown', 'true');
      }
    }
  }, [role, loading]);


  const handleDashboardSelection = (dashboard: 'agent' | 'management' | 'admin') => {
    localStorage.setItem('adminViewMode', dashboard);
    setShowDashboardSelection(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Check if admin is viewing as different role
  const adminViewMode = localStorage.getItem('adminViewMode');
  
  // Show dashboard selection dialog for admins
  if (role === 'admin' && showDashboardSelection) {
    return (
      <DashboardSelectionDialog
        open={showDashboardSelection}
        onSelect={handleDashboardSelection}
      />
    );
  }
  
  // Render the appropriate dashboard based on role
  if (role === 'admin') {
    // Allow admin to view any dashboard based on view mode
    if (adminViewMode === 'agent') {
      return <Dashboard />;
    } else if (adminViewMode === 'management') {
      return <ManagementDashboard />;
    }
    return <AdminDashboard />;
  } else if (role === 'management') {
    return <ManagementDashboard />;
  } else {
    return <Dashboard />;
  }
};
