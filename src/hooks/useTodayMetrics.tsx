import { useState, useEffect } from 'react';
import { api } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { COUNTRY_MAP, COUNTRY_OFFSETS } from '@/config/countries';

interface TodayMetrics {
  totalCalls: number;
  answered: number;
  abandoned: number;
  avgHandleTime: string;
  avgSpeedAnswer: string;
  conversionRate: number;
}

export function useTodayMetrics() {
  const { user } = useAuth();
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
      // Get start and end of today in user's timezone
      const now = new Date();
      const countryCode = user?.country || 'UG';
      const tz = COUNTRY_MAP[countryCode]?.timezone || 'Africa/Kampala';
      const offsetHours = COUNTRY_OFFSETS[countryCode] ?? 3;

      const dateStr = now.toLocaleDateString('en-CA', { timeZone: tz });
      const startOfTodayLocal = new Date(`${dateStr}T00:00:00.000Z`);
      const startOfTodayUTC = new Date(startOfTodayLocal.getTime() - (offsetHours * 60 * 60 * 1000));
      
      const endOfTodayLocal = new Date(`${dateStr}T23:59:59.999Z`);
      const endOfTodayUTC = new Date(endOfTodayLocal.getTime() - (offsetHours * 60 * 60 * 1000));

      // Fetch all call activities for today
      // Setting high limit to get all calls for today.
      const callActivities = await api.get<any[]>(`/call-activities?start_date=${startOfTodayUTC.toISOString()}&end_date=${endOfTodayUTC.toISOString()}&limit=1000`);

      const totalCalls = callActivities?.length || 0;
      
      // Count answered calls (connected, converted)
      const answered = callActivities?.filter(
        call => ['connected', 'converted', 'interested', 'not_interested', 'answered_no_response'].includes(call.status) || (call.duration_seconds || 0) > 0
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
        call => call.status === 'converted' || (call.deposit_amount && Number(call.deposit_amount) > 0)
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
  }, [user]);

  return { metrics, loading, refetch: fetchMetrics };
}
