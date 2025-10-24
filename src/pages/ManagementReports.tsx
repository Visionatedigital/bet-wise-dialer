import { useState, useEffect } from 'react';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Download, TrendingUp, Lightbulb, Target, Users } from 'lucide-react';
import { useFunnelAnalysis } from '@/hooks/useFunnelAnalysis';
import { useAgentAnalysis } from '@/hooks/useAgentAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ManagementReports = () => {
  const [dateRange, setDateRange] = useState('week');
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  
  const { funnelData, insights, message, loading } = useFunnelAnalysis(dateRange, '');
  const { agents, insights: agentInsights } = useAgentAnalysis(dateRange);

  useEffect(() => {
    fetchPerformanceAnalysis();
  }, [dateRange]);

  const fetchPerformanceAnalysis = async () => {
    try {
      setLoadingPerformance(true);
      const { data, error } = await supabase.functions.invoke('analyze-performance', {
        body: { dateRange }
      });
      if (error) throw error;
      setPerformanceData(data);
    } catch (error) {
      console.error('Error fetching performance analysis:', error);
    } finally {
      setLoadingPerformance(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ dateRange }),
        }
      );
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${dateRange}-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Reports</h1>
            <p className="text-muted-foreground">AI-powered insights and team analytics</p>
          </div>
          <Button onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>

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

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Funnel Efficiency</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {funnelData ? funnelData.conversionRate : '...'}
              </div>
              <p className="text-xs text-muted-foreground">Conversion rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connect Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {funnelData ? funnelData.connectRate : '...'}
              </div>
              <p className="text-xs text-muted-foreground">Of total dials</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Agent</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents && agents.length > 0 ? agents[0].name : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {agents && agents.length > 0 ? `${agents[0].conversions} conversions` : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Insights</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{insights?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Actionable recommendations</p>
            </CardContent>
          </Card>
        </div>

        {performanceData?.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                AI Performance Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{performanceData.summary}</p>
              {performanceData.insights && performanceData.insights.length > 0 && (
                <div className="space-y-3">
                  {performanceData.insights.map((insight: any, idx: number) => (
                    <div key={idx} className="border-l-4 border-primary pl-4 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={
                          insight.type === 'success' ? 'default' : 
                          insight.type === 'warning' ? 'destructive' : 
                          'secondary'
                        }>
                          {insight.impact}
                        </Badge>
                        <span className="font-medium">{insight.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      {insight.agents && insight.agents.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Agents: {insight.agents.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {performanceData?.agents && performanceData.agents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Agent Performance Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Connects</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Avg Handle Time</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData.agents
                    .filter((agent: any) => agent.calls > 0)
                    .sort((a: any, b: any) => b.conversions - a.conversions)
                    .map((agent: any) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>
                        <Badge variant={agent.status === 'online' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{agent.calls}</TableCell>
                      <TableCell className="text-right">{agent.connects}</TableCell>
                      <TableCell className="text-right">{agent.conversions}</TableCell>
                      <TableCell className="text-right">{agent.conversionRate}%</TableCell>
                      <TableCell className="text-right">{agent.avgHandleTime}s</TableCell>
                      <TableCell className="text-right">UGX {agent.revenue.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </ManagementLayout>
  );
};

export default ManagementReports;
