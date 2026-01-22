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

      // Calculate deduplicated calls_made for today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data: todayCalls } = await supabase
        .from('call_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .range(0, 99999);

      // Deduplication function: Groups calls by phone_number and removes duplicates within 10 minutes
      const deduplicateCalls = (calls: any[]): any[] => {
        if (!calls || calls.length === 0) return [];
        
        const callGroups = new Map<string, any[]>();
        
        calls.forEach((call) => {
          const key = `${call.user_id}_${call.phone_number || 'unknown'}`;
          if (!callGroups.has(key)) {
            callGroups.set(key, []);
          }
          callGroups.get(key)!.push(call);
        });

        const deduplicated: any[] = [];
        const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

        callGroups.forEach((group) => {
          if (group.length === 1) {
            deduplicated.push(group[0]);
            return;
          }

          group.sort((a, b) => {
            const timeA = new Date(a.start_time || a.created_at).getTime();
            const timeB = new Date(b.start_time || b.created_at).getTime();
            return timeA - timeB;
          });

          let lastKeptCall: any = null;
          
          group.forEach((call) => {
            const callTime = new Date(call.start_time || call.created_at).getTime();
            
            if (!lastKeptCall) {
              lastKeptCall = call;
              deduplicated.push(call);
            } else {
              const lastKeptTime = new Date(lastKeptCall.start_time || lastKeptCall.created_at).getTime();
              const timeDiff = callTime - lastKeptTime;
              
              if (timeDiff > DEDUP_WINDOW_MS) {
                lastKeptCall = call;
                deduplicated.push(call);
              } else {
                const shouldReplace = 
                  (call.status === 'converted' && lastKeptCall.status !== 'converted') ||
                  (call.status === 'converted' && lastKeptCall.status === 'converted' && 
                   (Number(call.duration_seconds) || 0) > (Number(lastKeptCall.duration_seconds) || 0)) ||
                  (call.status === 'connected' && lastKeptCall.status !== 'converted' && 
                   (Number(call.duration_seconds) || 0) > (Number(lastKeptCall.duration_seconds) || 0)) ||
                  (call.status === lastKeptCall.status && 
                   (Number(call.duration_seconds) || 0) > (Number(lastKeptCall.duration_seconds) || 0)) ||
                  (call.status === lastKeptCall.status && 
                   (Number(call.duration_seconds) || 0) === (Number(lastKeptCall.duration_seconds) || 0) &&
                   callTime > lastKeptTime);
                
                if (shouldReplace) {
                  const index = deduplicated.indexOf(lastKeptCall);
                  if (index > -1) {
                    deduplicated.splice(index, 1);
                  }
                  lastKeptCall = call;
                  deduplicated.push(call);
                }
              }
            }
          });
        });

        return deduplicated;
      };

      const deduplicatedTodayCalls = deduplicateCalls(todayCalls || []);
      const todayCallsMade = deduplicatedTodayCalls.length;
      
      // Calculate connects from deduplicated calls: unique phone numbers that actually connected
      // A call is considered "connected" if:
      // 1. Status is 'converted' (definitely answered)
      // 2. Status is 'connected' AND duration_seconds > 0 (actually rang and was answered)
      const todayConnects = deduplicatedTodayCalls.filter(call => {
        if (call.status === 'converted') return true;
        if (call.status === 'connected') {
          return (Number(call.duration_seconds) || 0) > 0;
        }
        return false;
      }).length;

      // Calculate deduplicated calls_made for yesterday
      const yesterdayStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      yesterdayStart.setHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const { data: yesterdayCalls } = await supabase
        .from('call_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', yesterdayStart.toISOString())
        .lte('start_time', yesterdayEnd.toISOString())
        .range(0, 99999);

      const deduplicatedYesterdayCalls = deduplicateCalls(yesterdayCalls || []);
      const yesterdayCallsMade = deduplicatedYesterdayCalls.length;
      
      // Calculate connects from deduplicated calls for yesterday
      const yesterdayConnects = deduplicatedYesterdayCalls.filter(call => {
        if (call.status === 'converted') return true;
        if (call.status === 'connected') {
          return (Number(call.duration_seconds) || 0) > 0;
        }
        return false;
      }).length;

      setTodayMetrics({
        ...(todayData || {
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
        }),
        calls_made: todayCallsMade, // Override with deduplicated count
        connects: todayConnects // Override with deduplicated connects count
      });

      setYesterdayMetrics({
        ...(yesterdayData || {
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
        }),
        calls_made: yesterdayCallsMade, // Override with deduplicated count
        connects: yesterdayConnects // Override with deduplicated connects count
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
      const { data, error } = await supabase
        .from('call_activities')
        .insert({
          user_id: user.id,
          ...activity
        })
        .select()
        .single();

      if (error) {
        console.error('[useCallMetrics] Database error creating call activity:', error);
        throw error;
      }

      // Refresh metrics after creating activity (non-blocking)
      // Don't await to prevent hanging - metrics will update in background
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