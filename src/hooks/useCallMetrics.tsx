import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Fetch today's metrics
      const { data: todayData, error: todayError } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (todayError && todayError.code !== 'PGRST116') {
        throw todayError;
      }

      // Fetch yesterday's metrics
      const { data: yesterdayData, error: yesterdayError } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', yesterday)
        .maybeSingle();

      if (yesterdayError && yesterdayError.code !== 'PGRST116') {
        throw yesterdayError;
      }

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
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('call_activities')
        .insert({
          user_id: user.id,
          ...activity
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh metrics after creating activity
      await fetchMetrics();
      
      return data;
    } catch (err) {
      console.error('Error creating call activity:', err);
      throw err;
    }
  };

  const updateCallActivity = async (id: string, updates: Partial<CallActivity>) => {
    try {
      const { data, error } = await supabase
        .from('call_activities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

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

    // Set up real-time subscription for daily metrics
    const channel = supabase
      .channel('daily-metrics-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_metrics',
          filter: `user_id=eq.${user?.id}`
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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