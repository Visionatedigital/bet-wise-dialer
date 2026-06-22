import { useEffect, useState } from "react";
import { api } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "./useUserRole";

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
  totalRevenue: number; // Official verified revenue (0 for now)
  reportedRevenue: number; // Unverified agent-reported estimates
  connectRate: number;
  conversionRate: number;
}

interface DailyPerformance {
  day: string;
  calls: number;
  conversions: number;
}

export function usePerformanceData(dateRange: string, campaignId?: string, forceIndividual?: boolean) {
  const { user } = useAuth();
  const { isManagement, isAdmin } = useUserRole();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalCalls: 0,
    connects: 0,
    conversions: 0,
    totalRevenue: 0,
    reportedRevenue: 0,
    connectRate: 0,
    conversionRate: 0,
  });
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        let userIds: string[] = [];
        
        if (forceIndividual) {
          userIds = [user.id];
        } else if (isManagement && !isAdmin) {
          const managerAgents = await api.get<any[]>(`/profiles?manager_id=${user.id}&approved=true`);
          userIds = managerAgents?.map(a => a.id) || [];
          if (userIds.length === 0) {
            setMetrics({
              totalCalls: 0,
              connects: 0,
              conversions: 0,
              totalRevenue: 0,
              connectRate: 0,
              conversionRate: 0,
            });
            setDailyPerformance([]);
            setCampaigns([]);
            setLoading(false);
            return;
          }
        } else {
          userIds = [user.id];
        }

        const allCampaigns = await api.get<Campaign[]>("/campaigns");
        
        // Filter campaigns locally
        const filteredCampaigns = allCampaigns.filter(c => {
          if (forceIndividual) return (c as any).user_id === user.id;
          if (isManagement && !isAdmin) return userIds.includes((c as any).user_id);
          return (c as any).user_id === user.id;
        });
        
        setCampaigns(filteredCampaigns);

        let endDate = new Date();
        let startDate = new Date();
        
        switch (dateRange) {
          case "today":
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "yesterday":
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setDate(endDate.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "7d":
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "30d":
            startDate.setDate(startDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "month":
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "last-month":
            startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        }

        // Fetch calls for these users
        let callsData: any[] = [];
        
        for (const uid of userIds) {
          const userCalls = await api.get<any[]>(
            `/call-activities?user_id=${uid}&start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&limit=1000${campaignId && campaignId !== 'all' ? `&campaign_id=${campaignId}` : ''}`
          );
          callsData = [...callsData, ...userCalls];
        }

        const deduplicateAllCalls = (calls: any[]): any[] => {
          if (!calls || calls.length === 0) return [];
          const callGroups = new Map<string, any[]>();
          calls.forEach((call) => {
            const key = `${call.user_id}_${call.phone_number || 'unknown'}`;
            if (!callGroups.has(key)) callGroups.set(key, []);
            callGroups.get(key)!.push(call);
          });

          const deduplicated: any[] = [];
          const DEDUP_WINDOW_MS = 10 * 60 * 1000;

          callGroups.forEach((group) => {
            if (group.length === 1) {
              deduplicated.push(group[0]);
              return;
            }

            group.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

            let lastKeptCall: any = null;
            group.forEach((call) => {
              const callTime = new Date(call.start_time).getTime();
              if (!lastKeptCall) {
                lastKeptCall = call;
                deduplicated.push(call);
              } else {
                const timeDiff = callTime - new Date(lastKeptCall.start_time).getTime();
                if (timeDiff > DEDUP_WINDOW_MS) {
                  lastKeptCall = call;
                  deduplicated.push(call);
                }
              }
            });
          });
          return deduplicated;
        };

        const deduplicatedAllCalls = deduplicateAllCalls(callsData);
        const totalCalls = deduplicatedAllCalls.length;
        const connects = deduplicatedAllCalls.filter(call => ["connected", "converted", "interested", "not_interested", "answered_no_response"].includes(call.status) || (Number(call.duration_seconds) > 0)).length;
        const conversions = callsData.filter(call => call.status === "converted" || (call.deposit_amount && Number(call.deposit_amount) > 0)).length;
        const totalRevenue = 0; // Official verified revenue
        const reportedRevenue = callsData.reduce((sum, call) => sum + (Number(call.deposit_amount) || 0), 0);

        setMetrics({
          totalCalls,
          connects,
          conversions,
          totalRevenue,
          reportedRevenue,
          connectRate: totalCalls > 0 ? (connects / totalCalls) * 100 : 0,
          conversionRate: connects > 0 ? (conversions / connects) * 100 : 0,
        });

        const dailyMap = new Map<string, { calls: number; conversions: number }>();
        deduplicatedAllCalls.forEach(call => {
          const day = new Date(call.start_time).toLocaleDateString('en-US', { weekday: 'short' });
          const existing = dailyMap.get(day) || { calls: 0, conversions: 0 };
          existing.calls++;
          if (call.status === "converted") existing.conversions++;
          dailyMap.set(day, existing);
        });

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dailyData = days.map(day => ({
          day,
          calls: dailyMap.get(day)?.calls || 0,
          conversions: dailyMap.get(day)?.conversions || 0,
        }));

        setDailyPerformance(dailyData);
      } catch (err) {
        console.error("Error fetching performance data:", err);
      }
      setLoading(false);
    };

    fetchData();

    // Changed real-time subscription to interval polling
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user, dateRange, campaignId, isManagement, isAdmin, forceIndividual]);

  return { campaigns, metrics, dailyPerformance, loading };
}
