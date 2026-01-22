import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  totalRevenue: number;
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
    connectRate: 0,
    conversionRate: 0,
  });
  const [dailyPerformance, setDailyPerformance] = useState<DailyPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      // Determine which user IDs to fetch data for
      let userIds: string[] = [];
      
      // If forceIndividual is true, always use individual stats
      if (forceIndividual) {
        userIds = [user.id];
      } else if (isManagement && !isAdmin && user) {
        // For managers, fetch their assigned agents
        const { data: managerAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);
        
        userIds = managerAgents?.map(a => a.id) || [];
        
        if (userIds.length === 0) {
          // No agents assigned, return empty data
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
        // For regular agents or admins, use their own ID
        userIds = [user.id];
      }

      // Fetch campaigns - for managers, get campaigns from their agents (unless forceIndividual)
      let campaignsQuery = supabase
        .from("campaigns")
        .select("id, name, total_calls, total_conversions, total_deposits");
      
      if (forceIndividual) {
        // Always use individual campaigns when forcing individual stats
        campaignsQuery = campaignsQuery.eq("user_id", user.id);
      } else if (isManagement && !isAdmin) {
        // Managers see campaigns from their agents' calls
        campaignsQuery = campaignsQuery.in("user_id", userIds);
      } else {
        campaignsQuery = campaignsQuery.eq("user_id", user.id);
      }
      
      const { data: campaignsData } = await campaignsQuery.order("created_at", { ascending: false });

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

      // Build query for call activities - filter by user IDs
      let query = supabase
        .from("call_activities")
        .select("*");
      
      // Use .eq() for individual stats, .in() for team stats
      if (forceIndividual || userIds.length === 1) {
        query = query.eq("user_id", userIds[0]);
      } else {
        query = query.in("user_id", userIds);
      }
      
      query = query
        .gte("start_time", startDate.toISOString())
        .lte("start_time", endDate.toISOString());

      if (campaignId && campaignId !== "all") {
        query = query.eq("campaign_id", campaignId);
      }
      
      // Apply range limit AFTER all filters to ensure we get ALL matching records
      query = query.range(0, 99999); // Fetch up to 100,000 records to include ALL calls

      const { data: callsData } = await query;

      if (callsData) {
        // Deduplication function: Groups calls by (user_id, phone_number) and removes duplicates within 10 minutes
        // If agent calls same number multiple times within 10 minutes, count only once
        // Priority: converted > connected > longest duration > most recent
        const deduplicateAllCalls = (calls: any[]): any[] => {
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

        // Deduplicate ALL calls first: If agent calls same number multiple times within 10 minutes, count only once
        const deduplicatedAllCalls = deduplicateAllCalls(callsData);
        
        // Total calls = all deduplicated call attempts (one per phone number per agent)
        const totalCalls = deduplicatedAllCalls.length;
        
        // Connects = only calls that actually rang and were answered (from deduplicated set)
        const connects = deduplicatedAllCalls.filter(call => {
          if (call.status === "converted") return true;
          if (call.status === "connected") {
            return (Number(call.duration_seconds) || 0) > 0;
          }
          return false;
        }).length;
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

        // Calculate daily performance using deduplicated calls
        const dailyMap = new Map<string, { calls: number; conversions: number }>();
        
        deduplicatedAllCalls.forEach(call => {
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
    // If forceIndividual is true, always subscribe to individual calls only
    const setupSubscription = async () => {
      let filterString = '';
      
      if (forceIndividual) {
        // Always subscribe to individual calls when forcing individual stats
        filterString = `user_id=eq.${user.id}`;
      } else if (isManagement && !isAdmin && user) {
        // Fetch manager's agents for subscription filter
        const { data: managerAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);
        
        const agentIds = managerAgents?.map(a => a.id) || [];
        if (agentIds.length > 0) {
          if (agentIds.length === 1) {
            filterString = `user_id=eq.${agentIds[0]}`;
          } else {
            filterString = `user_id=in.(${agentIds.join(',')})`;
          }
        } else {
          filterString = `user_id=eq.${user.id}`; // Fallback
        }
      } else {
        filterString = `user_id=eq.${user.id}`;
      }

      return supabase
        .channel('performance-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'call_activities', filter: filterString },
          () => fetchData()
        )
        .subscribe();
    };

    let subscription: any;
    setupSubscription().then(sub => {
      subscription = sub;
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [user, dateRange, campaignId, isManagement, isAdmin, forceIndividual]);

  return {
    campaigns,
    metrics,
    dailyPerformance,
    loading,
  };
}
