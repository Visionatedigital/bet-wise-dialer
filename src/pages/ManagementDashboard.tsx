import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart3, TrendingUp, Phone, DollarSign, Download } from "lucide-react";
import { ExportReportModal } from "@/components/dashboard/ExportReportModal";

interface AgentStats {
  id: string;
  full_name: string;
  email: string;
  totalCalls: number;
  connects: number;
  conversions: number;
  totalDeposits: number;
}

const ManagementDashboard = () => {
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [showExportModal, setShowExportModal] = useState(false);

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

      // Fetch agents with agent role
      const { data: agentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'agent');

      const agentIds = agentRoles?.map(r => r.user_id) || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', agentIds)
        .eq('approved', true);

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
            id: profile.id,
            full_name: profile.full_name || 'Unknown',
            email: profile.email || '',
            totalCalls,
            connects,
            conversions,
            totalDeposits
          };
        })
      );

      setAgents(agentStats);
    } catch (error) {
      console.error('Error fetching agent stats:', error);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const filteredAgents = selectedAgent === "all" 
    ? agents 
    : agents.filter(a => a.id === selectedAgent);

  const totals = filteredAgents.reduce(
    (acc, agent) => ({
      calls: acc.calls + agent.totalCalls,
      connects: acc.connects + agent.connects,
      conversions: acc.conversions + agent.conversions,
      deposits: acc.deposits + agent.totalDeposits
    }),
    { calls: 0, connects: 0, conversions: 0, deposits: 0 }
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Management Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor team performance and analytics
            </p>
          </div>
          <Button onClick={() => setShowExportModal(true)}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.full_name}
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
              <div className="text-2xl font-bold">{totals.calls}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connects</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.connects}</div>
              <p className="text-xs text-muted-foreground">
                {totals.calls > 0 ? ((totals.connects / totals.calls) * 100).toFixed(1) : 0}% rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.conversions}</div>
              <p className="text-xs text-muted-foreground">
                {totals.connects > 0 ? ((totals.conversions / totals.connects) * 100).toFixed(1) : 0}% rate
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
                UGX {totals.deposits.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Connects</TableHead>
                  <TableHead className="text-right">Connect %</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Conv %</TableHead>
                  <TableHead className="text-right">Deposits (UGX)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agent.full_name}</div>
                        <div className="text-sm text-muted-foreground">{agent.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{agent.totalCalls}</TableCell>
                    <TableCell className="text-right">{agent.connects}</TableCell>
                    <TableCell className="text-right">
                      {agent.totalCalls > 0 
                        ? ((agent.connects / agent.totalCalls) * 100).toFixed(1) 
                        : 0}%
                    </TableCell>
                    <TableCell className="text-right">{agent.conversions}</TableCell>
                    <TableCell className="text-right">
                      {agent.connects > 0 
                        ? ((agent.conversions / agent.connects) * 100).toFixed(1) 
                        : 0}%
                    </TableCell>
                    <TableCell className="text-right">
                      {agent.totalDeposits.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ExportReportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
      />
    </DashboardLayout>
  );
};

export default ManagementDashboard;
