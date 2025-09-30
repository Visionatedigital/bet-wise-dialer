import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Campaign {
  id: string;
  name: string;
  total_calls: number;
  total_conversions: number;
  total_deposits: number;
}

interface PerformanceMetrics {
  totalCalls: number;
  connects: number;
  conversions: number;
  totalRevenue: number;
  connectRate: number;
  conversionRate: number;
}

interface DailyPerformance {
  day: string;
  calls: number;
  conversions: number;
}

export function usePerformanceData(dateRange: string, campaignId?: string) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalCalls: 0,
    connects: 0,
    conversions: 0,
    totalRevenue: 0,
    connectRate: 0,
    conversionRate: 0,
  });
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      // Fetch campaigns
      const { data: campaignsData } = await supabase
        .from("campaigns")
        .select("id, name, total_calls, total_conversions, total_deposits")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (campaignsData) {
        setCampaigns(campaignsData);
      }

      // Calculate date range
      let endDate = new Date();
      let startDate = new Date();
      
      switch (dateRange) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "yesterday":
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case "7d":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "month":
          startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
          break;
        case "last-month":
          startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
          endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
          break;
      }

      // Build query for call activities
      let query = supabase
        .from("call_activities")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString());

      if (campaignId && campaignId !== "all") {
        query = query.eq("campaign_id", campaignId);
      }

      const { data: callsData } = await query;

      if (callsData) {
        const totalCalls = callsData.length;
        const connects = callsData.filter(call => call.status === "connected" || call.status === "converted").length;
        const conversions = callsData.filter(call => call.status === "converted").length;
        const totalRevenue = callsData.reduce((sum, call) => sum + (Number(call.deposit_amount) || 0), 0);

        setMetrics({
          totalCalls,
          connects,
          conversions,
          totalRevenue,
          connectRate: totalCalls > 0 ? (connects / totalCalls) * 100 : 0,
          conversionRate: connects > 0 ? (conversions / connects) * 100 : 0,
        });

        // Calculate daily performance
        const dailyMap = new Map<string, { calls: number; conversions: number }>();
        
        callsData.forEach(call => {
          const day = new Date(call.start_time).toLocaleDateString('en-US', { weekday: 'short' });
          const existing = dailyMap.get(day) || { calls: 0, conversions: 0 };
          existing.calls++;
          if (call.status === "converted") {
            existing.conversions++;
          }
          dailyMap.set(day, existing);
        });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyData = days.map(day => ({
          day,
          calls: dailyMap.get(day)?.calls || 0,
          conversions: dailyMap.get(day)?.conversions || 0,
        }));

        setDailyPerformance(dailyData);
      }

      setLoading(false);
    };

    fetchData();

    // Set up real-time subscription
    const subscription = supabase
      .channel('performance-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'call_activities', filter: `user_id=eq.${user.id}` },
        () => fetchData()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, dateRange, campaignId]);

  return {
    campaigns,
    metrics,
    dailyPerformance,
    loading,
  };
}
