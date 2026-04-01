import { useState, useEffect } from "react";
import { api } from "@/integrations/supabase/client";

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

      const daysAgo = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const start = new Date();
      start.setDate(start.getDate() - daysAgo);
      const startDateStr = start.toISOString();
      
      const data = await api.get<SystemMetrics>(`/reports/admin?start_date=${startDateStr}`);

      setMetrics({
        totalUsers: data.totalUsers || 0,
        totalCalls: data.totalCalls || 0,
        totalCallsThisMonth: data.totalCallsThisMonth || 0,
        totalAgents: data.totalAgents || 0,
        activeAgents: data.activeAgents || 0,
        totalLeads: data.totalLeads || 0,
        leadsBySegment: data.leadsBySegment || { vip: 0, semiActive: 0, dormant: 0 },
        callsByStatus: data.callsByStatus || { connected: 0, converted: 0, failed: 0 }
      });
    } catch (error) {
      console.error('Error fetching admin metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, refetch: fetchMetrics };
}
