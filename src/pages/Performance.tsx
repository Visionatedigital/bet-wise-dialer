import { useState } from "react";
import { ManagementLayout } from "@/components/layout/ManagementLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Users, Target, DollarSign, Download, Lightbulb } from "lucide-react";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { useFunnelAnalysis } from "@/hooks/useFunnelAnalysis";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { ExportReportModal } from "@/components/dashboard/ExportReportModal";
import { formatUGX } from "@/lib/formatters";

export default function Performance() {
  const [dateRange, setDateRange] = useState("30d");
  const [campaignId, setCampaignId] = useState<string | undefined>("all");
  const [exportOpen, setExportOpen] = useState(false);

  const { campaigns, metrics, dailyPerformance, loading } = usePerformanceData(dateRange, campaignId);
  const { funnelData, insights } = useFunnelAnalysis(dateRange, campaignId || "");
  const { agents, insights: agentInsights } = useAgentAnalysis(dateRange);

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
            <p className="text-muted-foreground">Team performance with AI insights</p>
          </div>
          <Button onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="flex gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>

          <Select value={campaignId || "all"} onValueChange={(v) => setCampaignId(v === "all" ? undefined : v)}>
            <SelectTrigger className="w-56 bg-background">
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
                <div className="text-2xl font-bold">{metrics.totalCalls}</div>
                <div className="text-xs text-muted-foreground">Total Calls</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Users className="h-4 w-4 text-blue-500 mb-2" />
                <div className="text-2xl font-bold">{metrics.connectRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Connect Rate</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <Target className="h-4 w-4 text-green-500 mb-2" />
                <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Conversion Rate</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <DollarSign className="h-4 w-4 text-amber-500 mb-2" />
                <div className="text-2xl font-bold">{formatUGX(metrics.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Insights */}
        {(insights && insights.length > 0) || (agentInsights && agentInsights.length > 0) ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights?.map((i, idx) => (
                <div key={idx} className="border-l-4 border-primary pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={i.type === 'opportunity' ? 'default' : i.type === 'warning' ? 'destructive' : 'secondary'}>
                      {i.impact}
                    </Badge>
                    <span className="font-medium">{i.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{i.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <ExportReportModal open={exportOpen} onOpenChange={setExportOpen} />
      </div>
    </ManagementLayout>
  );
}
