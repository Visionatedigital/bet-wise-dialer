import { useState, useEffect, useCallback } from 'react';
import { api } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AgentStatus = 'online' | 'on-call' | 'break' | 'offline';

export function useAgentStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<AgentStatus>('offline');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch initial status
    const fetchStatus = async () => {
      try {
        const profile = await api.get<any>(`/profiles/${user.id}`);
        if (profile && profile.status) {
          setStatus(profile.status as AgentStatus);
        }
      } catch (error) {
        console.error('Error fetching agent status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    
    // Poll for status changes every 30s instead of websockets
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const updateStatus = useCallback(
    async (newStatus: AgentStatus) => {
      if (!user) return;

      if (newStatus === status) {
        console.log('[AgentStatus] Skipping status update (no change):', newStatus);
        return;
      }

      // Optimistic update
      const prevStatus = status;
      setStatus(newStatus);

      try {
        await api.patch(`/profiles/${user.id}`, { 
          status: newStatus,
          current_call_start: newStatus === 'on-call' ? new Date().toISOString() : null,
        });
        console.log('[AgentStatus] Updated status to:', newStatus);
      } catch (error) {
        console.error('[AgentStatus] Failed to update status:', error);
        // Rollback
        setStatus(prevStatus);
      }
    },
    [user, status]
  );

  return { status, updateStatus, loading };
}
