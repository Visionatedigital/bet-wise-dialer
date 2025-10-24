import React from "react";
import { ManagementLayout } from "@/components/layout/ManagementLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitorData } from "@/hooks/useMonitorData";
import { supabase } from "@/integrations/supabase/client";
import { PhoneCall, Pause, UserCheck, XCircle } from "lucide-react";

export default function ManagementMonitor() {
  const { agents, loading } = useMonitorData();
  const [timePeriod, setTimePeriod] = React.useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily');

  const getStatus = (status: string) => {
    switch (status) {
      case "on-call": return { icon: <PhoneCall className="h-3 w-3"/>, cls: "bg-green-500/10 text-green-600 border border-green-500/20" };
      case "online": return { icon: <UserCheck className="h-3 w-3"/>, cls: "bg-blue-500/10 text-blue-600 border border-blue-500/20" };
      case "break": return { icon: <Pause className="h-3 w-3"/>, cls: "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" };
      default: return { icon: <XCircle className="h-3 w-3"/>, cls: "bg-red-500/10 text-red-600 border border-red-500/20" };
    }
  };

  const periodStart = (period: 'daily' | 'weekly' | 'monthly' | 'all') => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'weekly') {
      const day = d.getDay();
      const diff = (day + 6) % 7; // Monday as start of week
      d.setDate(d.getDate() - diff);
    } else if (period === 'monthly') {
      d.setDate(1);
    }
    return d;
  };

  const [periodLeads, setPeriodLeads] = React.useState<Record<string, number>>({});
  const [periodCalls, setPeriodCalls] = React.useState<Record<string, number>>({});

  const getFilteredLeads = (agent: any, _period: string) => {
    return periodLeads[agent.id] ?? 0;
  };

  const getFilteredCalls = (agent: any, _period: string) => {
    return periodCalls[agent.id] ?? 0;
  };

  React.useEffect(() => {
    const fetchMetrics = async () => {
      const start = periodStart(timePeriod).toISOString();
      try {
        // Leads assigned per agent for the selected period
        const leadsQuery = supabase
          .from('leads')
          .select('user_id, assigned_at')
          .not('user_id', 'is', null);
        const { data: leadsData } = await (timePeriod === 'all'
          ? leadsQuery
          : leadsQuery.gte('assigned_at', start));

        const lMap: Record<string, number> = {};
        (leadsData || []).forEach((r: any) => {
          if (r.user_id) lMap[r.user_id] = (lMap[r.user_id] || 0) + 1;
        });
        setPeriodLeads(lMap);

        // Calls per agent for the selected period
        const callsQuery = supabase
          .from('call_activities')
          .select('user_id, start_time');
        const { data: callsData } = await (timePeriod === 'all'
          ? callsQuery
          : callsQuery.gte('start_time', start));

        const cMap: Record<string, number> = {};
        (callsData || []).forEach((r: any) => {
          if (r.user_id) cMap[r.user_id] = (cMap[r.user_id] || 0) + 1;
        });
        setPeriodCalls(cMap);
      } catch (e) {
        console.error('[Monitor] Failed to load period metrics', e);
      }
    };

    if (agents.length > 0) fetchMetrics();
  }, [timePeriod, agents]);
  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Monitoring</h1>
            <p className="text-muted-foreground">Live visibility into agent status</p>
          </div>
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as any)}>
            <SelectTrigger className="w-40 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="daily">Today</SelectItem>
              <SelectItem value="weekly">This Week</SelectItem>
              <SelectItem value="monthly">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-10"/><Skeleton className="h-4 w-2/3"/></CardContent></Card>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No active agents found</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(a => {
              const s = getStatus(a.status);
              return (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10"><AvatarFallback>{a.avatar}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium text-sm">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.campaign}</div>
                        </div>
                      </div>
                      <Badge className={s.cls}>
                        {s.icon}
                        <span className="ml-1 capitalize">{a.status.replace('-', ' ')}</span>
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Duration</div>
                        <div className="font-medium">{a.duration}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Assigned ({timePeriod === 'daily' ? 'Today' : timePeriod === 'weekly' ? 'Week' : timePeriod === 'monthly' ? 'Month' : 'All'})</div>
                        <div className="font-medium">{getFilteredLeads(a, timePeriod)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Calls ({timePeriod === 'daily' ? 'Today' : timePeriod === 'weekly' ? 'Week' : timePeriod === 'monthly' ? 'Month' : 'All'})</div>
                        <div className="font-medium">{getFilteredCalls(a, timePeriod)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}
