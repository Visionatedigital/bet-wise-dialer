import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import Settings from '@/pages/Settings';
import AdminSettings from '@/pages/AdminSettings';
import ManagementSettings from '@/pages/ManagementSettings';

export const RoleBasedSettings = () => {
  const { role, loading } = useUserRole();


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

  if (role === 'admin') {
    return <AdminSettings />;
  } else if (role === 'management') {
    return <ManagementSettings />;
  } else {
    return <Settings />;
  }
};
