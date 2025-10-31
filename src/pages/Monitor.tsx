import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportReportModal } from "@/components/dashboard/ExportReportModal";
import { useMonitorData } from "@/hooks/useMonitorData";
import { useTodayMetrics } from "@/hooks/useTodayMetrics";
import { useQueueMetrics } from "@/hooks/useQueueMetrics";
import {
  Phone, 
  Clock, 
  CheckCircle,
  XCircle,
  Pause,
  Headphones,
  Mic,
  PhoneCall,
  Star,
  Eye,
  BarChart3,
  UserCheck,
  Timer,
  Target,
  AlertTriangle
} from "lucide-react";

const qualityChecklist = [
  { item: "Proper greeting used", weight: 20 },
  { item: "Customer verification completed", weight: 15 },
  { item: "Active listening demonstrated", weight: 25 },
  { item: "Product knowledge accurate", weight: 20 },
  { item: "Closing summary provided", weight: 20 },
];

export default function Monitor() {
  const { agents, loading } = useMonitorData();
  const { metrics, loading: metricsLoading } = useTodayMetrics();
  const { queues, loading: queuesLoading } = useQueueMetrics();
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [qualityScores, setQualityScores] = useState<{[key: string]: number}>({});
  const [showExportModal, setShowExportModal] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on-call": return "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-500/20";
      case "online": return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20";
      case "break": return "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border border-yellow-500/20";
      case "offline": return "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20";
      default: return "bg-muted text-muted-foreground border border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "on-call": return <PhoneCall className="h-3 w-3" />;
      case "online": return <UserCheck className="h-3 w-3" />;
      case "break": return <Pause className="h-3 w-3" />;
      case "offline": return <XCircle className="h-3 w-3" />;
      default: return <XCircle className="h-3 w-3" />;
    }
  };

  const calculateOverallScore = () => {
    const scores = Object.values(qualityScores);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Live Monitor</h1>
            <p className="text-muted-foreground">Real-time agent & queue monitoring</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Live
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <ExportReportModal 
          open={showExportModal} 
          onOpenChange={setShowExportModal}
          dateRange="today"
          selectedAgent="all"
        />

        {/* Today's Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Total Calls</span>
              </div>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.totalCalls}</div>
                  <div className="text-xs text-muted-foreground">Today</div>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-green-500/10">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm font-medium">Answered</span>
              </div>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.answered}</div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.totalCalls > 0 
                      ? Math.round((metrics.answered / metrics.totalCalls) * 100)
                      : 0}% rate
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-sm font-medium">Abandoned</span>
              </div>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.abandoned}</div>
                  <div className="text-xs text-muted-foreground">
                    {metrics.totalCalls > 0
                      ? Math.round((metrics.abandoned / metrics.totalCalls) * 100)
                      : 0}% rate
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Avg Handle</span>
              </div>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.avgHandleTime}</div>
                  <div className="text-xs text-muted-foreground">Average time</div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-amber-500/10">
                  <Timer className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium">Avg Speed</span>
              </div>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.avgSpeedAnswer}</div>
                  <div className="text-xs text-muted-foreground">To answer</div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-green-500/10">
                  <Target className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-sm font-medium">Conversion</span>
              </div>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{metrics.conversionRate}%</div>
                  <div className="text-xs text-muted-foreground">Success rate</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Status */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Agent Status</h3>
              <Badge variant="outline" className="text-xs">
                {agents.length} agents
              </Badge>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : agents.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No active agents found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                <Card key={agent.id} className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-sm font-medium">
                            {agent.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{agent.name}</div>
                          <div className="text-xs text-muted-foreground">{agent.campaign}</div>
                        </div>
                      </div>
                      <Badge className={getStatusColor(agent.status)}>
                        {getStatusIcon(agent.status)}
                        <span className="ml-1 capitalize">{agent.status.replace('-', ' ')}</span>
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                      <div>
                        <div className="text-muted-foreground">Duration</div>
                        <div className="font-medium">{agent.duration}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Calls</div>
                        <div className="font-medium">{agent.calls}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Score</div>
                        <div className="font-medium flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {agent.score}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                          onClick={() => setSelectedAgent(agent)}
                          disabled={agent.status !== "on-call"}
                          >
                            <Headphones className="h-3 w-3 mr-1" />
                            Listen
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="w-[500px] sm:max-w-none">
                          <SheetHeader>
                            <SheetTitle className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-sm">
                                  {selectedAgent?.avatar}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{selectedAgent?.name}</div>
                                <div className="text-sm font-normal text-muted-foreground">
                                  Live Call Monitor
                                </div>
                              </div>
                            </SheetTitle>
                          </SheetHeader>

                          <div className="mt-6 space-y-6">
                            <div className="flex gap-3">
                              <Button size="sm" className="flex-1">
                                <Mic className="h-4 w-4 mr-2" />
                                Whisper
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1">
                                <Eye className="h-4 w-4 mr-2" />
                                Barge In
                              </Button>
                            </div>

                            <Tabs defaultValue="call-info">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="call-info">Call Info</TabsTrigger>
                                <TabsTrigger value="quality">Quality</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="call-info" className="space-y-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-base">Current Call</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium text-muted-foreground">Duration</label>
                                        <div className="text-lg font-bold">{selectedAgent?.duration}</div>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-muted-foreground">Campaign</label>
                                        <div className="text-sm">{selectedAgent?.campaign}</div>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Lead Name</label>
                                      <div className="text-sm">Robert Kiprotich</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                                      <div className="text-sm">+256 7XX XXX 234</div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </TabsContent>
                              
                              <TabsContent value="quality" className="space-y-4">
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-base">Quality Checklist</CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    {qualityChecklist.map((item, index) => (
                                      <div key={index} className="flex items-center justify-between p-2 border border-border rounded-md">
                                        <div className="flex-1">
                                          <div className="text-sm">{item.item}</div>
                                          <div className="text-xs text-muted-foreground">{item.weight}% weight</div>
                                        </div>
                                        <div className="flex gap-1">
                                          {[1, 2, 3, 4, 5].map((score) => (
                                            <button
                                              key={score}
                                              onClick={() => setQualityScores({...qualityScores, [item.item]: score})}
                                              className={`w-6 h-6 rounded-full text-xs font-medium transition-colors ${
                                                qualityScores[item.item] === score
                                                  ? 'bg-primary text-primary-foreground'
                                                  : 'bg-muted hover:bg-muted/80'
                                              }`}
                                            >
                                              {score}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                    <div className="pt-2 border-t border-border">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium">Overall Score</span>
                                        <span className="text-lg font-bold">{calculateOverallScore()}/5</span>
                                      </div>
                                      <Progress value={calculateOverallScore() * 20} className="h-2" />
                                    </div>
                                  </CardContent>
                                </Card>
                              </TabsContent>
                            </Tabs>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>
            )}
          </div>

          {/* Queue Status */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Queue Status</h3>
              <Badge variant="outline" className="text-xs">
                {queues.reduce((sum, q) => sum + q.waiting, 0)} waiting
              </Badge>
            </div>

            {queuesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : queues.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No active campaigns found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {queues.map((queue) => (
                <Card key={queue.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-sm">{queue.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {queue.agents} agent{queue.agents !== 1 ? 's' : ''} active
                        </div>
                      </div>
                      <Badge variant={queue.waiting > 15 ? "destructive" : "secondary"}>
                        {queue.waiting} waiting
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Longest Wait</span>
                        <span className="font-medium">{queue.longest}</span>
                      </div>
                      <Progress 
                        value={Math.min((parseInt(queue.longest.split(':')[0]) * 60 + parseInt(queue.longest.split(':')[1])) / 600 * 100, 100)} 
                        className="h-2" 
                      />
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>
            )}

            {!queuesLoading && queues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2 text-sm">
                    {queues.filter(q => q.waiting > 15).map(queue => (
                      <div key={queue.id} className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-md">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>{queue.name} queue over 15 waiting</span>
                      </div>
                    ))}
                    {metrics.abandoned > 0 && (metrics.abandoned / metrics.totalCalls) > 0.15 && (
                      <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-md">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Abandonment rate above 15%</span>
                      </div>
                    )}
                    {queues.filter(q => q.waiting > 15).length === 0 && 
                     (!metrics.abandoned || (metrics.abandoned / metrics.totalCalls) <= 0.15) && (
                      <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>All queues operating normally</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}