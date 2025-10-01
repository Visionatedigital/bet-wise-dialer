import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RecentCall {
  id: string;
  lead_name: string;
  phone_number: string;
  duration_seconds: number;
  start_time: string;
  status: string;
  recording_url: string | null;
  campaign_id: string | null;
}

export function useRecentCalls() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchCalls = async () => {
      setLoading(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("call_activities")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", today.toISOString())
        .order("start_time", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching recent calls:", error);
      } else {
        setCalls(data || []);
      }
      setLoading(false);
    };

    fetchCalls();

    // Set up real-time subscription
    const subscription = supabase
      .channel('recent-calls-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_activities', filter: `user_id=eq.${user.id}` },
        () => fetchCalls()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return { calls, loading };
}