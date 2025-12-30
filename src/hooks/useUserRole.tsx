import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'management' | 'agent' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (!error && data && data.length > 0) {
          // User can have multiple roles - prioritize: management > admin > agent
          const roles = data.map(r => r.role as UserRole);
          
          // Priority: management > admin > agent
          // This ensures managers see management views even if they also have admin role
          let selectedRole: UserRole = null;
          if (roles.includes('management')) {
            selectedRole = 'management';
          } else if (roles.includes('admin')) {
            selectedRole = 'admin';
          } else if (roles.includes('agent')) {
            selectedRole = 'agent';
          } else if (roles.length > 0) {
            // Default to first role if none match expected values
            selectedRole = roles[0];
          }
          
          setRole(selectedRole);
          console.log('[useUserRole] User has roles:', roles, '→ Selected:', selectedRole);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return { 
    role, 
    loading,
    isAdmin: role === 'admin',
    isManagement: role === 'management',
    isAgent: role === 'agent'
  };
}
