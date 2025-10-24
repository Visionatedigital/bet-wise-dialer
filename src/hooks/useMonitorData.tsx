import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface AgentData {
  id: string;
  name: string;
  status: string;
  duration: string;
  campaign: string;
  avatar: string;
  score: number;
  calls: number;
  email: string;
  assignedLeads: number;
}

export function useMonitorData() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      // Call the secure function to fetch only agent data
      const { data, error } = await supabase.rpc('get_agent_monitor_data');

      if (error) throw error;

      const now = new Date();
      const formatHMS = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
          .toString()
          .padStart(2, '0')}`;
      };

      const agentsData: AgentData[] = (data || []).map((agent: any) => {
        // Derive status: use on-call if current_call_start is set
        let derivedStatus: string = agent.status || 'offline';
        if (agent.current_call_start) {
          derivedStatus = 'on-call';
        }

        // Duration since current state began
        let duration = '00:00:00';
        if (derivedStatus === 'on-call' && agent.current_call_start) {
          duration = formatHMS(Math.floor((now.getTime() - new Date(agent.current_call_start).getTime()) / 1000));
        } else if (agent.last_status_change) {
          duration = formatHMS(Math.floor((now.getTime() - new Date(agent.last_status_change).getTime()) / 1000));
        }

        // Avatar initials
        const name = agent.full_name || agent.email || 'Unknown';
        const words = name.split(' ');
        const avatar = words.length > 1
          ? `${words[0][0]}${words[1][0]}`.toUpperCase()
          : name.substring(0, 2).toUpperCase();

        return {
          id: agent.id,
          name,
          email: agent.email || '',
          status: derivedStatus,
          duration,
          campaign: agent.last_campaign_name || 'No Campaign',
          avatar,
          score: 0,
          calls: agent.calls_today || 0,
          assignedLeads: agent.assigned_leads || 0,
        } as AgentData;
      });

      setAgents(agentsData);
    } catch (error) {
      console.error('Error fetching monitor data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchAgents();

    // Subscribe to profile changes
    const profileChannel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchAgents();
        }
      )
      .subscribe();

    // Subscribe to call activity changes
    const callChannel = supabase
      .channel('call-activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_activities',
        },
        () => {
          fetchAgents();
        }
      )
      .subscribe();

    // Refresh every 30 seconds for duration updates
    const interval = setInterval(fetchAgents, 30000);

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(callChannel);
      clearInterval(interval);
    };
  }, [user]);

  return { agents, loading, refetch: fetchAgents };
}
