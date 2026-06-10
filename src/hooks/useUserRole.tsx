import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'management' | 'agent' | 'crm' | null;

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    setRole(user.role as UserRole);
    setLoading(false);
  }, [user, authLoading]);

  // Handle local development overrides for testing views
  const effectiveRole = typeof window !== 'undefined' 
    ? (localStorage.getItem('adminViewMode') as UserRole) || role 
    : role;

  return { 
    role: effectiveRole, 
    loading: loading || authLoading,
    isAdmin: effectiveRole === 'admin',
    isManagement: effectiveRole === 'management',
    isCrm: effectiveRole === 'crm',
    isAgent: effectiveRole === 'agent' || !effectiveRole
  };
}
