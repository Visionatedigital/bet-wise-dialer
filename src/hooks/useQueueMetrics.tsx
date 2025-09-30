import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QueueMetric {
  id: string;
  name: string;
  waiting: number;
  longest: string;
  agents: number;
  status: string;
}

export function useQueueMetrics() {
  const [queues, setQueues] = useState<QueueMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueueMetrics = async () => {
    try {
      // Fetch all active campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, name, status')
        .eq('status', 'active');

      if (campaignsError) throw campaignsError;

      if (!campaigns || campaigns.length === 0) {
        setQueues([]);
        setLoading(false);
        return;
      }

      // Fetch leads for each campaign (waiting = leads not yet called today)
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('campaign_id, next_action_due')
        .in('campaign_id', campaigns.map(c => c.id));

      if (leadsError) throw leadsError;

      // Fetch agents working on each campaign today
      const today = new Date().toISOString().split('T')[0];
      const { data: callActivities, error: callError } = await supabase
        .from('call_activities')
        .select('campaign_id, user_id')
        .gte('start_time', `${today}T00:00:00`)
        .lt('start_time', `${today}T23:59:59`)
        .in('campaign_id', campaigns.map(c => c.id));

      if (callError) throw callError;

      // Build queue metrics
      const queueMetrics: QueueMetric[] = campaigns.map(campaign => {
        // Count waiting leads (leads with pending next action)
        const campaignLeads = leads?.filter(l => l.campaign_id === campaign.id) || [];
        const waiting = campaignLeads.filter(l => l.next_action_due).length;

        // Calculate longest wait (mock calculation - could be enhanced)
        const longestMinutes = waiting > 0 ? Math.floor(Math.random() * 15) + 1 : 0;
        const longest = `${longestMinutes}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;

        // Count unique agents assigned to this campaign
        const uniqueAgents = new Set(
          callActivities?.filter(ca => ca.campaign_id === campaign.id).map(ca => ca.user_id)
        );
        const agents = uniqueAgents.size;

        return {
          id: campaign.id,
          name: campaign.name,
          waiting,
          longest,
          agents,
          status: campaign.status,
        };
      });

      setQueues(queueMetrics);
    } catch (error) {
      console.error('Error fetching queue metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueMetrics();

    // Subscribe to changes
    const campaignsChannel = supabase
      .channel('campaigns-queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns',
        },
        () => {
          fetchQueueMetrics();
        }
      )
      .subscribe();

    const leadsChannel = supabase
      .channel('leads-queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        () => {
          fetchQueueMetrics();
        }
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchQueueMetrics, 30000);

    return () => {
      supabase.removeChannel(campaignsChannel);
      supabase.removeChannel(leadsChannel);
      clearInterval(interval);
    };
  }, []);

  return { queues, loading, refetch: fetchQueueMetrics };
}
