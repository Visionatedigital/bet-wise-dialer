import { useState, useEffect } from 'react';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { BarChart3, Download, TrendingUp, Lightbulb, Target, Users, FileText } from 'lucide-react';
import { useFunnelAnalysis } from '@/hooks/useFunnelAnalysis';
import { useAgentAnalysis } from '@/hooks/useAgentAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatUGX } from '@/lib/formatters';

const ManagementReports = () => {
  const [dateRange, setDateRange] = useState('week');
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [reportPreview, setReportPreview] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeAgents, setIncludeAgents] = useState(true);
  const [includeQueues, setIncludeQueues] = useState(true);
  const [includeCallNotes, setIncludeCallNotes] = useState(true);
  
  const { funnelData, insights, message, loading } = useFunnelAnalysis(dateRange, '');
  const { agents, insights: agentInsights } = useAgentAnalysis(dateRange);

  useEffect(() => {
    fetchPerformanceAnalysis();
  }, [dateRange]);

  useEffect(() => {
    if (performanceData) {
      generateReportPreview();
    }
  }, [performanceData]);

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

  const generateReportPreview = () => {
    if (!performanceData) return;

    const totalCalls = performanceData.agents?.reduce((sum: number, a: any) => sum + a.calls, 0) || 0;
    const totalConversions = performanceData.agents?.reduce((sum: number, a: any) => sum + a.conversions, 0) || 0;
    const totalRevenue = performanceData.agents?.reduce((sum: number, a: any) => sum + a.revenue, 0) || 0;
    
    let preview = `PERFORMANCE REPORT - ${dateRange.toUpperCase()}\n\n`;
    preview += `SUMMARY\n${performanceData.summary || 'No summary available'}\n\n`;
    preview += `METRICS\n`;
    preview += `Total Calls: ${totalCalls}\n`;
    preview += `Total Conversions: ${totalConversions}\n`;
    preview += `Total Revenue: ${formatUGX(totalRevenue)}\n`;
    preview += `Conversion Rate: ${totalCalls > 0 ? ((totalConversions / totalCalls) * 100).toFixed(2) : 0}%\n\n`;
    
    if (performanceData.insights && performanceData.insights.length > 0) {
      preview += `KEY INSIGHTS\n`;
      performanceData.insights.forEach((insight: any, idx: number) => {
        preview += `${idx + 1}. ${insight.title}\n   ${insight.description}\n`;
        if (insight.agents) preview += `   Agents: ${insight.agents.join(', ')}\n`;
      });
      preview += '\n';
    }

    if (performanceData.agents && performanceData.agents.length > 0) {
      preview += `AGENT PERFORMANCE\n`;
      performanceData.agents
        .filter((a: any) => a.calls > 0)
        .sort((a: any, b: any) => b.conversions - a.conversions)
        .forEach((agent: any) => {
          preview += `\n${agent.name}\n`;
          preview += `  Calls: ${agent.calls} | Conversions: ${agent.conversions} | Rate: ${agent.conversionRate}%\n`;
          preview += `  Revenue: ${formatUGX(agent.revenue)} | Avg Handle Time: ${agent.avgHandleTime}s\n`;
        });
    }

    setReportPreview(preview);
  };

  const handleExportReport = async () => {
    try {
      toast.info('Generating AI-powered report...');
      
      const startDate = getStartDate(dateRange);
      const endDate = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: { 
          startDate,
          endDate,
          includeMetrics,
          includeAgents,
          includeQueues,
          includeCallNotes
        },
      });
      
      if (error) throw error;
      
      const report = data?.report || '';
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Report - ${dateRange}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 40px 20px; color: #333; }
    h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 30px; }
    h2 { color: #1e40af; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #2563eb; padding-left: 15px; }
    h3 { color: #1e3a8a; margin-top: 20px; margin-bottom: 10px; }
    pre { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; }
  </style>
</head>
<body>
  <pre>${report}</pre>
</body>
</html>`;
      
      const blob = new Blob([html], { type: 'text/html' });
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

  const getStartDate = (range: string): string => {
    const now = new Date();
    switch (range) {
      case 'today':
        return now.toISOString().split('T')[0];
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo.toISOString().split('T')[0];
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo.toISOString().split('T')[0];
      case 'quarter':
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        return quarterAgo.toISOString().split('T')[0];
      default:
        return now.toISOString().split('T')[0];
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
          <div className="flex gap-4 items-center">
            <div className="flex gap-4 items-center bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2">
                <Checkbox id="metrics" checked={includeMetrics} onCheckedChange={(checked) => setIncludeMetrics(checked === true)} />
                <Label htmlFor="metrics" className="cursor-pointer text-sm">Metrics</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="agents" checked={includeAgents} onCheckedChange={(checked) => setIncludeAgents(checked === true)} />
                <Label htmlFor="agents" className="cursor-pointer text-sm">Agents</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="queues" checked={includeQueues} onCheckedChange={(checked) => setIncludeQueues(checked === true)} />
                <Label htmlFor="queues" className="cursor-pointer text-sm">Campaigns</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="callnotes" checked={includeCallNotes} onCheckedChange={(checked) => setIncludeCallNotes(checked === true)} />
                <Label htmlFor="callnotes" className="cursor-pointer text-sm">Call Notes</Label>
              </div>
            </div>
            <Button onClick={handleExportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-48 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
          </SelectContent>
        </Select>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="preview">Report Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">

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
          </TabsContent>

          <TabsContent value="preview" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Report Preview & Edit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Review and edit the report before exporting. Changes made here will be included in the export.
                </p>
                <Textarea
                  value={reportPreview}
                  onChange={(e) => setReportPreview(e.target.value)}
                  rows={25}
                  className="font-mono text-sm"
                  placeholder="Loading report preview..."
                />
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={generateReportPreview}>
                    Reset to Original
                  </Button>
                  <Button onClick={handleExportReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ManagementLayout>
  );
};

export default ManagementReports;
