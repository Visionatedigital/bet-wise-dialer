import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/integrations/supabase/client';
import { COUNTRY_MAP } from '@/config/countries';

export interface DailyMetrics {
  id: string;
  user_id: string;
  date: string;
  calls_made: number;
  connects: number;
  total_handle_time_seconds: number;
  conversions: number;
  total_deposit_value: number;
  callbacks_due: number;
  created_at: string;
  updated_at: string;
}

export interface CallActivity {
  id: string;
  user_id: string;
  lead_name: string | null;
  phone_number: string | null;
  call_type: 'outbound' | 'inbound' | 'callback';
  status: 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'disconnected' | 'converted';
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  notes: string | null;
  deposit_amount: number;
  created_at: string;
  updated_at: string;
}

export const useCallMetrics = () => {
  const { user } = useAuth();
  const [todayMetrics, setTodayMetrics] = useState<DailyMetrics | null>(null);
  const [yesterdayMetrics, setYesterdayMetrics] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const countryCode = user.country || 'UG';
      const tz = COUNTRY_MAP[countryCode]?.timezone || 'Africa/Kampala';
      
      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterday = yesterdayDate.toLocaleDateString('en-CA', { timeZone: tz });

      // Fetch daily metrics
      const fetchedMetrics = await api.get<DailyMetrics[]>(`/daily-metrics?user_id=${user.id}&start_date=${yesterday}&end_date=${today}`);

      const todayData = fetchedMetrics.find(m => m.date === today);
      const yesterdayData = fetchedMetrics.find(m => m.date === yesterday);

      // We'll rely on the server logic to maintain these automatically now rather than deduplicating
      // on the frontend. The new Express API updates daily_metrics on every call insertion.
      
      setTodayMetrics(todayData || {
        id: '',
        user_id: user.id,
        date: today,
        calls_made: 0,
        connects: 0,
        total_handle_time_seconds: 0,
        conversions: 0,
        total_deposit_value: 0,
        callbacks_due: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      setYesterdayMetrics(yesterdayData || {
        id: '',
        user_id: user.id,
        date: yesterday,
        calls_made: 0,
        connects: 0,
        total_handle_time_seconds: 0,
        conversions: 0,
        total_deposit_value: 0,
        callbacks_due: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const createCallActivity = async (activity: Partial<CallActivity>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const data = await api.post<CallActivity>('/call-activities', activity);

      // Refresh metrics after creating activity (non-blocking)
      fetchMetrics().catch(err => {
        console.warn('[useCallMetrics] Failed to refresh metrics (non-critical):', err);
      });

      return data;
    } catch (err) {
      console.error('[useCallMetrics] Error creating call activity:', err);
      throw err;
    }
  };

  const updateCallActivity = async (id: string, updates: Partial<CallActivity>) => {
    try {
      const data = await api.patch<CallActivity>(`/call-activities/${id}`, updates);
      
      // Refresh metrics after updating activity
      await fetchMetrics();

      return data;
    } catch (err) {
      console.error('Error updating call activity:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Replaced realtime subscription with interval polling for simplicity
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const getPercentageChange = (today: number, yesterday: number): number => {
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getAverageHandleTime = (metrics: DailyMetrics | null): number => {
    if (!metrics || metrics.connects === 0) return 0;
    return Math.round(metrics.total_handle_time_seconds / metrics.connects);
  };

  return {
    todayMetrics,
    yesterdayMetrics,
    loading,
    error,
    createCallActivity,
    updateCallActivity,
    refetch: fetchMetrics,
    getPercentageChange,
    formatDuration,
    getAverageHandleTime
  };
};