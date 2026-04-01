import { useState, useEffect } from 'react';
import { api } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from './useUserRole';

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
  managerId?: string;
}

export function useMonitorData() {
  const { user } = useAuth();
  const { isManagement, isAdmin } = useUserRole();
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      const data = await api.get<any[]>('/monitor');

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
          calls: parseInt(agent.calls_today) || 0,
          assignedLeads: parseInt(agent.assigned_leads) || 0,
          managerId: agent.manager_id,
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
    if (!user || (!isManagement && !isAdmin)) return;

    fetchAgents();

    // Refresh every 15 seconds for updates instead of websockets
    const interval = setInterval(fetchAgents, 15000);

    return () => clearInterval(interval);
  }, [user, isManagement, isAdmin]);

  return { agents, loading, refetch: fetchAgents };
}
