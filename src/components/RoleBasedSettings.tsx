import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Settings from '@/pages/Settings';
import AdminSettings from '@/pages/AdminSettings';
import ManagementSettings from '@/pages/ManagementSettings';

export const RoleBasedSettings = () => {
  const { user } = useAuth();
  const [role, setRole] = useState<'admin' | 'management' | 'agent' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('agent');
        } else {
          setRole(data.role as 'admin' | 'management' | 'agent');
        }
      } catch (error) {
        console.error('Error:', error);
        setRole('agent');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

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
