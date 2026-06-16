import { useState, useEffect } from 'react';
import { api } from '@/integrations/supabase/client';

interface TodayMetrics {
  totalCalls: number;
  answered: number;
  abandoned: number;
  avgHandleTime: string;
  avgSpeedAnswer: string;
  conversionRate: number;
}

export function useTodayMetrics() {
  const [metrics, setMetrics] = useState<TodayMetrics>({
    totalCalls: 0,
    answered: 0,
    abandoned: 0,
    avgHandleTime: '0:00',
    avgSpeedAnswer: '0:00',
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      // Get start and end of today in Uganda timezone (EAT = UTC+3)
      const now = new Date();
      // Uganda start of day (00:00:00 EAT) is 21:00:00 UTC of previous day
      const startOfTodayEAT = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }));
      startOfTodayEAT.setHours(0, 0, 0, 0);
      // EAT is 3 hours ahead of UTC, so subtract 3 hours to get the UTC time
      const startOfTodayUTC = new Date(startOfTodayEAT.getTime() - (3 * 60 * 60 * 1000));
      
      const endOfTodayEAT = new Date(startOfTodayEAT);
      endOfTodayEAT.setHours(23, 59, 59, 999);
      const endOfTodayUTC = new Date(endOfTodayEAT.getTime() - (3 * 60 * 60 * 1000));

      // Fetch all call activities for today
      // Setting high limit to get all calls for today.
      const callActivities = await api.get<any[]>(`/call-activities?start_date=${startOfTodayUTC.toISOString()}&end_date=${endOfTodayUTC.toISOString()}&limit=1000`);

      const totalCalls = callActivities?.length || 0;
      
      // Count answered calls (connected, converted)
      const answered = callActivities?.filter(
        call => call.status === 'connected' || call.status === 'converted'
      ).length || 0;

      // Calculate abandoned (calls that weren't answered)
      const abandoned = totalCalls - answered;

      // Calculate average handle time
      const totalHandleTime = callActivities?.reduce(
        (sum, call) => sum + (call.duration_seconds || 0), 
        0
      ) || 0;
      const avgHandleTimeSeconds = answered > 0 ? Math.floor(totalHandleTime / answered) : 0;
      const avgHandleMinutes = Math.floor(avgHandleTimeSeconds / 60);
      const avgHandleSeconds = avgHandleTimeSeconds % 60;
      const avgHandleTime = `${avgHandleMinutes}:${avgHandleSeconds.toString().padStart(2, '0')}`;

      // Calculate average speed to answer (mock for now - would need queue data)
      const avgSpeedAnswer = '0:45';

      // Calculate conversion rate
      const conversions = callActivities?.filter(
        call => call.status === 'converted'
      ).length || 0;
      const conversionRate = totalCalls > 0 
        ? Math.round((conversions / totalCalls) * 100 * 10) / 10 
        : 0;

      setMetrics({
        totalCalls,
        answered,
        abandoned,
        avgHandleTime,
        avgSpeedAnswer,
        conversionRate,
      });
    } catch (error) {
      console.error('Error fetching today metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Refresh every minute, replaced websockets with polling
    const interval = setInterval(fetchMetrics, 60000);

    return () => clearInterval(interval);
  }, []);

  return { metrics, loading, refetch: fetchMetrics };
}
