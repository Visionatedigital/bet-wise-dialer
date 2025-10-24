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
      // Fetch all profiles with their call data
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, status, current_call_start, last_status_change, approved')
        .eq('approved', true) as any;

      if (profilesError) throw profilesError;

      // Fetch today's call activities for each agent
      const today = new Date().toISOString().split('T')[0];
      const { data: callData, error: callError } = await supabase
        .from('call_activities')
        .select('user_id, campaign_id, duration_seconds, start_time, end_time')
        .gte('start_time', `${today}T00:00:00`)
        .lt('start_time', `${today}T23:59:59`);

      if (callError) throw callError;

      // Fetch campaigns for names
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name');

      const campaignMap = new Map(campaigns?.map(c => [c.id, c.name]) || []);

      // Fetch assigned leads count for each agent
      const { data: leadsData } = await supabase
        .from('leads')
        .select('user_id')
        .not('user_id', 'is', null);

      const leadsCountMap = new Map<string, number>();
      leadsData?.forEach(lead => {
        const count = leadsCountMap.get(lead.user_id!) || 0;
        leadsCountMap.set(lead.user_id!, count + 1);
      });

      // Process agent data
      const now = new Date();
      const formatHMS = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
          .toString()
          .padStart(2, '0')}`;
      };

      const agentsData: AgentData[] = (profiles || [])
        .map((profile: any) => {
          const agentCalls = (callData || []).filter((c: any) => c.user_id === profile.id);
          const lastCall = agentCalls.reduce((acc: any, c: any) => {
            if (!acc) return c;
            return new Date(c.start_time) > new Date(acc.start_time) ? c : acc;
          }, null as any);

          // Derive a more accurate status
          let derivedStatus: string = profile.status || 'offline';
          if (profile.current_call_start) {
            derivedStatus = 'on-call';
          } else if (lastCall) {
            const start = new Date(lastCall.start_time);
            const ended = lastCall.end_time ? new Date(lastCall.end_time) : null;
            if (!ended && (now.getTime() - start.getTime()) < 10 * 60 * 1000) {
              derivedStatus = 'on-call';
            }
          }

          // Duration since current state began
          let duration = '00:00:00';
          if (derivedStatus === 'on-call' && profile.current_call_start) {
            duration = formatHMS(Math.floor((now.getTime() - new Date(profile.current_call_start).getTime()) / 1000));
          } else if (profile.last_status_change) {
            duration = formatHMS(Math.floor((now.getTime() - new Date(profile.last_status_change).getTime()) / 1000));
          }

          // Avatar initials
          const name = profile.full_name || profile.email || 'Unknown';
          const words = name.split(' ');
          const avatar = words.length > 1
            ? `${words[0][0]}${words[1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();

          // Current campaign (from most recent call today)
          const currentCampaignId = lastCall?.campaign_id;
          const currentCampaign = currentCampaignId ? campaignMap.get(currentCampaignId) : 'No Campaign';

          return {
            id: profile.id,
            name,
            email: profile.email || '',
            status: derivedStatus,
            duration,
            campaign: currentCampaign || 'No Campaign',
            avatar,
            score: 0,
            calls: agentCalls.length,
            assignedLeads: leadsCountMap.get(profile.id) || 0,
          } as AgentData;
        })
        // Keep only agent-like accounts
        .filter((a: AgentData) => a.assignedLeads > 0 || a.calls > 0 || a.status === 'on-call');

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
          event: 'INSERT',
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
