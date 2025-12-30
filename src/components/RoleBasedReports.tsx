import { useUserRole } from '@/hooks/useUserRole';
import { useLocation } from 'react-router-dom';
import Reports from '@/pages/Reports';
import AdminReports from '@/pages/AdminReports';
import ManagementReports from '@/pages/ManagementReports';

export const RoleBasedReports = () => {
  const { role, loading, isAdmin, isManagement } = useUserRole();
  const location = useLocation();
  
  // Check if user is in management view mode (for admins viewing as managers)
  const adminViewMode = typeof window !== 'undefined' ? localStorage.getItem('adminViewMode') : null;
  
  // Check if coming from management routes (heuristic: check previous route or current context)
  const isManagementContext = adminViewMode === 'management' || 
                               location.pathname.includes('management') ||
                               document.referrer.includes('management');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Priority: management role OR admin in management view mode > admin > agent
  // This ensures managers see their reports, and admins viewing as managers also see management reports
  if (isManagement || (isAdmin && isManagementContext)) {
    console.log('[RoleBasedReports] Rendering ManagementReports', {
      isManagement,
      isAdmin,
      adminViewMode,
      isManagementContext
    });
    return <ManagementReports />;
  } else if (isAdmin) {
    console.log('[RoleBasedReports] Rendering AdminReports for admin user');
    return <AdminReports />;
  } else {
    console.log('[RoleBasedReports] Rendering Reports for agent user');
    return <Reports />;
  }
};
