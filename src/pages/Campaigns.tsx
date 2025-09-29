import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Target, Play, Pause, Square, BarChart3, Users, Phone, TrendingUp, Clock, DollarSign, Calendar, Settings } from "lucide-react";
import { sampleCampaigns, sampleLeads, formatUGX, type Campaign } from "@/data/sampleData";

export default function Campaigns() {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live": return "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-500/20";
      case "planned": return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/20";
      case "paused": return "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border border-yellow-500/20";
      case "done": return "bg-muted text-muted-foreground border border-border";
      default: return "bg-muted text-muted-foreground border border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live": return <Play className="h-4 w-4" />;
      case "planned": return <Calendar className="h-4 w-4" />;
      case "paused": return <Pause className="h-4 w-4" />;
      case "done": return <Square className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getCampaignLeads = (campaignName: string) => {
    return sampleLeads.filter(lead => lead.campaign === campaignName);
  };

  const calculateConversionRate = (campaign: Campaign) => {
    return campaign.kpis.connects > 0 ? Math.round((campaign.kpis.converts / campaign.kpis.connects) * 100) : 0;
  };

  const calculateConnectRate = (campaign: Campaign) => {
    return campaign.kpis.dials > 0 ? Math.round((campaign.kpis.connects / campaign.kpis.dials) * 100) : 0;
  };

  const groupedCampaigns = {
    planned: sampleCampaigns.filter(c => c.status === "planned"),
    live: sampleCampaigns.filter(c => c.status === "live"),
    paused: sampleCampaigns.filter(c => c.status === "paused"),
    done: sampleCampaigns.filter(c => c.status === "done"),
  };

  const heatmapHours = [
    { hour: "9AM", calls: 45, connects: 32 },
    { hour: "10AM", calls: 62, connects: 48 },
    { hour: "11AM", calls: 58, connects: 41 },
    { hour: "12PM", calls: 38, connects: 25 },
    { hour: "1PM", calls: 25, connects: 18 },
    { hour: "2PM", calls: 55, connects: 42 },
    { hour: "3PM", calls: 67, connects: 52 },
    { hour: "4PM", calls: 71, connects: 58 },
    { hour: "5PM", calls: 49, connects: 35 },
    { hour: "6PM", calls: 28, connects: 20 },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground">Campaign performance & management</p>
          </div>
          <Button>
            <Target className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {Object.entries(groupedCampaigns).map(([status, campaigns]) => (
            <div key={status} className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <h3 className="font-semibold capitalize text-foreground">{status}</h3>
                </div>
                <Badge variant="outline" className="text-xs font-medium">
                  {campaigns.length}
                </Badge>
              </div>

              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id} className="group hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer border-border/50 hover:border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold mb-3 group-hover:text-primary transition-colors">
                            {campaign.name}
                          </CardTitle>
                          <Badge className={getStatusColor(campaign.status)}>
                            {getStatusIcon(campaign.status)}
                            <span className="ml-1 capitalize">{campaign.status}</span>
                          </Badge>
                        </div>
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedCampaign(campaign)}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-[700px] sm:max-w-none">
                            <SheetHeader>
                              <SheetTitle className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                  <Target className="h-5 w-5" />
                                </div>
                                <div>
                                  <div>{selectedCampaign?.name}</div>
                                  <div className="text-sm font-normal text-muted-foreground">
                                    {selectedCampaign?.objective}
                                  </div>
                                </div>
                              </SheetTitle>
                            </SheetHeader>

                            <div className="mt-6 space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                   <Card className="border-primary/10">
                                     <CardContent className="p-4">
                                       <div className="flex items-center gap-2 mb-3">
                                         <div className="p-1.5 rounded-md bg-primary/10">
                                           <Phone className="h-4 w-4 text-primary" />
                                         </div>
                                         <span className="text-sm font-medium">Dials</span>
                                       </div>
                                       <div className="text-2xl font-bold mb-1">
                                         {selectedCampaign?.kpis.dials.toLocaleString()}
                                       </div>
                                       <div className="text-xs text-muted-foreground">
                                         {calculateConnectRate(selectedCampaign!)}% connect rate
                                       </div>
                                     </CardContent>
                                   </Card>
                                 <Card className="border-green-500/10">
                                   <CardContent className="p-4">
                                     <div className="flex items-center gap-2 mb-3">
                                       <div className="p-1.5 rounded-md bg-green-500/10">
                                         <TrendingUp className="h-4 w-4 text-green-600" />
                                       </div>
                                       <span className="text-sm font-medium">Converts</span>
                                     </div>
                                     <div className="text-2xl font-bold mb-1">
                                       {selectedCampaign?.kpis.converts.toLocaleString()}
                                     </div>
                                     <div className="text-xs text-muted-foreground">
                                       {calculateConversionRate(selectedCampaign!)}% conversion rate
                                     </div>
                                   </CardContent>
                                 </Card>
                                 <Card className="border-amber-500/10">
                                   <CardContent className="p-4">
                                     <div className="flex items-center gap-2 mb-3">
                                       <div className="p-1.5 rounded-md bg-amber-500/10">
                                         <DollarSign className="h-4 w-4 text-amber-600" />
                                       </div>
                                       <span className="text-sm font-medium">Revenue</span>
                                     </div>
                                     <div className="text-2xl font-bold mb-1">
                                       {formatUGX(selectedCampaign?.kpis.revenueUgx || 0)}
                                     </div>
                                     <div className="text-xs text-muted-foreground">
                                       Total generated
                                     </div>
                                   </CardContent>
                                 </Card>
                                 <Card className="border-blue-500/10">
                                   <CardContent className="p-4">
                                     <div className="flex items-center gap-2 mb-3">
                                       <div className="p-1.5 rounded-md bg-blue-500/10">
                                         <Users className="h-4 w-4 text-blue-600" />
                                       </div>
                                       <span className="text-sm font-medium">Queue Size</span>
                                     </div>
                                     <div className="text-2xl font-bold mb-1">
                                       {getCampaignLeads(selectedCampaign?.name || "").length.toLocaleString()}
                                     </div>
                                     <div className="text-xs text-muted-foreground">
                                       Active leads
                                     </div>
                                   </CardContent>
                                 </Card>
                              </div>

                              <Tabs defaultValue="overview" className="w-full">
                                <TabsList className="grid w-full grid-cols-4">
                                  <TabsTrigger value="overview">Overview</TabsTrigger>
                                  <TabsTrigger value="leads">Leads</TabsTrigger>
                                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                                  <TabsTrigger value="script">Script</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="overview" className="space-y-4">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Best Time of Day</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="space-y-3">
                                        {heatmapHours.map((hour) => {
                                          const connectRate = hour.calls > 0 ? (hour.connects / hour.calls) * 100 : 0;
                                          return (
                                            <div key={hour.hour} className="flex items-center gap-3">
                                              <div className="w-12 text-sm font-medium">{hour.hour}</div>
                                              <div className="flex-1">
                                                <Progress value={connectRate} className="h-3" />
                                              </div>
                                              <div className="text-sm text-muted-foreground w-12 text-right">
                                                {Math.round(connectRate)}%
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </TabsContent>
                                
                                <TabsContent value="leads" className="space-y-4">
                                  <div className="space-y-3">
                                    {getCampaignLeads(selectedCampaign?.name || "").map((lead) => (
                                      <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                                        <Avatar className="h-8 w-8">
                                          <AvatarFallback className="text-xs">
                                            {lead.name.split(' ').map(n => n[0]).join('')}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                          <div className="font-medium">{lead.name}</div>
                                          <div className="text-sm text-muted-foreground">
                                            {lead.intent || "No intent"}
                                          </div>
                                        </div>
                                        <Badge className={
                                          lead.segment === "vip" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400" :
                                          lead.segment === "semi-active" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400" :
                                          "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                                        }>
                                          {lead.segment}
                                        </Badge>
                                        <div className="text-sm font-medium">{lead.score}</div>
                                      </div>
                                    ))}
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="schedule" className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">Start Date</label>
                                      <div className="mt-1 text-sm">{selectedCampaign?.startAt}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">End Date</label>
                                      <div className="mt-1 text-sm">{selectedCampaign?.endAt}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Target Segment</label>
                                      <div className="mt-1 text-sm">{selectedCampaign?.targetSegment}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Script Version</label>
                                      <div className="mt-1 text-sm">{selectedCampaign?.scriptVersion}</div>
                                    </div>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="script" className="space-y-4">
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Campaign Offer</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="p-4 bg-muted rounded-lg">
                                        <p className="text-sm">{selectedCampaign?.offer}</p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-base">Script Version {selectedCampaign?.scriptVersion}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="text-sm text-muted-foreground">
                                        Script content and talking points will be displayed here.
                                      </div>
                                    </CardContent>
                                  </Card>
                                </TabsContent>
                              </Tabs>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground leading-relaxed">
                          {campaign.objective}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                            <Phone className="h-3 w-3 text-primary" />
                            <div>
                              <div className="text-xs text-muted-foreground">Dials</div>
                              <div className="font-semibold">{campaign.kpis.dials}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                            <Users className="h-3 w-3 text-blue-500" />
                            <div>
                              <div className="text-xs text-muted-foreground">Connects</div>
                              <div className="font-semibold">{campaign.kpis.connects}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <div>
                              <div className="text-xs text-muted-foreground">Converts</div>
                              <div className="font-semibold">{campaign.kpis.converts}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                            <DollarSign className="h-3 w-3 text-amber-500" />
                            <div>
                              <div className="text-xs text-muted-foreground">Revenue</div>
                              <div className="font-semibold">
                                {formatUGX(campaign.kpis.revenueUgx).replace('UGX', 'K')}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Connect Rate</span>
                              <span className="font-medium">{calculateConnectRate(campaign)}%</span>
                            </div>
                            <Progress value={calculateConnectRate(campaign)} className="h-2" />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Conversion Rate</span>
                              <span className="font-medium">{calculateConversionRate(campaign)}%</span>
                            </div>
                            <Progress value={calculateConversionRate(campaign)} className="h-2" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {getCampaignLeads(campaign.name).length} leads in queue
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {campaign.startAt}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {campaigns.length === 0 && (
                <div className="text-center text-muted-foreground text-sm p-8 border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                  <div className="flex flex-col items-center gap-2">
                    {getStatusIcon(status)}
                    <div>No {status} campaigns</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}