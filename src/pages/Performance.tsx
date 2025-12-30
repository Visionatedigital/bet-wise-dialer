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
  const [dailyPerformanceData, setDailyPerformanceData] = useState<any[]>([]);
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

  const { campaigns, metrics, dailyPerformance, loading } = usePerformanceData(dateRange, campaignId);
  const { funnelData, insights, message, loading: insightsLoading } = useFunnelAnalysis(dateRange, campaignId || "", selectedAgent !== 'all' ? selectedAgent : null);
  const { agents, insights: agentInsights } = useAgentAnalysis(dateRange);

  // Fetch available agents for managers/admins
  useEffect(() => {
    if (isManagement || isAdmin) {
      fetchAvailableAgents();
    }
  }, [isManagement, isAdmin, user]);

  // Fetch agent-specific performance when agent is selected
  useEffect(() => {
    if (selectedAgent !== 'all' && (isManagement || isAdmin)) {
      fetchAgentPerformance();
    } else {
      setAgentPerformance(null);
    }
  }, [selectedAgent, dateRange, isManagement, isAdmin]);

  // Fetch daily performance and team data
  useEffect(() => {
    // Fetch real data (it will filter by date range internally)
    fetchDailyPerformance();
    if (selectedAgent === 'all' && (isManagement || isAdmin)) {
      fetchTeamAgentsData();
    } else {
      setTeamAgentsData([]);
    }
  }, [dateRange, selectedAgent, isManagement, isAdmin]);

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

      if (error) throw error;

      const agents: AgentOption[] = (profiles || []).map(p => ({
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
      // Calculate date range
      const daysAgo = daysMap[dateRange] || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch agent profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', selectedAgent)
        .single();

      if (!profile) return;

      // Fetch call activities for this agent
      const { data: calls } = await supabase
        .from('call_activities')
        .select('*')
        .eq('user_id', selectedAgent)
        .gte('created_at', startDate.toISOString());

      const totalCalls = calls?.length || 0;
      const connects = calls?.filter(c => c.status === 'connected' || c.status === 'converted').length || 0;
      const conversions = calls?.filter(c => c.status === 'converted').length || 0;
      const revenue = calls?.reduce((sum, c) => sum + (Number(c.deposit_amount) || 0), 0) || 0;
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
      const daysAgo = daysMap[dateRange] || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      let query = supabase
        .from('call_activities')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (selectedAgent !== 'all') {
        query = query.eq('user_id', selectedAgent);
      } else if (isManagement && !isAdmin && user) {
        // For managers, get their team's data
        const { data: teamAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);
        
        if (teamAgents && teamAgents.length > 0) {
          query = query.in('user_id', teamAgents.map(a => a.id));
        }
      }

      const { data: calls } = await query;

      if (!calls) return;

      // Group by date
      const dailyMap = new Map<string, { calls: number; connects: number; conversions: number; revenue: number }>();
      
      calls.forEach(call => {
        const date = new Date(call.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = dailyMap.get(date) || { calls: 0, connects: 0, conversions: 0, revenue: 0 };
        existing.calls++;
        if (call.status === 'connected' || call.status === 'converted') {
          existing.connects++;
        }
        if (call.status === 'converted') {
          existing.conversions++;
          existing.revenue += Number(call.deposit_amount) || 0;
        }
        dailyMap.set(date, existing);
      });

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          calls: data.calls,
          connects: data.connects,
          conversions: data.conversions,
          revenue: data.revenue,
          connectRate: data.calls > 0 ? ((data.connects / data.calls) * 100).toFixed(1) : '0',
          conversionRate: data.connects > 0 ? ((data.conversions / data.connects) * 100).toFixed(1) : '0'
        }))
        .sort((a, b) => {
          // Parse dates properly for sorting
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            // If date parsing fails, try to extract day number
            const dayA = parseInt(a.date.split(' ')[1]) || 0;
            const dayB = parseInt(b.date.split(' ')[1]) || 0;
            return dayA - dayB;
          }
          return dateA.getTime() - dateB.getTime();
        });

      // Filter to only show data within the selected date range
      const daysToShow = daysMap[dateRange] || 30;
      
      // Sort by date and take the last N days
      const sortedData = dailyData.sort((a, b) => {
        // Try to parse dates, fallback to day number extraction
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateA.getTime() - dateB.getTime();
        }
        // Fallback: extract day number from "Jan 15" format
        const dayA = parseInt(a.date.split(' ')[1]) || 0;
        const dayB = parseInt(b.date.split(' ')[1]) || 0;
        return dayA - dayB;
      });
      
      const filteredData = sortedData.slice(-daysToShow);
      
      setDailyPerformanceData(filteredData);
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

      let query = supabase
        .from('profiles')
        .select('id, full_name, email, manager_id')
        .eq('approved', true);

      if (isManagement && !isAdmin && user) {
        query = query.eq('manager_id', user.id);
      }

      const { data: profiles } = await query;

      if (!profiles) return;

      const agentsData = await Promise.all(
        profiles.map(async (profile) => {
          const { data: calls } = await supabase
            .from('call_activities')
            .select('*')
            .eq('user_id', profile.id)
            .gte('created_at', startDate.toISOString());

          const totalCalls = calls?.length || 0;
          const connects = calls?.filter(c => c.status === 'connected' || c.status === 'converted').length || 0;
          const conversions = calls?.filter(c => c.status === 'converted').length || 0;
          const revenue = calls?.reduce((sum, c) => sum + (Number(c.deposit_amount) || 0), 0) || 0;
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

      setTeamAgentsData(agentsData.sort((a, b) => b.calls - a.calls));
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
            <Select value={dateRange} onValueChange={setDateRange}>
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
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full"/></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <Phone className="h-4 w-4 text-primary mb-2" />
                <div className="text-2xl font-bold">
                  {selectedAgent !== 'all' && agentPerformance ? agentPerformance.calls : metrics.totalCalls}
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
                    : metrics.connectRate.toFixed(1)}%
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
                    : metrics.conversionRate.toFixed(1)}%
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
                      : metrics.totalRevenue
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </CardContent>
            </Card>
          </div>
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
                        <span className="font-bold">{metrics.totalCalls}</span>
                      </div>
                      <Progress value={100} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Connects</span>
                        <span className="font-bold">{metrics.connects || 0}</span>
                      </div>
                      <Progress value={metrics.connectRate} className="h-2" />
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Conversions</span>
                        <span className="font-bold">{metrics.conversions || 0}</span>
                      </div>
                      <Progress value={metrics.conversionRate} className="h-2" />
                      
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span>Connect Rate</span>
                          <span className="font-semibold">{metrics.connectRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span>Conversion Rate</span>
                          <span className="font-semibold">{metrics.conversionRate.toFixed(1)}%</span>
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
                ) : message ? (
                  <div className="text-center py-8">
                    <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{message}</p>
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
