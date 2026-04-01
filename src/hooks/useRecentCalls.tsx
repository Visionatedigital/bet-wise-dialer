import { useEffect, useState } from "react";
import { api } from "@/integrations/supabase/client";
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

      try {
        const data = await api.get<RecentCall[]>(
          `/call-activities?user_id=${user.id}&start_date=${today.toISOString()}&limit=20`
        );
        setCalls(data || []);
      } catch (error) {
        console.error("Error fetching recent calls:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();

    // Replaced real-time subscription with polling
    const interval = setInterval(fetchCalls, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return { calls, loading };
}