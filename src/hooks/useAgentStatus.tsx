import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setStatus((data as any).status as AgentStatus);
      }
      setLoading(false);
    };

    fetchStatus();

    // Subscribe to status changes
    const channel = supabase
      .channel('profile-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          setStatus(payload.new.status as AgentStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateStatus = useCallback(
    async (newStatus: AgentStatus) => {
      if (!user) return;

      // Avoid spamming Supabase with identical status updates
      if (newStatus === status) {
        console.log('[AgentStatus] Skipping status update (no change):', newStatus);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: newStatus,
          current_call_start: newStatus === 'on-call' ? new Date().toISOString() : null,
          last_status_change: new Date().toISOString()
        } as any)
        .eq('id', user.id);

      if (!error) {
        setStatus(newStatus);
        console.log('[AgentStatus] Updated status to:', newStatus);
      } else {
        console.error('[AgentStatus] Failed to update status:', error);
      }
    },
    [user, status]
  );

  return { status, updateStatus, loading };
}
