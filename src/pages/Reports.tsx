import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Brain,
  FileText,
  Download,
  Calendar as CalendarIcon,
  Phone,
  Users,
  Target,
  DollarSign,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Lightbulb,
  Filter,
  Eye,
  Play
} from "lucide-react";
import { formatUGX } from "@/data/sampleData";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { useFunnelAnalysis } from "@/hooks/useFunnelAnalysis";
import { Skeleton } from "@/components/ui/skeleton";

const dateRanges = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This month", value: "month" },
  { label: "Last month", value: "last-month" },
  { label: "Custom", value: "custom" },
];

const aiInsights = [
  {
    type: "opportunity",
    title: "Peak Performance Hours",
    description: "Agents show 35% higher conversion rates between 2-4 PM. Consider increasing team capacity during these hours.",
    impact: "High",
    category: "Schedule Optimization"
  },
  {
    type: "warning",
    title: "Script Deviation",
    description: "15% of calls show significant script deviations. Top performers follow script more closely.",
    impact: "Medium",
    category: "Quality Assurance"
  },
  {
    type: "insight",
    title: "Objection Patterns",
    description: "Price objections increased 20% this week. Consider training on value proposition techniques.",
    impact: "High",
    category: "Sales Training"
  },
  {
    type: "opportunity",
    title: "Callback Success",
    description: "Scheduled callbacks have 40% higher conversion than immediate transfers. Promote callback scheduling.",
    impact: "Medium",
    category: "Process Improvement"
  }
];

const callTranscripts = [
  {
    id: 1,
    agent: "Sarah Nakato",
    customer: "Robert Kiprotich",
    campaign: "Summer Promo",
    duration: "04:32",
    sentiment: "positive",
    outcome: "converted",
    aiScore: 4.2,
    transcript: "Agent: Good afternoon, this is Sarah from Betsure. How are you today Robert?\nCustomer: I'm fine, thanks. What's this about?\nAgent: I'm calling about our exclusive summer promotion. You've been selected for our VIP betting package...\nCustomer: That sounds interesting. Tell me more about the bonus.\nAgent: Great! You'll get a 100% match bonus up to 500,000 UGX on your first deposit...",
    keyMoments: [
      { time: "0:15", type: "objection", text: "Customer asked about credibility" },
      { time: "1:30", type: "interest", text: "Customer showed interest in bonus structure" },
      { time: "3:45", type: "close", text: "Successfully closed with deposit commitment" }
    ],
    suggestions: [
      "Excellent rapport building at the start",
      "Could have addressed credibility concerns earlier",
      "Strong close technique demonstrated"
    ]
  },
  {
    id: 2,
    agent: "John Mukasa",
    customer: "Mary Namukasa",
    campaign: "Welcome Back",
    duration: "06:18",
    sentiment: "neutral",
    outcome: "callback",
    aiScore: 3.8,
    transcript: "Agent: Hello Mary, this is John from Betsure. I hope you're having a good day?\nCustomer: Yes, hello. Is this about betting again?\nAgent: Yes, we've noticed you haven't been active recently and wanted to offer you a special welcome back bonus...\nCustomer: I've been busy with work. Can you call me back next week?\nAgent: Of course! When would be a good time for you?",
    keyMoments: [
      { time: "0:30", type: "objection", text: "Customer seemed hesitant about betting" },
      { time: "2:15", type: "information", text: "Customer mentioned being busy with work" },
      { time: "5:30", type: "callback", text: "Scheduled callback for next week" }
    ],
    suggestions: [
      "Good at accommodating customer's schedule",
      "Could have explored work situation as conversation starter",
      "Consider shorter initial pitch for busy customers"
    ]
  }
];

