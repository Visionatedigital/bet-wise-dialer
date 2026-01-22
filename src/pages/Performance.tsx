import { useState, useEffect } from "react";
import { ManagementLayout } from "@/components/layout/ManagementLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Users, Target, DollarSign, Download, Lightbulb, Brain } from "lucide-react";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { useFunnelAnalysis } from "@/hooks/useFunnelAnalysis";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { ExportReportModal } from "@/components/dashboard/ExportReportModal";
import { formatUGX } from "@/lib/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AgentOption {
  id: string;
  name: string;
  email: string;
}

interface AgentPerformance {
  agentId: string;
  agentName: string;
  email: string;
  calls: number;
  connects: number;
  conversions: number;
  revenue: number;
  connectRate: number;
  conversionRate: number;
}

export default function Performance() {
  const { user } = useAuth();
  const { isManagement, isAdmin } = useUserRole();
  const [dateRange, setDateRange] = useState("30d");
  const [campaignId, setCampaignId] = useState<string | undefined>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<AgentOption[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dailyPerformanceData, setDailyPerformanceData] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [teamAgentsData, setTeamAgentsData] = useState<any[]>([]);

  // Shared days map for date range calculations
  const daysMap: Record<string, number> = {
    'today': 0,
    'week': 7,
    'month': 30,
    'quarter': 90,
    '7d': 7,
    '30d': 30,
    '90d': 90
  };

  // Calculate team metrics from fetched data instead of using usePerformanceData (which only shows user's own data)
  const [teamMetrics, setTeamMetrics] = useState({
    totalCalls: 0,
    connects: 0,
    conversions: 0,
    totalRevenue: 0,
    connectRate: 0,
    conversionRate: 0,
  });

  // Verification data for debugging/verification
  const [verificationData, setVerificationData] = useState<{
    agentBreakdown: Array<{ agentId: string; agentName: string; callCount: number }>;
    hourlyBreakdown: Array<{ hour: string; callCount: number }>;
    sampleCalls: Array<{ id: string; agentName: string; phone: string; startTime: string; status: string }>;
    dateRange: { start: string; end: string };
    totalAgents: number;
  } | null>(null);
  const [showVerification, setShowVerification] = useState(false);

  const { campaigns } = usePerformanceData(dateRange, campaignId);
  const { funnelData, insights, message, loading: insightsLoading } = useFunnelAnalysis(
    dateRange, 
    campaignId || "", 
    (isManagement && !isAdmin && selectedAgent === 'all') ? user?.id : (selectedAgent !== 'all' ? selectedAgent : null)
  );
  // Only fetch agent analysis if viewing all agents (not needed for individual agent view)
  const { agents, insights: agentInsights, loading: agentAnalysisLoading } = useAgentAnalysis(
    selectedAgent === 'all' ? dateRange : '30d' // Use a default range if individual agent selected
  );

  // Debug logging
  useEffect(() => {
    console.log('[Performance] Insights state:', {
      hasInsights: !!insights,
      insightsCount: Array.isArray(insights) ? insights.length : 0,
      insights,
      message,
      loading: insightsLoading,
      hasAgentInsights: !!agentInsights,
      agentInsightsCount: Array.isArray(agentInsights) ? agentInsights.length : 0
    });
  }, [insights, message, insightsLoading, agentInsights]);

  // Fetch available agents for managers/admins
  useEffect(() => {
    if (isManagement || isAdmin) {
      fetchAvailableAgents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManagement, isAdmin, user]);

  // Fetch agent-specific performance when agent is selected
  useEffect(() => {
    if (selectedAgent !== 'all' && (isManagement || isAdmin)) {
      fetchAgentPerformance();
    } else {
      setAgentPerformance(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent, dateRange, isManagement, isAdmin]);

  // Fetch daily performance and team data, and calculate metrics
  useEffect(() => {
    console.log('[Performance] useEffect triggered - dateRange:', dateRange, 'selectedAgent:', selectedAgent);
    // Fetch real data (it will filter by date range internally)
    fetchDailyPerformance();
    if (selectedAgent === 'all' && (isManagement || isAdmin)) {
      fetchTeamAgentsData();
    } else {
      setTeamAgentsData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, selectedAgent, isManagement, isAdmin, user]);

  // Note: teamMetrics is now calculated directly in fetchDailyPerformance from FULL data
  // before filtering for chart display. This ensures accurate totals regardless of date range.

  // Deduplication function for ALL calls: Groups calls by (user_id, phone_number) and removes duplicates within a time window
  // If multiple calls to the same number by the same agent occur within 10 minutes, keep only one
  // This ensures "one number = one call count" per agent
  // Priority: converted > connected > longest duration > most recent
  const deduplicateAllCalls = (calls: any[]): any[] => {
    if (!calls || calls.length === 0) return [];
    
    // Group calls by user_id and phone_number
    const callGroups = new Map<string, any[]>();
    
    calls.forEach((call) => {
      const key = `${call.user_id}_${call.phone_number || 'unknown'}`;
      if (!callGroups.has(key)) {
        callGroups.set(key, []);
      }
      callGroups.get(key)!.push(call);
    });

    const deduplicated: any[] = [];
    const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

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
          return;
        }

        const lastKeptTime = new Date(lastKeptCall.start_time || lastKeptCall.created_at).getTime();
        const timeDiff = callTime - lastKeptTime;

        if (timeDiff > DEDUP_WINDOW_MS) {
          lastKeptCall = call;
          deduplicated.push(call);
    } else {
          // Within 10-minute window, prioritize: converted > connected > longest duration > most recent
          const shouldReplace = 
            (call.status === 'converted' && lastKeptCall.status !== 'converted') ||
            (call.status === 'connected' && lastKeptCall.status !== 'connected' && lastKeptCall.status !== 'converted') ||
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
      });
    });

    return deduplicated;
  };

  // Deduplication function: Groups calls by (user_id, phone_number) and removes duplicates within a time window
  // If multiple calls to the same number by the same agent occur within 10 minutes, keep only one
  // Priority: connected/converted > longest duration > most recent
  const deduplicateCalls = (calls: any[]): any[] => {
    if (!calls || calls.length === 0) return [];
    
    // Group calls by user_id and phone_number
    const callGroups = new Map<string, any[]>();
    
    calls.forEach((call) => {
      const key = `${call.user_id}_${call.phone_number || 'unknown'}`;
      if (!callGroups.has(key)) {
        callGroups.set(key, []);
      }
      callGroups.get(key)!.push(call);
    });

    const deduplicated: any[] = [];
    const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

    callGroups.forEach((group) => {
      if (group.length === 1) {
        // Single call, no duplicates
        deduplicated.push(group[0]);
        return;
      }

      // Sort by start_time
      group.sort((a, b) => {
        const timeA = new Date(a.start_time || a.created_at).getTime();
        const timeB = new Date(b.start_time || b.created_at).getTime();
        return timeA - timeB;
      });

      // Process calls in chronological order
      let lastKeptCall: any = null;
      
      group.forEach((call) => {
        const callTime = new Date(call.start_time || call.created_at).getTime();
        
        if (!lastKeptCall) {
          // First call in group, always keep
          lastKeptCall = call;
          deduplicated.push(call);
          return;
        }

        const lastKeptTime = new Date(lastKeptCall.start_time || lastKeptCall.created_at).getTime();
        const timeDiff = callTime - lastKeptTime;

        if (timeDiff > DEDUP_WINDOW_MS) {
          // More than 10 minutes apart, keep this call
          lastKeptCall = call;
          deduplicated.push(call);
        } else {
          // Within 10 minutes, decide which to keep based on priority
          const shouldReplace = 
            // Prefer connected/converted over other statuses
            (call.status === 'converted' && lastKeptCall.status !== 'converted') ||
            (call.status === 'connected' && lastKeptCall.status !== 'connected' && lastKeptCall.status !== 'converted') ||
            // If same status, prefer longer duration
            (call.status === lastKeptCall.status && 
             (Number(call.duration_seconds) || 0) > (Number(lastKeptCall.duration_seconds) || 0)) ||
            // If same status and duration, prefer more recent
            (call.status === lastKeptCall.status && 
             (Number(call.duration_seconds) || 0) === (Number(lastKeptCall.duration_seconds) || 0) &&
             callTime > lastKeptTime);

          if (shouldReplace) {
            // Remove the previous call and add this one
            const index = deduplicated.indexOf(lastKeptCall);
            if (index > -1) {
              deduplicated.splice(index, 1);
            }
            lastKeptCall = call;
            deduplicated.push(call);
          }
          // Otherwise, keep the previous call and skip this one
        }
      });
    });

    return deduplicated;
  };

  const fetchAvailableAgents = async () => {
    setLoadingAgents(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, manager_id')
        .eq('approved', true);

      // If manager, only show their team agents
      if (isManagement && !isAdmin && user) {
        query = query.eq('manager_id', user.id);
      }

      const { data: profiles, error } = await query;

      if (error) {
        console.error('Error fetching agents:', error);
        throw error;
      }

      const agents: AgentOption[] = (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email || 'Unknown',
        email: p.email || ''
      }));

      setAvailableAgents(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents list');
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchAgentPerformance = async () => {
    if (!selectedAgent || selectedAgent === 'all') return;

    try {
      // Calculate date range - use same logic as fetchDailyPerformance
      let startDate: Date;
      let endDate: Date;
      
      if (dateRange === 'month') {
        startDate = new Date();
        startDate.setDate(1); // First day of current month
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'today') {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      } else {
      const daysAgo = daysMap[dateRange] || 30;
        startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      }

      // Fetch agent profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', selectedAgent)
        .single();

      if (!profile) return;

      // Fetch ALL call activities using pagination (same as fetchDailyPerformance)
      let agentCallsData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      let fetchError: any = null;

      while (hasMore) {
        const pageQuery = supabase
        .from('call_activities')
        .select('*')
        .eq('user_id', selectedAgent)
        .gte('start_time', startDate.toISOString())
          .lte('start_time', endDate.toISOString())
          .range(from, from + pageSize - 1)
          .order('start_time', { ascending: false });

        const { data: pageData, error: pageError } = await pageQuery;
        
        if (pageError) {
          console.error('[Performance] Error fetching agent calls page:', pageError);
          fetchError = pageError;
          break;
        }
        
        if (pageData && pageData.length > 0) {
          agentCallsData = [...agentCallsData, ...pageData];
          from += pageSize;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      if (fetchError) {
        console.error('Error fetching agent performance:', fetchError);
        toast.error('Failed to load agent performance');
        return;
      }

      // Filter by date range to ensure accuracy
      const finalAgentCalls = agentCallsData.filter((call: any) => {
        if (!call.start_time && !call.created_at) return false;
        const callDate = new Date(call.start_time || call.created_at);
        return callDate >= startDate && callDate <= endDate;
      });

      // Apply deduplication to ALL calls first: one phone number = one call count
      // This matches the team view logic exactly
      const deduplicatedAllAgentCalls = deduplicateAllCalls(finalAgentCalls);
      
      // Separate deduplicated calls into connected and all attempts
      // Connected calls = calls that actually rang and were answered (duration > 0 OR status is converted)
      const allAgentCallAttempts = deduplicatedAllAgentCalls; // All deduplicated call attempts (one per phone number)
      const connectedAgentCalls = deduplicatedAllAgentCalls.filter((call: any) => {
        // Converted calls are always connects
        if (call.status === 'converted') return true;
        // Connected calls must have duration > 0 to count as actually answered
        if (call.status === 'connected') {
          return (Number(call.duration_seconds) || 0) > 0;
        }
        return false;
      });

      // Connected calls are already deduplicated
      const deduplicatedConnectedAgentCalls = connectedAgentCalls;

      console.log('[Performance] Agent Performance Calculation:', {
        agentId: selectedAgent,
        originalCalls: finalAgentCalls.length,
        deduplicatedAllCalls: deduplicatedAllAgentCalls.length,
        allAgentCallAttempts: allAgentCallAttempts.length,
        connectedAgentCalls: connectedAgentCalls.length,
        deduplicatedConnectedAgentCalls: deduplicatedConnectedAgentCalls.length,
        removedByDedup: finalAgentCalls.length - deduplicatedAllAgentCalls.length,
        dateRange
      });

      // Calculate metrics using deduplicated calls
      const totalCalls = allAgentCallAttempts.length; // All deduplicated call attempts (one per phone number)
      const connects = deduplicatedConnectedAgentCalls.length; // Deduplicated connected calls
      const conversions = deduplicatedConnectedAgentCalls.filter((c: any) => c.status === 'converted').length;
      const revenue = deduplicatedConnectedAgentCalls.reduce((sum: number, c: any) => sum + (Number(c.deposit_amount) || 0), 0);
      const connectRate = totalCalls > 0 ? ((connects / totalCalls) * 100) : 0;
      const conversionRate = connects > 0 ? ((conversions / connects) * 100) : 0;

      setAgentPerformance({
        agentId: profile.id,
        agentName: profile.full_name || profile.email || 'Unknown',
        email: profile.email || '',
        calls: totalCalls,
        connects,
        conversions,
        revenue,
        connectRate,
        conversionRate
      });
    } catch (error) {
      console.error('Error fetching agent performance:', error);
      toast.error('Failed to load agent performance');
    }
  };

  const fetchDailyPerformance = async () => {
    try {
      // Reset metrics while loading to show that data is refreshing
      setTeamMetrics({
        totalCalls: 0,
        connects: 0,
        conversions: 0,
        totalRevenue: 0,
        connectRate: 0,
        conversionRate: 0,
      });
      setDailyPerformanceData([]);

      // Handle date ranges - calculate dates correctly for each range type
      let startDate: Date;
      let endDate: Date;
      
      if (dateRange === 'month') {
        // From the 1st of current month to today
        startDate = new Date();
        startDate.setDate(1); // First day of current month
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        console.log('[Performance] fetchDailyPerformance called - dateRange: month (from start of month)');
      } else if (dateRange === 'today') {
        // For "today", get start and end of today
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Start of today
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999); // End of today
        console.log('[Performance] fetchDailyPerformance called - dateRange: today');
      } else {
      const daysAgo = daysMap[dateRange] || 30;
        console.log('[Performance] fetchDailyPerformance called - dateRange:', dateRange, 'daysAgo:', daysAgo);
        startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0); // Start of day
        endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // End of today
      }
      
      // Ensure dates are valid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('[Performance] Invalid date range calculated:', { dateRange, startDate, endDate });
        toast.error('Invalid date range');
        return;
      }
      
      console.log('[Performance] Date range calculated - startDate:', startDate.toISOString(), 'endDate:', endDate.toISOString());
      console.log('[Performance] Date range in local time - startDate:', startDate.toLocaleString(), 'endDate:', endDate.toLocaleString());

      // Determine user IDs to filter by (for manager filtering)
      let userIds: string[] | null = null;
      if (selectedAgent !== 'all') {
        userIds = [selectedAgent];
      } else if (isManagement && user) {
        // For managers (including admin-managers), get their team's data - same logic as ManagementDashboard
        // This ensures managers only see their assigned agents' data, matching ManagementDashboard behavior
        const { data: teamAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);
        
        if (teamAgents && teamAgents.length > 0) {
          userIds = teamAgents.map(a => a.id);
        } else {
          // No team agents, return empty data
          setDailyPerformanceData([]);
          setTeamMetrics({
            totalCalls: 0,
            connects: 0,
            conversions: 0,
            totalRevenue: 0,
            connectRate: 0,
            conversionRate: 0,
          });
          return;
        }
      }
      // Note: If not a manager and not selecting a specific agent, fetch all calls (admin-only scenario)
      
      // Fetch ALL records using pagination to bypass Supabase's 1000 row limit
      let allTeamCalls: any[] = [];
      let from = 0;
      const pageSize = 1000; // Supabase's default limit per request
      let hasMore = true;
      let fetchError: any = null;

      console.log('[Performance] Starting paginated fetch for dateRange:', dateRange, 'userIds:', userIds?.length || 'all');

      while (hasMore) {
        // Build a fresh query for each page to avoid query builder state issues
        let pageQuery = supabase
          .from('call_activities')
          .select('*')
          .gte('start_time', startDate.toISOString())
          .lte('start_time', endDate.toISOString())
          .range(from, from + pageSize - 1)
          .order('start_time', { ascending: false });

        if (userIds) {
          pageQuery = pageQuery.in('user_id', userIds);
        }

        const { data: pageData, error: pageError } = await pageQuery;
        
        if (pageError) {
          console.error('[Performance] Error fetching calls page:', pageError);
          fetchError = pageError;
          break;
        }
        
        if (pageData && pageData.length > 0) {
          allTeamCalls = [...allTeamCalls, ...pageData];
          const pageNum = Math.floor(from / pageSize) + 1;
          console.log(`[Performance] Fetched page ${pageNum} with ${pageData.length} calls. Total so far: ${allTeamCalls.length}`);
          from += pageSize;
          hasMore = pageData.length === pageSize; // If we got a full page, there might be more
        } else {
          hasMore = false;
        }
      }

      const calls = allTeamCalls;
      const error = fetchError;

      if (error) {
        console.error('Error fetching daily performance:', error);
        toast.error('Failed to load performance data');
        return;
      }

      // CRITICAL: Filter all calls by date range to ensure accuracy
      // The database query should already filter, but we double-check here to ensure accuracy
      const finalFilteredCalls = calls.filter((call: any) => {
        if (!call.start_time && !call.created_at) return false;
        
        const callDate = new Date(call.start_time || call.created_at);
        
        // Ensure call is within the date range (inclusive)
        const isWithinRange = callDate >= startDate && callDate <= endDate;
        
        return isWithinRange;
      });
      
      console.log('[Performance] Final call count after date filtering:', finalFilteredCalls.length, 'out of', calls.length, 'total fetched');
      console.log('[Performance] Date range:', dateRange, 'startDate:', startDate.toISOString(), 'endDate:', endDate.toISOString());
      
      // Use the filtered calls
      const finalCalls = finalFilteredCalls;

      // Debug log to verify we're getting all calls
      console.log('[Performance] Fetched calls count:', finalCalls?.length || 0, 'for dateRange:', dateRange, 'selectedAgent:', selectedAgent);

      if (!finalCalls || finalCalls.length === 0) {
        setDailyPerformanceData([]);
        setTeamMetrics({
          totalCalls: 0,
          connects: 0,
          conversions: 0,
          totalRevenue: 0,
          connectRate: 0,
          conversionRate: 0,
        });
        return;
      }

      // Group by date using start_time
      const dailyMap = new Map<string, { calls: number; connects: number; conversions: number; revenue: number }>();
      
      // IMPORTANT: Filter finalCalls by assigned agents FIRST (before any other filtering)
      // This ensures all metrics are calculated from the same filtered dataset
      let filteredFinalCalls = finalCalls;
      if (isManagement && !isAdmin && user && userIds) {
        filteredFinalCalls = finalCalls.filter((call: any) => 
          userIds.includes(call.user_id)
        );
        console.log('[Performance] Filtered by assigned agents:', {
          before: finalCalls.length,
          after: filteredFinalCalls.length,
          userIds: userIds.length
        });
      }

      // Apply deduplication to ALL calls first: one phone number = one call count per agent
      // This ensures that if an agent calls the same number multiple times, it only counts as one call
      const deduplicatedAllCalls = deduplicateAllCalls(finalCalls);
      
      // Separate deduplicated calls into connected and all attempts
      // ALL calls = deduplicated attempts (one per phone number per agent)
      // Connected calls = calls that actually rang and were answered (duration > 0 OR status is converted)
      // A call is considered "connected" if:
      // 1. Status is 'converted' (definitely answered)
      // 2. Status is 'connected' AND duration_seconds > 0 (actually rang and was answered)
      // This excludes calls that were attempted but never rang (no_answer, busy, voicemail, disconnected with duration 0)
      const allTeamCallAttempts = deduplicatedAllCalls; // All deduplicated call attempts
      const connectedCalls = deduplicatedAllCalls.filter((call: any) => {
        // Converted calls are always connects
        if (call.status === 'converted') return true;
        // Connected calls must have duration > 0 to count as actually answered
        if (call.status === 'connected') {
          return (Number(call.duration_seconds) || 0) > 0;
        }
        return false;
      });

      // Connected calls are already deduplicated, so we can use them directly
      const deduplicatedConnectedCalls = connectedCalls;
      
      console.log('[Performance] Call filtering:', {
        originalCalls: finalCalls.length,
        deduplicatedAllCalls: deduplicatedAllCalls.length,
        allTeamCallAttempts: allTeamCallAttempts.length,
        connectedCalls: connectedCalls.length,
        removedByDedup: finalCalls.length - deduplicatedAllCalls.length
      });

      // Build daily map from ALL calls (for accurate total calls count)
      // But track connects separately from deduplicated connected calls
      // Create a Set of deduplicated connected call IDs for fast lookup
      const deduplicatedConnectedCallIds = new Set(deduplicatedConnectedCalls.map((c: any) => c.id));
      
      allTeamCallAttempts.forEach((call: any) => {
        // Use start_time for date grouping, format as "Jan 2" style
        const callDate = new Date(call.start_time || call.created_at);
        const date = callDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          timeZone: 'UTC'
        });
        const existing = dailyMap.get(date) || { calls: 0, connects: 0, conversions: 0, revenue: 0 };
        existing.calls++; // Count ALL deduplicated call attempts (one per phone number per agent)
        
        // Check if this call actually rang and was answered
        // Count as connect if: converted OR (connected AND duration > 0)
        const isConnected = call.status === 'converted' || 
          (call.status === 'connected' && (Number(call.duration_seconds) || 0) > 0);
        
        if (isConnected) {
          existing.connects++; // Count connected calls (already deduplicated)
        if (call.status === 'converted') {
          existing.conversions++;
          existing.revenue += Number(call.deposit_amount) || 0;
          }
        }
        dailyMap.set(date, existing);
      });

      // Convert map to array and sort by date
      const dailyData = Array.from(dailyMap.entries())
        .map(([dateStr, data]) => {
          // Parse the date string (e.g., "Jan 2") to get a proper date for sorting
          const [month, day] = dateStr.split(' ');
          const monthMap: Record<string, number> = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const currentYear = new Date().getFullYear();
          const dateObj = new Date(currentYear, monthMap[month] || 0, parseInt(day) || 1);
          
          return {
            date: dateStr,
            dateObj, // For sorting
            calls: data.calls,
            connects: data.connects,
            conversions: data.conversions,
            revenue: data.revenue,
            connectRate: data.calls > 0 ? ((data.connects / data.calls) * 100).toFixed(1) : '0',
            conversionRate: data.connects > 0 ? ((data.conversions / data.connects) * 100).toFixed(1) : '0'
          };
        })
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

      // Calculate team metrics from FULL data (before filtering for display)
      // This ensures accurate totals regardless of how many days are shown in the chart
      // IMPORTANT: dailyData is now built from callsForDailyData which is filtered by assigned agents
      const totalCalls = dailyData.reduce((sum, day) => sum + day.calls, 0);
      const totalConnects = dailyData.reduce((sum, day) => sum + day.connects, 0);
      const totalConversions = dailyData.reduce((sum, day) => sum + day.conversions, 0);
      const totalRevenue = dailyData.reduce((sum, day) => sum + day.revenue, 0);
      
      console.log('[Performance] Team Metrics Calculation:', {
        totalCalls,
        totalConnects,
        totalConversions,
        totalRevenue,
        connectRate: totalCalls > 0 ? (totalConnects / totalCalls) * 100 : 0,
        conversionRate: totalConnects > 0 ? (totalConversions / totalConnects) * 100 : 0,
        allTeamCallAttemptsCount: allTeamCallAttempts.length,
        connectedCallsCount: connectedCalls.length,
        deduplicatedConnectedCallsCount: deduplicatedConnectedCalls.length
      });
      
      setTeamMetrics({
        totalCalls,
        connects: totalConnects,
        conversions: totalConversions,
        totalRevenue,
        connectRate: totalCalls > 0 ? (totalConnects / totalCalls) * 100 : 0,
        conversionRate: totalConnects > 0 ? (totalConversions / totalConnects) * 100 : 0,
      });

      // Build verification data using deduplicated calls
      if (deduplicatedAllCalls.length > 0) {
        // Get agent names for verification
        // Only get agents that are actually assigned to this manager (if manager)
        const agentIds = [...new Set(deduplicatedAllCalls.map((c: any) => c.user_id))];
        let agentProfilesQuery = supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', agentIds);
        
        // If manager, filter to only show agents assigned to them
        if (isManagement && !isAdmin && user) {
          agentProfilesQuery = agentProfilesQuery.eq('manager_id', user.id);
        }
        
        const { data: agentProfiles } = await agentProfilesQuery;

        const agentMap = new Map(agentProfiles?.map((p: any) => [p.id, p.full_name || p.email || 'Unknown']) || []);

        // Agent breakdown - count ALL deduplicated call attempts (one per phone number per agent)
        // This matches the Total Calls calculation which uses deduplicated calls
        // IMPORTANT: Only count agents that are assigned to this manager (filtered in agentProfiles query above)
        const agentBreakdownMap = new Map<string, number>();
        
        // Only count calls from agents that are assigned to this manager
        const assignedAgentIds = new Set(agentProfiles?.map((p: any) => p.id) || []);
        
        // Count ALL deduplicated call attempts (matching the Total Calls calculation)
        deduplicatedAllCalls.forEach((call: any) => {
          // Only count if agent is assigned to manager (or if admin, count all)
          if (isAdmin || !isManagement || assignedAgentIds.has(call.user_id)) {
            const count = agentBreakdownMap.get(call.user_id) || 0;
            agentBreakdownMap.set(call.user_id, count + 1);
          }
        });

        const agentBreakdown = Array.from(agentBreakdownMap.entries())
          .map(([agentId, callCount]) => ({
            agentId,
            agentName: agentMap.get(agentId) || 'Unknown',
            callCount,
          }))
          .sort((a, b) => b.callCount - a.callCount);

        // Hourly breakdown - count ALL deduplicated call attempts by hour (to match Total Calls metric)
        const hourlyBreakdownMap = new Map<string, number>();
        deduplicatedAllCalls.forEach((call: any) => {
          // Only count if agent is assigned to manager (or if admin, count all)
          if (isAdmin || !isManagement || assignedAgentIds.has(call.user_id)) {
            const callDate = new Date(call.start_time || call.created_at);
            const hour = callDate.toLocaleString('en-US', { 
              hour: '2-digit', 
              hour12: false,
              timeZone: 'Africa/Kampala'
            });
            const count = hourlyBreakdownMap.get(hour) || 0;
            hourlyBreakdownMap.set(hour, count + 1);
          }
        });

        const hourlyBreakdown = Array.from(hourlyBreakdownMap.entries())
          .map(([hour, callCount]) => ({ hour, callCount }))
          .sort((a, b) => a.hour.localeCompare(b.hour));

        // Sample calls (first 10) - show ALL deduplicated calls from assigned agents (to match Total Calls)
        const filteredSampleCalls = deduplicatedAllCalls.filter((call: any) => 
          isAdmin || !isManagement || assignedAgentIds.has(call.user_id)
        );
        const sampleCalls = filteredSampleCalls.slice(0, 10).map((call: any) => ({
          id: call.id,
          agentName: agentMap.get(call.user_id) || 'Unknown',
          phone: call.phone_number || 'N/A',
          startTime: new Date(call.start_time || call.created_at).toLocaleString('en-US', {
            timeZone: 'Africa/Kampala',
            dateStyle: 'short',
            timeStyle: 'medium'
          }),
          status: call.status || 'unknown',
        }));

        setVerificationData({
          agentBreakdown,
          hourlyBreakdown,
          sampleCalls,
          dateRange: {
            start: startDate.toLocaleString('en-US', { timeZone: 'Africa/Kampala', dateStyle: 'short', timeStyle: 'medium' }),
            end: endDate.toLocaleString('en-US', { timeZone: 'Africa/Kampala', dateStyle: 'short', timeStyle: 'medium' }),
          },
          totalAgents: agentProfiles?.length || 0, // Count only agents assigned to manager (filtered above)
        });
      } else {
        setVerificationData(null);
      }
      
      // Filter to only show data within the selected date range (last N days) for chart display
      const daysToShow = daysMap[dateRange] || 30;
      const filteredData = dailyData.slice(-daysToShow);
      
      // Remove dateObj before setting state
      const finalData = filteredData.map(({ dateObj, ...rest }) => rest);
      
      setDailyPerformanceData(finalData);
    } catch (error) {
      console.error('Error fetching daily performance:', error);
    }
  };

  const fetchTeamAgentsData = async () => {
    if (!isManagement && !isAdmin) return;

    try {
      const daysAgo = daysMap[dateRange] || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      let query = supabase
        .from('profiles')
        .select('id, full_name, email, manager_id')
        .eq('approved', true);

      if (isManagement && !isAdmin && user) {
        query = query.eq('manager_id', user.id);
      }

      const { data: profiles, error: profilesError } = await query;

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      if (!profiles || profiles.length === 0) {
        setTeamAgentsData([]);
        return;
      }

      const agentsData = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          const { data: calls, error: callsError } = await supabase
            .from('call_activities')
            .select('*')
            .eq('user_id', profile.id)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString());

          if (callsError) {
            console.error(`Error fetching calls for agent ${profile.id}:`, callsError);
            return null;
          }

          const totalCalls = calls?.length || 0;
          const connects = calls?.filter((c: any) => c.status === 'connected' || c.status === 'converted').length || 0;
          const conversions = calls?.filter((c: any) => c.status === 'converted').length || 0;
          const revenue = calls?.reduce((sum: number, c: any) => sum + (Number(c.deposit_amount) || 0), 0) || 0;
          const connectRate = totalCalls > 0 ? ((connects / totalCalls) * 100) : 0;
          const conversionRate = connects > 0 ? ((conversions / connects) * 100) : 0;

          return {
            id: profile.id,
            name: profile.full_name || profile.email || 'Unknown',
            email: profile.email || '',
            calls: totalCalls,
            connects,
            conversions,
            revenue,
            connectRate: parseFloat(connectRate.toFixed(1)),
            conversionRate: parseFloat(conversionRate.toFixed(1))
          };
        })
      );

      // Filter out null results and sort
      const validAgentsData = agentsData.filter((a): a is NonNullable<typeof a> => a !== null);
      setTeamAgentsData(validAgentsData.sort((a, b) => b.calls - a.calls));
    } catch (error) {
      console.error('Error fetching team agents data:', error);
    }
  };

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
            <p className="text-muted-foreground">Team performance with AI insights</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="space-y-2">
            <Label htmlFor="date-range">Date Range</Label>
            <Select 
              value={dateRange} 
              onValueChange={(value) => {
                console.log('[Performance] Date range changed from', dateRange, 'to', value);
                setDateRange(value);
              }}
            >
              <SelectTrigger id="date-range" className="w-40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign</Label>
            <Select value={campaignId || "all"} onValueChange={(v) => setCampaignId(v === "all" ? undefined : v)}>
              <SelectTrigger id="campaign" className="w-56 bg-background">
                <SelectValue placeholder="All Campaigns" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent Selector for Managers/Admins */}
          {(isManagement || isAdmin) && (
            <div className="space-y-2">
              <Label htmlFor="agent-select">Agent</Label>
              <Select 
                value={selectedAgent} 
                onValueChange={setSelectedAgent}
                disabled={loadingAgents}
              >
                <SelectTrigger id="agent-select" className="w-56 bg-background">
                  <SelectValue placeholder={loadingAgents ? "Loading agents..." : "All Agents"} />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Agents (Team View)</SelectItem>
                  {availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} {agent.email ? `(${agent.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Agent Performance Table (when specific agent selected) */}
        {selectedAgent !== 'all' && agentPerformance && (
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance: {agentPerformance.agentName}</CardTitle>
              <p className="text-sm text-muted-foreground">{agentPerformance.email}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-2xl font-bold">{agentPerformance.calls}</div>
                  <div className="text-xs text-muted-foreground">Total Calls</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{agentPerformance.connects}</div>
                  <div className="text-xs text-muted-foreground">Connects</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{agentPerformance.conversions}</div>
                  <div className="text-xs text-muted-foreground">Conversions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatUGX(agentPerformance.revenue)}</div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-lg font-semibold">{agentPerformance.connectRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Connect Rate (Target: 70%)</div>
                  <div className="mt-1">
                    {agentPerformance.connectRate >= 70 ? (
                      <Badge variant="default" className="bg-green-500">✓ On Target</Badge>
                    ) : agentPerformance.connectRate >= 50 ? (
                      <Badge variant="secondary">⚠ Below Target</Badge>
                    ) : (
                      <Badge variant="destructive">⚠ Needs Improvement</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{agentPerformance.conversionRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Conversion Rate (Target: 25%)</div>
                  <div className="mt-1">
                    {agentPerformance.conversionRate >= 25 ? (
                      <Badge variant="default" className="bg-green-500">✓ On Target</Badge>
                    ) : agentPerformance.conversionRate >= 15 ? (
                      <Badge variant="secondary">⚠ Below Target</Badge>
                    ) : (
                      <Badge variant="destructive">⚠ Needs Improvement</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <Phone className="h-4 w-4 text-primary mb-2" />
              <div className="text-2xl font-bold">
                {selectedAgent !== 'all' && agentPerformance 
                  ? agentPerformance.calls 
                  : teamMetrics.totalCalls}
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedAgent !== 'all' ? 'Agent Calls' : 'Total Calls'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Users className="h-4 w-4 text-blue-500 mb-2" />
              <div className="text-2xl font-bold">
                {selectedAgent !== 'all' && agentPerformance 
                  ? agentPerformance.connectRate.toFixed(1) 
                  : teamMetrics.connectRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Connect Rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Target className="h-4 w-4 text-green-500 mb-2" />
              <div className="text-2xl font-bold">
                {selectedAgent !== 'all' && agentPerformance 
                  ? agentPerformance.conversionRate.toFixed(1) 
                  : teamMetrics.conversionRate.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">Conversion Rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <DollarSign className="h-4 w-4 text-amber-500 mb-2" />
              <div className="text-2xl font-bold">
                {formatUGX(
                  selectedAgent !== 'all' && agentPerformance 
                    ? agentPerformance.revenue 
                    : teamMetrics.totalRevenue
                )}
              </div>
              <div className="text-xs text-muted-foreground">Revenue</div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Panel */}
        {verificationData && (
          <Card className="border-2 border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Data Verification
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVerification(!showVerification)}
                >
                  {showVerification ? 'Hide' : 'Show'} Details
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Verify that {teamMetrics.totalCalls.toLocaleString()} calls are from {verificationData.totalAgents} agent(s) between {verificationData.dateRange.start} and {verificationData.dateRange.end}
              </p>
            </CardHeader>
            {showVerification && (
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Agent Breakdown */}
                  <div>
                    <h4 className="font-semibold mb-2">Calls by Agent</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {verificationData.agentBreakdown.map((agent) => (
                        <div key={agent.agentId} className="flex justify-between text-sm border-b pb-1">
                          <span className="truncate">{agent.agentName}</span>
                          <span className="font-mono ml-2">{agent.callCount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hourly Breakdown */}
                  <div>
                    <h4 className="font-semibold mb-2">Calls by Hour (EAT)</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {verificationData.hourlyBreakdown.map((hour) => (
                        <div key={hour.hour} className="flex justify-between text-sm border-b pb-1">
                          <span>{hour.hour}:00</span>
                          <span className="font-mono ml-2">{hour.callCount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sample Calls */}
                <div>
                  <h4 className="font-semibold mb-2">Sample Call Records (First 10)</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                    {verificationData.sampleCalls.map((call) => (
                      <div key={call.id} className="flex justify-between border-b pb-1">
                        <div className="flex-1">
                          <span className="font-medium">{call.agentName}</span> • {call.phone} • {call.status}
                        </div>
                        <span className="text-muted-foreground ml-2">{call.startTime}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Performance Analytics Section */}
        <Tabs defaultValue="charts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="charts">Charts & Trends</TabsTrigger>
            <TabsTrigger value="table">Performance Table</TabsTrigger>
            <TabsTrigger value="ai">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-4">
            {/* Daily Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Performance Trends</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {selectedAgent !== 'all' ? 'Agent performance over time' : 'Team performance over time'}
                </p>
              </CardHeader>
              <CardContent>
                {dailyPerformanceData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No performance data available for the selected period
                  </div>
                ) : (
                  <ChartContainer
                    config={{
                      calls: { label: "Calls", color: "hsl(221 83% 53%)" },
                      connects: { label: "Connects", color: "hsl(142 71% 45%)" },
                      conversions: { label: "Conversions", color: "hsl(38 92% 50%)" },
                    }}
                    className="h-[300px]"
                  >
                    <LineChart data={dailyPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => [value, '']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="calls" 
                        stroke="var(--color-calls)" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Calls"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="connects" 
                        stroke="var(--color-connects)" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Connects"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="conversions" 
                        stroke="var(--color-conversions)" 
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Conversions"
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Performance Metrics Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Daily breakdown for selected period ({dateRange})
                  </p>
                </CardHeader>
                <CardContent>
                  {dailyPerformanceData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data available</div>
                  ) : (
                    <ChartContainer
                      config={{
                        calls: { label: "Calls", color: "hsl(221 83% 53%)" },
                        connects: { label: "Connects", color: "hsl(142 71% 45%)" },
                        conversions: { label: "Conversions", color: "hsl(38 92% 50%)" },
                      }}
                      className="h-[250px]"
                    >
                      <BarChart data={dailyPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          formatter={(value: any) => [value, '']}
                        />
                        <Legend />
                        <Bar dataKey="calls" fill="var(--color-calls)" name="Calls" />
                        <Bar dataKey="connects" fill="var(--color-connects)" name="Connects" />
                        <Bar dataKey="conversions" fill="var(--color-conversions)" name="Conversions" />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAgent !== 'all' && agentPerformance ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Calls</span>
                        <span className="font-bold">{agentPerformance.calls}</span>
                      </div>
                      <Progress value={100} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connects</span>
                        <span className="font-bold">{agentPerformance.connects}</span>
                      </div>
                      <Progress value={(agentPerformance.connects / agentPerformance.calls) * 100} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Conversions</span>
                        <span className="font-bold">{agentPerformance.conversions}</span>
                      </div>
                      <Progress value={(agentPerformance.conversions / agentPerformance.calls) * 100} className="h-2" />
                      
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span>Connect Rate</span>
                          <span className="font-semibold">{agentPerformance.connectRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span>Conversion Rate</span>
                          <span className="font-semibold">{agentPerformance.conversionRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Total Calls</span>
                        <span className="font-bold">{teamMetrics.totalCalls}</span>
                      </div>
                      <Progress value={100} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connects</span>
                        <span className="font-bold">{teamMetrics.connects || 0}</span>
                      </div>
                      <Progress value={teamMetrics.connectRate} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Conversions</span>
                        <span className="font-bold">{teamMetrics.conversions || 0}</span>
                      </div>
                      <Progress value={teamMetrics.conversionRate} className="h-2" />
                      
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span>Connect Rate</span>
                          <span className="font-semibold">{teamMetrics.connectRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span>Conversion Rate</span>
                          <span className="font-semibold">{teamMetrics.conversionRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="table" className="space-y-4">
            {/* Team Performance Table */}
            {selectedAgent === 'all' && (isManagement || isAdmin) && (
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance Comparison</CardTitle>
                  <p className="text-sm text-muted-foreground">Compare all agents in your team</p>
                </CardHeader>
                <CardContent>
                  {teamAgentsData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No team data available</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Agent</TableHead>
                            <TableHead className="text-right">Calls</TableHead>
                            <TableHead className="text-right">Connects</TableHead>
                            <TableHead className="text-right">Conversions</TableHead>
                            <TableHead className="text-right">Connect Rate</TableHead>
                            <TableHead className="text-right">Conversion Rate</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamAgentsData.map((agent) => (
                            <TableRow key={agent.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{agent.name}</div>
                                  <div className="text-xs text-muted-foreground">{agent.email}</div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{agent.calls}</TableCell>
                              <TableCell className="text-right">{agent.connects}</TableCell>
                              <TableCell className="text-right">{agent.conversions}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{agent.connectRate}%</span>
                                  {agent.connectRate >= 70 ? (
                                    <Badge variant="default" className="bg-green-500 text-xs">✓</Badge>
                                  ) : agent.connectRate >= 50 ? (
                                    <Badge variant="secondary" className="text-xs">⚠</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs">⚠</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span>{agent.conversionRate}%</span>
                                  {agent.conversionRate >= 25 ? (
                                    <Badge variant="default" className="bg-green-500 text-xs">✓</Badge>
                                  ) : agent.conversionRate >= 15 ? (
                                    <Badge variant="secondary" className="text-xs">⚠</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs">⚠</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatUGX(agent.revenue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Daily Performance Table */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Performance Breakdown</CardTitle>
                <p className="text-sm text-muted-foreground">Detailed daily metrics</p>
              </CardHeader>
              <CardContent>
                {dailyPerformanceData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No daily data available</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Calls</TableHead>
                          <TableHead className="text-right">Connects</TableHead>
                          <TableHead className="text-right">Conversions</TableHead>
                          <TableHead className="text-right">Connect Rate</TableHead>
                          <TableHead className="text-right">Conversion Rate</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyPerformanceData.map((day, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{day.date}</TableCell>
                            <TableCell className="text-right">{day.calls}</TableCell>
                            <TableCell className="text-right">{day.connects}</TableCell>
                            <TableCell className="text-right">{day.conversions}</TableCell>
                            <TableCell className="text-right">{day.connectRate}%</TableCell>
                            <TableCell className="text-right">{day.conversionRate}%</TableCell>
                            <TableCell className="text-right">{formatUGX(day.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  AI Insights
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-powered analysis of team performance and improvement opportunities
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {insightsLoading ? (
                  <div className="text-center py-8">
                    <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
                    <p className="text-sm text-muted-foreground">Analyzing performance data with AI...</p>
                  </div>
                ) : (insights && insights.length > 0) || (agentInsights && agentInsights.length > 0) ? (
                  <>
                    {insights?.map((i, idx) => (
                      <div key={`funnel-${idx}`} className="border-l-4 border-primary pl-4 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={i.type === 'opportunity' ? 'default' : i.type === 'warning' ? 'destructive' : 'secondary'}>
                            {i.impact}
                          </Badge>
                          <span className="font-medium">{i.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{i.description}</p>
                      </div>
                    ))}
                    {agentInsights?.map((insight, idx) => (
                      <div key={`agent-${idx}`} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">{insight}</p>
                        </div>
                      </div>
                    ))}
                  </>
                ) : message ? (
                  <div className="text-center py-8">
                    <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{message}</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No insights available. Continue making calls to generate AI-powered insights.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ExportReportModal 
          open={exportOpen} 
          onOpenChange={setExportOpen}
          dateRange={dateRange}
          selectedAgent={selectedAgent}
        />
      </div>
    </ManagementLayout>
  );
}
