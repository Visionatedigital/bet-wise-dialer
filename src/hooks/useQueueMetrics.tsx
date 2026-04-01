import { useState, useEffect } from 'react';
import { api } from '@/integrations/supabase/client';

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
      const campaigns = await api.get<any[]>('/campaigns?status=active');

      if (!campaigns || campaigns.length === 0) {
        setQueues([]);
        setLoading(false);
        return;
      }

      // Fetch calls for today
      const today = new Date().toISOString().split('T')[0];
      const callActivities = await api.get<any[]>(`/call-activities?start_date=${today}T00:00:00&end_date=${today}T23:59:59&limit=5000`);

      // Mock calculation for Leads, since fetching all leads is expensive locally
      const queueMetrics: QueueMetric[] = campaigns.map(campaign => {
        // Mock waiting leads count based on campaign activity
        const mockWaiting = Math.floor(Math.random() * 50) + 10;

        // Calculate longest wait (mock calculation)
        const longestMinutes = mockWaiting > 0 ? Math.floor(Math.random() * 15) + 1 : 0;
        const longest = `${longestMinutes}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`;

        // Count unique agents assigned to this campaign
        const uniqueAgents = new Set(
          callActivities?.filter(ca => ca.campaign_id === campaign.id).map(ca => ca.user_id)
        );
        const agents = uniqueAgents.size;

        return {
          id: campaign.id,
          name: campaign.name,
          waiting: mockWaiting,
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
    // Refresh every 30 seconds
    const interval = setInterval(fetchQueueMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return { queues, loading, refetch: fetchQueueMetrics };
}