export default function Reports() {
  const [selectedDateRange, setSelectedDateRange] = useState("30d");
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedTranscript, setSelectedTranscript] = useState(callTranscripts[0]);
  
  const { campaigns, metrics, dailyPerformance, loading } = usePerformanceData(
    selectedDateRange,
    selectedCampaign
  );

  const { funnelData, insights, message, loading: funnelLoading } = useFunnelAnalysis(
    selectedDateRange,
    selectedCampaign
  );

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "opportunity": return <Lightbulb className="h-4 w-4 text-green-600" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "insight": return <Brain className="h-4 w-4 text-blue-600" />;
      default: return <CheckCircle className="h-4 w-4 text-primary" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case "opportunity": return "border-green-500/20 bg-green-500/5";
      case "warning": return "border-yellow-500/20 bg-yellow-500/5";
      case "insight": return "border-blue-500/20 bg-blue-500/5";
      default: return "border-primary/20 bg-primary/5";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "text-green-600 bg-green-500/10";
      case "negative": return "text-red-600 bg-red-500/10";
      case "neutral": return "text-yellow-600 bg-yellow-500/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "converted": return "text-green-600 bg-green-500/10 border-green-500/20";
      case "callback": return "text-blue-600 bg-blue-500/10 border-blue-500/20";
      case "no-interest": return "text-red-600 bg-red-500/10 border-red-500/20";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Performance & Analytics</h1>
            <p className="text-muted-foreground">Your personal performance insights & metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              
              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRanges.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDateRange === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}

              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
            <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-2xl font-bold">{metrics.totalCalls}</div>
                    <div className="text-xs text-muted-foreground">Total Calls</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-bold">{metrics.connectRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Connect Rate</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Target className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold">{metrics.conversionRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Conversion Rate</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold">{formatUGX(metrics.totalRevenue)}</div>
                    <div className="text-xs text-muted-foreground">Revenue Generated</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Daily Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <div className="space-y-4">
                      {dailyPerformance.map((day) => {
                        const maxCalls = Math.max(...dailyPerformance.map(d => d.calls), 1);
                        return (
                          <div key={day.day} className="flex items-center gap-3">
                            <div className="w-12 text-sm font-medium">{day.day}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="text-xs text-muted-foreground">Calls</div>
                                <div className="text-xs font-medium">{day.calls}</div>
                              </div>
                              <Progress value={(day.calls / maxCalls) * 100} className="h-2" />
                            </div>
                            <div className="w-16 text-right">
                              <div className="text-xs text-muted-foreground">Conv</div>
                              <div className="text-xs font-medium">{day.conversions}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Campaign Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : campaigns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No campaigns found. Create a campaign to see performance data.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {campaigns.map((campaign) => {
                        const convRate = campaign.total_calls > 0 
                          ? ((campaign.total_conversions / campaign.total_calls) * 100).toFixed(1)
                          : "0.0";
                        return (
                          <div key={campaign.id} className="p-3 border border-border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-sm">{campaign.name}</div>
                              <Badge variant="outline" className="text-xs">
                                {convRate}% conv
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <div className="text-muted-foreground">Calls</div>
                                <div className="font-medium">{campaign.total_calls}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Revenue</div>
                                <div className="font-medium">{formatUGX(Number(campaign.total_deposits))}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="funnel" className="space-y-6">
            {funnelLoading ? (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              </div>
            ) : message ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Not Enough Data</h3>
                  <p className="text-muted-foreground">{message}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Conversion Funnel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {funnelData && (
                      <div className="space-y-6">
                        {[
                          { stage: "Dials", count: funnelData.dials, rate: 100, color: "bg-blue-500" },
                          { stage: "Connects", count: funnelData.connects, rate: Number(funnelData.connectRate), color: "bg-green-500" },
                          { stage: "Qualified", count: funnelData.qualified, rate: Number(funnelData.qualificationRate), color: "bg-yellow-500" },
                          { stage: "Converted", count: funnelData.conversions, rate: Number(funnelData.conversionRate), color: "bg-primary" },
                        ].map((stage, index, array) => (
                          <div key={stage.stage} className="relative">
                            <div className="flex items-center gap-4">
                              <div className="w-24 text-sm font-medium">{stage.stage}</div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-lg font-bold">{stage.count.toLocaleString()}</div>
                                  <div className="text-sm text-muted-foreground">{stage.rate}%</div>
                                </div>
                                <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                                  <div 
                                    className={`h-full ${stage.color} transition-all duration-500`}
                                    style={{ width: `${stage.rate}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            {index < array.length - 1 && stage.count > 0 && (
                              <div className="ml-24 mt-2 text-xs text-muted-foreground">
                                Drop: {((1 - array[index + 1].count / stage.count) * 100).toFixed(1)}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI-Powered Improvement Opportunities */}
                {insights && insights.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">AI-Powered Improvement Opportunities</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {insights.map((insight, index) => {
                          const iconMap = {
                            opportunity: Lightbulb,
                            warning: AlertTriangle,
                            insight: Brain,
                          };
                          const colorMap = {
                            opportunity: "green",
                            warning: "yellow",
                            insight: "blue",
                          };
                          const Icon = iconMap[insight.type];
                          const color = colorMap[insight.type];

                          return (
                            <div 
                              key={index}
                              className={`p-4 border border-${color}-500/20 bg-${color}-500/5 rounded-lg`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`p-2 bg-${color}-500/10 rounded-lg`}>
                                  <Icon className={`h-4 w-4 text-${color}-600`} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="font-semibold text-sm">{insight.title}</div>
                                    <Badge variant="outline" className={`text-xs border-${color}-500/30`}>
                                      {insight.impact} Impact
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {insight.description}
                                  </p>
                                  <div className="mt-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                      {insight.category}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="ai-insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI-Powered Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {aiInsights.map((insight, index) => (
                    <div key={index} className={`p-4 border rounded-lg ${getInsightColor(insight.type)}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getInsightIcon(insight.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-sm">{insight.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {insight.impact} Impact
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {insight.description}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Category: {insight.category}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recommended Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      {
                        action: "Schedule team training on objection handling",
                        priority: "High",
                        impact: "15% conversion improvement"
                      },
                      {
                        action: "Adjust calling hours to focus on 2-4 PM slot",
                        priority: "Medium", 
                        impact: "8% efficiency gain"
                      },
                      {
                        action: "Implement callback scheduling workflow",
                        priority: "Medium",
                        impact: "12% lead recovery"
                      }
                    ].map((item, index) => (
                      <div key={index} className="p-3 border border-border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{item.action}</span>
                          <Badge variant={item.priority === "High" ? "destructive" : "secondary"} className="text-xs">
                            {item.priority}
                          </Badge>
                        </div>
                        <div className="text-xs text-green-600">{item.impact}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Performance Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-sm">Next 30 Days</span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Predicted conversion rate: <span className="font-medium">26.2%</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Expected revenue: <span className="font-medium">{formatUGX(18200000)}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">Optimal Timing</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Best calling windows: 10-11 AM, 2-4 PM, 7-8 PM
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transcripts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Calls</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="space-y-1">
                      {callTranscripts.map((call) => (
                        <div 
                          key={call.id}
                          className={`p-3 cursor-pointer transition-colors border-l-2 ${
                            selectedTranscript.id === call.id 
                              ? 'bg-primary/10 border-l-primary' 
                              : 'hover:bg-muted/50 border-l-transparent'
                          }`}
                          onClick={() => setSelectedTranscript(call)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-sm">{call.customer}</div>
                            <Badge className={getSentimentColor(call.sentiment)}>
                              {call.sentiment}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">
                            {call.agent} • {call.campaign}
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge className={getOutcomeColor(call.outcome)}>
                              {call.outcome}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {call.aiScore}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Call Transcript: {selectedTranscript.customer}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Duration: {selectedTranscript.duration}</span>
                      <span>Agent: {selectedTranscript.agent}</span>
                      <span>Campaign: {selectedTranscript.campaign}</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        AI Score: {selectedTranscript.aiScore}/5
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Transcript</span>
                        <Button variant="ghost" size="sm">
                          <Play className="h-3 w-3 mr-1" />
                          Play Audio
                        </Button>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="text-sm leading-relaxed whitespace-pre-line">
                          {selectedTranscript.transcript}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-sm">Key Moments</span>
                      </div>
                      <div className="space-y-2">
                        {selectedTranscript.keyMoments.map((moment, index) => (
                          <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                            <div className="text-xs font-mono bg-background px-2 py-1 rounded">
                              {moment.time}
                            </div>
                            <div className="flex-1">
                              <div className="text-xs font-medium mb-1 capitalize">{moment.type}</div>
                              <div className="text-xs text-muted-foreground">{moment.text}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-sm">AI Coaching Suggestions</span>
                      </div>
                      <div className="space-y-2">
                        {selectedTranscript.suggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[
                { name: "Sarah Nakato", calls: 89, conv: 18.2, score: 4.2, handle: "4:32" },
                { name: "Grace Nalwanga", calls: 76, conv: 22.1, score: 4.9, handle: "3:45" },
                { name: "John Mukasa", calls: 82, conv: 15.8, score: 4.7, handle: "5:12" },
                { name: "David Ssali", calls: 65, conv: 12.3, score: 3.8, handle: "6:18" },
                { name: "Mary Nakamya", calls: 71, conv: 19.7, score: 4.4, handle: "4:02" },
                { name: "Peter Kato", calls: 58, conv: 16.5, score: 4.1, handle: "4:55" }
              ].map((agent, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-sm font-medium">
                          {agent.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{agent.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {agent.score} AI Score
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Calls</div>
                        <div className="font-bold">{agent.calls}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Conversion</div>
                        <div className="font-bold">{agent.conv}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Avg Handle</div>
                        <div className="font-bold">{agent.handle}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Rank</div>
                        <div className="font-bold">#{index + 1}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Performance</span>
                        <span>{agent.conv}%</span>
                      </div>
                      <Progress value={agent.conv} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}