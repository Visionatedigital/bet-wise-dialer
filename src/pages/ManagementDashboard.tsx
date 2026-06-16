import { useState, useEffect } from "react";
import { ManagementLayout } from "@/components/layout/ManagementLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart3, TrendingUp, Phone, DollarSign, Download, CheckCircle, Lightbulb } from "lucide-react";
import { ExportReportModal } from "@/components/dashboard/ExportReportModal";
import { RecentCallActivities } from "@/components/dashboard/RecentCallActivities";
import { useFunnelAnalysis } from '@/hooks/useFunnelAnalysis';
import { useAgentAnalysis } from '@/hooks/useAgentAnalysis';
import { formatUGX } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';

interface AgentStats {
  agentId: string;
  agentName: string;
  email: string;
  calls: number;
  rawCalls: number;
  connects: number;
  qualified: number;
  conversions: number;
  deposits: number;
}

const ManagementDashboard = () => {
  const { user } = useAuth();
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("week");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [showExportModal, setShowExportModal] = useState(false);

  // Pass manager ID to ensure funnel analysis filters by assigned agents
  const { funnelData, insights, message: funnelMessage, loading: funnelLoading } = useFunnelAnalysis(dateRange, '', user?.id || null);
  const { agents: topAgents, insights: agentInsights, loading: agentsLoading, message: agentsMessage } = useAgentAnalysis(dateRange);

  useEffect(() => {
    fetchAgentStats();
  }, [dateRange, selectedAgent]);

  // Deduplication function: Groups calls by phone_number (since we're already filtering by agent)
  // If agent calls same number multiple times within 10 minutes, keep only one
  // Priority: converted > connected > longest duration > most recent
  const deduplicateCallsForAgent = (calls: any[]): any[] => {
    if (!calls || calls.length === 0) return [];
    
    // Group calls by phone_number (since we're already filtering by agent)
    const callGroups = new Map<string, any[]>();
    
    calls.forEach((call) => {
      const key = call.phone_number || 'unknown';
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

      // Sort by time
      group.sort((a, b) => {
        const timeA = new Date(a.start_time || a.created_at).getTime();
        const timeB = new Date(b.start_time || b.created_at).getTime();
        return timeA - timeB;
      });

      let lastKeptCall: any = null;
      
      group.forEach((call) => {
        const callTime = new Date(call.start_time || call.created_at).getTime();
        
        if (!lastKeptCall) {
          // First call in group - always keep
          lastKeptCall = call;
          deduplicated.push(call);
        } else {
          const lastKeptTime = new Date(lastKeptCall.start_time || lastKeptCall.created_at).getTime();
          const timeDiff = callTime - lastKeptTime;
          
          // If more than 10 minutes apart, keep this call
          if (timeDiff > DEDUP_WINDOW_MS) {
            lastKeptCall = call;
            deduplicated.push(call);
          } else {
            // Within 10 minutes - keep the "better" call based on priority
            // Priority: converted > connected > longer duration > more recent
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
              // Remove last kept call and add this one
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

  const fetchAgentStats = async () => {
    try {
      setLoading(true);

      // Calculate date filter - handle both numeric strings and named ranges
      const daysMap: Record<string, number> = {
        'today': 0,
        'week': 7,
        'month': 30,
        'quarter': 90,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      
      let daysAgo: number;
      if (daysMap[dateRange] !== undefined) {
        daysAgo = daysMap[dateRange];
      } else {
        const parsed = parseInt(dateRange);
        daysAgo = isNaN(parsed) ? 7 : parsed; // Default to 7 days if invalid
      }
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(0, 0, 0, 0); // Start of day - match Performance.tsx logic
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999); // End of today - match Performance.tsx logic
      
      // Validate the date before using it
      if (isNaN(startDate.getTime())) {
        console.error('[ManagementDashboard] Invalid date calculated from dateRange:', dateRange);
        toast.error('Invalid date range specified');
        return;
      }

      // Fetch agents assigned to this manager
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, manager_id')
        .eq('approved', true)
        .eq('manager_id', user?.id || '');

      if (!profiles || profiles.length === 0) {
        setAgentStats([]);
        return;
      }

      // Fetch call activities for each agent
      const agentStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          let query = supabase
            .from('call_activities')
            .select('*')
            .eq('user_id', profile.id)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString());
          
          // Apply range limit AFTER all filters to ensure we get ALL matching records
          query = query.range(0, 99999); // Fetch up to 100,000 records to include ALL calls

          const { data: calls } = await query;

          // Deduplicate ALL calls first: If agent calls same number multiple times within 10 minutes, count only once
          const deduplicatedAllCalls = deduplicateCallsForAgent(calls || []);
          
          // Total calls = all deduplicated call attempts (one per phone number)
          const totalCalls = deduplicatedAllCalls.length;
          
          // Connects = only calls that actually rang and were answered
          // A call is considered "connected" if:
          // 1. Status is 'converted' (definitely answered)
          // 2. Status is 'connected' AND duration_seconds > 0 (actually rang and was answered)
          const connects = deduplicatedAllCalls.filter(c => {
            if (c.status === 'converted') return true;
            if (c.status === 'connected') {
              return (Number(c.duration_seconds) || 0) > 0;
            }
            return false;
          }).length;
          const conversions = calls?.filter(c => c.status === 'converted').length || 0;
          // Qualified = connects that actually rang, were answered, and lasted more than 2 minutes
          const qualified = calls?.filter(c => {
            const isConnected = c.status === 'converted' || 
              (c.status === 'connected' && (Number(c.duration_seconds) || 0) > 0);
            return isConnected && (Number(c.duration_seconds) || 0) > 120;
          }).length || 0;
          const reportedDeposits = calls?.reduce((sum, c) => sum + (Number(c.deposit_amount) || 0), 0) || 0;

          return {
            agentId: profile.id,
            agentName: profile.full_name || 'Unknown',
            email: profile.email || '',
            calls: totalCalls,
            rawCalls: calls?.length || 0,
            connects,
            qualified,
            conversions,
            deposits: reportedDeposits
          };
        })
      );

      setAgentStats(agentStats);
    } catch (error) {
      console.error('Error fetching agent stats:', error);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = selectedAgent === "all"
    ? agentStats 
    : agentStats.filter(a => a.agentId === selectedAgent);

  const totals = filteredAgents.reduce(
    (acc, agent) => ({
      calls: acc.calls + agent.calls,
      rawCalls: acc.rawCalls + agent.rawCalls,
      connects: acc.connects + agent.connects,
      qualified: acc.qualified + (agent.qualified || 0),
      conversions: acc.conversions + agent.conversions,
      deposits: acc.deposits + agent.deposits
    }),
    { calls: 0, rawCalls: 0, connects: 0, qualified: 0, conversions: 0, deposits: 0 }
  );

  // Calculate rates from totals to ensure accuracy (connect rate calculated on raw call attempts to see true outreach efficiency)
  const connectRate = totals.rawCalls > 0 ? ((totals.connects / totals.rawCalls) * 100).toFixed(1) : '0.0';
  const qualificationRate = totals.connects > 0 ? ((totals.qualified / totals.connects) * 100).toFixed(1) : '0.0';
  const conversionRate = totals.qualified > 0 ? ((totals.conversions / totals.qualified) * 100).toFixed(1) : '0.0';

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manager Hub</h1>
            <p className="text-muted-foreground">Management Dashboard • Performance analytics and agent insights</p>
          </div>
          <Button onClick={() => setShowExportModal(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agentStats.map((agent) => (
                <SelectItem key={agent.agentId} value={agent.agentId}>
                  {agent.agentName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totals.rawCalls.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">({totals.calls.toLocaleString()} unique)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {connectRate}% connect rate (attempts)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connects</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.connects.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {qualificationRate}% qualified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.conversions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {conversionRate}% conversion rate
              </p>
            </CardContent>
          </Card>

          <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Reported Intent</CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-amber-600 border-amber-500/30">Unverified</Badge>
              </div>
              <DollarSign className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {formatUGX(totals.deposits)}
              </div>
              <p className="text-xs text-amber-600/70">
                Avg: {formatUGX(totals.conversions > 0 ? totals.deposits / totals.conversions : 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        {(insights && insights.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                AI Funnel Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.map((insight, idx) => (
                  <div key={idx} className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={
                        insight.type === 'opportunity' ? 'default' : 
                        insight.type === 'warning' ? 'destructive' : 
                        'secondary'
                      }>
                        {insight.impact}
                      </Badge>
                      <span className="font-medium">{insight.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Call Activities */}
        <RecentCallActivities 
          dateRange={dateRange}
          selectedAgent={selectedAgent}
        />
      </div>

      <ExportReportModal 
        open={showExportModal}
        onOpenChange={setShowExportModal}
        dateRange={dateRange}
        selectedAgent={selectedAgent}
      />
    </ManagementLayout>
  );
};

export default ManagementDashboard;
