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
  Play,
  LayoutGrid,
  List
} from "lucide-react";
import { formatUGX, maskPhone } from "@/lib/formatters";
import { usePerformanceData } from "@/hooks/usePerformanceData";
import { useFunnelAnalysis } from "@/hooks/useFunnelAnalysis";
import { useRecentCalls } from "@/hooks/useRecentCalls";
import { useAgentAnalysis } from "@/hooks/useAgentAnalysis";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const dateRanges = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "This month", value: "month" },
  { label: "Last month", value: "last-month" },
  { label: "Custom", value: "custom" },
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
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [keyMoments, setKeyMoments] = useState<Array<{time: string; type: string; text: string}>>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranscribed, setIsTranscribed] = useState(false);
  const [agentViewMode, setAgentViewMode] = useState<"grid" | "list">("grid");
  
  const { campaigns, metrics, dailyPerformance, loading } = usePerformanceData(
    selectedDateRange,
    selectedCampaign
  );

  const { funnelData, insights, message, loading: funnelLoading } = useFunnelAnalysis(
    selectedDateRange,
    selectedCampaign
  );

  const { calls, loading: callsLoading } = useRecentCalls();

  const { agents, insights: agentInsights, loading: agentsLoading, message: agentMessage } = useAgentAnalysis(selectedDateRange);

  const handleTranscribeCall = async (callId: string) => {
    setIsTranscribing(true);
    setIsTranscribed(false);
    
    try {
      // Simulate transcript generation (in production, this would come from audio transcription)
      const simulatedTranscript = `Agent: Good afternoon, this is calling from Betsure. How are you today?
Customer: I'm fine, thanks. What's this about?
Agent: I'm calling about our exclusive sports betting promotion. You've been selected for our VIP betting package.
Customer: That sounds interesting. Tell me more about the bonus.
Agent: Great! You'll get a 100% match bonus up to 500,000 UGX on your first deposit.
Customer: Okay, that's quite good. How do I get started?
Agent: I can help you set up your account right now. Do you have a moment?
Customer: Yes, let's do it.`;

      setTranscriptText(simulatedTranscript);

      // Call the edge function to analyze with GPT-5
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: { 
          callId,
          transcript: simulatedTranscript 
        }
      });

      if (error) throw error;

      setKeyMoments(data.keyMoments || []);
      setSuggestions(data.suggestions || []);
      setIsTranscribed(true);
      toast.success('Transcript generated successfully!');
    } catch (error) {
      console.error('Error transcribing call:', error);
      toast.error('Failed to generate transcript');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatHandleTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedCall = calls.find(call => call.id === selectedCallId);

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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
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


          <TabsContent value="ai-insights" className="space-y-6">
            {funnelLoading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ) : message ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Not Enough Data</h3>
                  <p className="text-muted-foreground">{message}</p>
                </CardContent>
              </Card>
            ) : insights && insights.length > 0 ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      AI-Powered Performance Insights
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      GPT-5 analyzed your call data to identify opportunities and improvements
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {insights.map((insight, index) => (
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
                                {insight.category}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {funnelData && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Funnel Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 border border-border rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Dials</div>
                          <div className="text-2xl font-bold">{funnelData.dials}</div>
                          <div className="text-xs text-muted-foreground">100%</div>
                        </div>
                        <div className="p-3 border border-border rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Connects</div>
                          <div className="text-2xl font-bold">{funnelData.connects}</div>
                          <div className="text-xs text-muted-foreground">{funnelData.connectRate}%</div>
                        </div>
                        <div className="p-3 border border-border rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Qualified</div>
                          <div className="text-2xl font-bold">{funnelData.qualified}</div>
                          <div className="text-xs text-muted-foreground">{funnelData.qualificationRate}%</div>
                        </div>
                        <div className="p-3 border border-border rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Conversions</div>
                          <div className="text-2xl font-bold">{funnelData.conversions}</div>
                          <div className="text-xs text-muted-foreground">{funnelData.conversionRate}%</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Insights Available</h3>
                  <p className="text-muted-foreground">Unable to generate insights. Please try again.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="transcripts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Calls (Today)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {callsLoading ? (
                      <div className="p-4">
                        <Skeleton className="h-20 w-full mb-2" />
                        <Skeleton className="h-20 w-full mb-2" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    ) : calls.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No calls today yet</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {calls.map((call) => (
                          <div 
                            key={call.id}
                            className={`p-3 cursor-pointer transition-colors border-l-2 ${
                              selectedCallId === call.id 
                                ? 'bg-primary/10 border-l-primary' 
                                : 'hover:bg-muted/50 border-l-transparent'
                            }`}
                            onClick={() => {
                              setSelectedCallId(call.id);
                              setIsTranscribed(false);
                              setTranscriptText("");
                              setKeyMoments([]);
                              setSuggestions([]);
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-sm">{call.lead_name}</div>
                              <Badge variant="outline" className="text-xs">
                                {call.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">
                              {maskPhone(call.phone_number)}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">
                                Duration: {formatDuration(call.duration_seconds)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(call.start_time).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                {selectedCall ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Call: {selectedCall.lead_name}
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Duration: {formatDuration(selectedCall.duration_seconds)}</span>
                        <span>Phone: {maskPhone(selectedCall.phone_number)}</span>
                        <span>Status: {selectedCall.status}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {!isTranscribed ? (
                        <div className="text-center py-12">
                          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">Call Recording Available</h3>
                          <p className="text-muted-foreground mb-6">
                            Generate a transcript and get AI-powered insights for this call
                          </p>
                          <div className="flex items-center justify-center gap-3">
                            {selectedCall.recording_url && (
                              <Button variant="outline" size="lg">
                                <Play className="h-4 w-4 mr-2" />
                                Play Audio
                              </Button>
                            )}
                            <Button 
                              size="lg"
                              onClick={() => handleTranscribeCall(selectedCall.id)}
                              disabled={isTranscribing}
                            >
                              {isTranscribing ? (
                                <>
                                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                  Transcribing...
                                </>
                              ) : (
                                <>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Transcribe Call
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <FileText className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">Transcript</span>
                              {selectedCall.recording_url && (
                                <Button variant="ghost" size="sm">
                                  <Play className="h-3 w-3 mr-1" />
                                  Play Audio
                                </Button>
                              )}
                            </div>
                            <div className="p-4 bg-muted/30 rounded-lg">
                              <div className="text-sm leading-relaxed whitespace-pre-line">
                                {transcriptText}
                              </div>
                            </div>
                          </div>

                          {keyMoments.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <span className="font-medium text-sm">Key Moments</span>
                              </div>
                              <div className="space-y-2">
                                {keyMoments.map((moment, index) => (
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
                          )}

                          {suggestions.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Brain className="h-4 w-4 text-green-500" />
                                <span className="font-medium text-sm">AI Coaching Suggestions</span>
                              </div>
                              <div className="space-y-2">
                                {suggestions.map((suggestion, index) => (
                                  <div key={index} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-sm">{suggestion}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Select a Call</h3>
                      <p className="text-muted-foreground">
                        Choose a call from the list to view transcript and AI insights
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                {agentInsights.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="h-4 w-4" />
                    <span>AI-powered ranking and analysis</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={agentViewMode === "grid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAgentViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={agentViewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAgentViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {agentsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Agent Data</h3>
                  <p className="text-muted-foreground">{agentMessage || 'No agent activity found for the selected period'}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {agentInsights.length > 0 && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        Team Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {agentInsights.map((insight, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                            <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm">{insight}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {agentViewMode === "grid" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {agents.map((agent) => (
                      <Card key={agent.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="text-sm font-medium">
                                {agent.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{agent.name}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {agent.score} AI Score
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              #{agent.rank}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                              <div className="text-xs text-muted-foreground">Calls</div>
                              <div className="font-bold">{agent.calls}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Conversion</div>
                              <div className="font-bold">{agent.conversionRate}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Avg Handle</div>
                              <div className="font-bold">{formatHandleTime(agent.avgHandleTime)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Revenue</div>
                              <div className="font-bold">{formatUGX(agent.revenue)}</div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>Performance</span>
                              <span>{agent.score}/100</span>
                            </div>
                            <Progress value={agent.score} className="h-2" />
                          </div>

                          {(agent.strengths && agent.strengths.length > 0) && (
                            <div className="mt-4 pt-4 border-t">
                              <div className="text-xs font-medium mb-2">Strengths</div>
                              <div className="space-y-1">
                                {agent.strengths.map((strength, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground">{strength}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {agents.map((agent) => (
                          <div key={agent.id} className="p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-4">
                              <Badge variant="outline" className="w-12 text-center">
                                #{agent.rank}
                              </Badge>
                              
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="text-sm font-medium">
                                  {agent.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{agent.name}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  {agent.score} Score
                                </div>
                              </div>

                              <div className="hidden md:flex items-center gap-6 text-sm">
                                <div className="text-center">
                                  <div className="text-muted-foreground text-xs mb-1">Calls</div>
                                  <div className="font-semibold">{agent.calls}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-muted-foreground text-xs mb-1">Conv Rate</div>
                                  <div className="font-semibold">{agent.conversionRate}%</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-muted-foreground text-xs mb-1">Avg Handle</div>
                                  <div className="font-semibold">{formatHandleTime(agent.avgHandleTime)}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-muted-foreground text-xs mb-1">Revenue</div>
                                  <div className="font-semibold">{formatUGX(agent.revenue)}</div>
                                </div>
                              </div>

                              <div className="w-24">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">Score</span>
                                  <span>{agent.score}</span>
                                </div>
                                <Progress value={agent.score} className="h-2" />
                              </div>
                            </div>

                            {(agent.strengths && agent.strengths.length > 0) && (
                              <div className="mt-3 ml-16 pt-3 border-t">
                                <div className="flex flex-wrap gap-2">
                                  {agent.strengths.map((strength, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      {strength}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}