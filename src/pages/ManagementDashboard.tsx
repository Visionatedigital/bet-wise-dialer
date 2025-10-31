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
  connects: number;
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

  const { funnelData, insights, message: funnelMessage, loading: funnelLoading } = useFunnelAnalysis(dateRange, '');
  const { agents: topAgents, insights: agentInsights, loading: agentsLoading, message: agentsMessage } = useAgentAnalysis(dateRange);

  useEffect(() => {
    fetchAgentStats();
  }, [dateRange, selectedAgent]);

  const fetchAgentStats = async () => {
    try {
      setLoading(true);

      // Calculate date filter
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

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
            .gte('created_at', startDate.toISOString());

          const { data: calls } = await query;

          const totalCalls = calls?.length || 0;
          const connects = calls?.filter(c => c.status === 'connected' || c.status === 'converted').length || 0;
          const conversions = calls?.filter(c => c.status === 'converted').length || 0;
          const totalDeposits = calls?.reduce((sum, c) => sum + (Number(c.deposit_amount) || 0), 0) || 0;

          return {
            agentId: profile.id,
            agentName: profile.full_name || 'Unknown',
            email: profile.email || '',
            calls: totalCalls,
            connects,
            conversions,
            deposits: totalDeposits
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
      connects: acc.connects + agent.connects,
      conversions: acc.conversions + agent.conversions,
      deposits: acc.deposits + agent.deposits
    }),
    { calls: 0, connects: 0, conversions: 0, deposits: 0 }
  );

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Management Dashboard</h1>
            <p className="text-muted-foreground">Performance analytics and agent insights</p>
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
              <div className="text-2xl font-bold">{totals.calls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {funnelData ? `${funnelData.connectRate}% connect rate` : 'Loading...'}
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
                {funnelData ? `${funnelData.qualificationRate}% qualified` : 'Loading...'}
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
                {funnelData ? `${funnelData.conversionRate}% conversion rate` : 'Loading...'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatUGX(totals.deposits)}
              </div>
              <p className="text-xs text-muted-foreground">
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
