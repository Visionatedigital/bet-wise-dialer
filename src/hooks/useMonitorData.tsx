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
        .select('id, full_name, email, status, current_call_start, last_status_change') as any;

      if (profilesError) throw profilesError;

      // Fetch today's call activities for each agent
      const today = new Date().toISOString().split('T')[0];
      const { data: callData, error: callError } = await supabase
        .from('call_activities')
        .select('user_id, campaign_id, duration_seconds')
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
      const agentsData: AgentData[] = profiles?.map((profile: any) => {
        const agentCalls = callData?.filter(c => c.user_id === profile.id) || [];
        const currentCampaignId = agentCalls[0]?.campaign_id;
        const currentCampaign = currentCampaignId ? campaignMap.get(currentCampaignId) : 'No Campaign';

        // Calculate duration based on status
        let duration = '00:00';
        if (profile.status === 'on-call' && profile.current_call_start) {
          const start = new Date(profile.current_call_start);
          const now = new Date();
          const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
          const minutes = Math.floor(diff / 60);
          const seconds = diff % 60;
          duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else if (profile.last_status_change) {
          const start = new Date(profile.last_status_change);
          const now = new Date();
          const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
          const minutes = Math.floor(diff / 60);
          const seconds = diff % 60;
          duration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Get initials for avatar
        const name = profile.full_name || profile.email || 'Unknown';
        const words = name.split(' ');
        const avatar = words.length > 1 
          ? `${words[0][0]}${words[1][0]}`.toUpperCase()
          : name.substring(0, 2).toUpperCase();

        // Calculate average score (mock for now, could be based on quality scores)
        const score = 4.0 + Math.random() * 1.0;

        return {
          id: profile.id,
          name,
          email: profile.email || '',
          status: profile.status || 'offline',
          duration,
          campaign: currentCampaign || 'No Campaign',
          avatar,
          score: parseFloat(score.toFixed(1)),
          calls: agentCalls.length,
          assignedLeads: leadsCountMap.get(profile.id) || 0,
        };
      }) || [];

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
