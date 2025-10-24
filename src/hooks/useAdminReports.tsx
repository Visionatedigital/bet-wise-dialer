import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfMonth } from "date-fns";

interface SystemMetrics {
  totalUsers: number;
  totalCalls: number;
  totalCallsThisMonth: number;
  totalAgents: number;
  activeAgents: number;
  totalLeads: number;
  leadsBySegment: {
    vip: number;
    semiActive: number;
    dormant: number;
  };
  callsByStatus: {
    connected: number;
    converted: number;
    failed: number;
  };
}

export function useAdminReports(dateRange: string = "30d") {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    totalCalls: 0,
    totalCallsThisMonth: 0,
    totalAgents: 0,
    activeAgents: 0,
    totalLeads: 0,
    leadsBySegment: { vip: 0, semiActive: 0, dormant: 0 },
    callsByStatus: { connected: 0, converted: 0, failed: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [dateRange]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Get date range
      const now = new Date();
      const daysAgo = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const startDate = subDays(now, daysAgo);
      const monthStart = startOfMonth(now);

      // Total users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Total agents (users with agent role)
      const { data: agentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'agent');

      const totalAgents = agentRoles?.length || 0;

      // Active agents (online)
      const agentIds = agentRoles?.map(r => r.user_id) || [];
      const { count: activeAgents } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('id', agentIds)
        .eq('status', 'online');

      // Total calls in date range
      const { count: totalCalls } = await supabase
        .from('call_activities')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', startDate.toISOString());

      // Total calls this month
      const { count: totalCallsThisMonth } = await supabase
        .from('call_activities')
        .select('*', { count: 'exact', head: true })
        .gte('start_time', monthStart.toISOString());

      // Calls by status
      const { data: callActivities } = await supabase
        .from('call_activities')
        .select('status')
        .gte('start_time', startDate.toISOString());

      const callsByStatus = {
        connected: callActivities?.filter(c => c.status === 'connected').length || 0,
        converted: callActivities?.filter(c => c.status === 'converted').length || 0,
        failed: callActivities?.filter(c => c.status === 'failed' || c.status === 'no-answer').length || 0
      };

      // Total leads
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

      // Leads by segment
      const { data: leads } = await supabase
        .from('leads')
        .select('segment');

      const leadsBySegment = {
        vip: leads?.filter(l => l.segment === 'vip').length || 0,
        semiActive: leads?.filter(l => l.segment === 'semi-active').length || 0,
        dormant: leads?.filter(l => l.segment === 'dormant').length || 0
      };

      setMetrics({
        totalUsers: totalUsers || 0,
        totalCalls: totalCalls || 0,
        totalCallsThisMonth: totalCallsThisMonth || 0,
        totalAgents,
        activeAgents: activeAgents || 0,
        totalLeads: totalLeads || 0,
        leadsBySegment,
        callsByStatus
      });
    } catch (error) {
      console.error('Error fetching admin metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, refetch: fetchMetrics };
}
