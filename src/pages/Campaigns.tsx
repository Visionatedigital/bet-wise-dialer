import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Target, Play, Pause, Square, BarChart3, Users, Phone, TrendingUp, Clock, DollarSign, Calendar, Settings } from "lucide-react";
import { formatUGX } from "@/data/sampleData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CreateCampaignModal } from "@/components/campaigns/CreateCampaignModal";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed';
  start_date: string | null;
  end_date: string | null;
  target_calls: number;
  target_conversions: number;
  total_leads: number;
  total_calls: number;
  total_conversions: number;
  total_deposits: number;
}


export default function Campaigns() {
  const { user } = useAuth();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data as Campaign[]) || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 border border-green-500/20";
      case "paused": return "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 border border-yellow-500/20";
      case "completed": return "bg-muted text-muted-foreground border border-border";
      default: return "bg-muted text-muted-foreground border border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <Play className="h-4 w-4" />;
      case "paused": return <Pause className="h-4 w-4" />;
      case "completed": return <Square className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const calculateConversionRate = (campaign: Campaign | null) => {
    if (!campaign || campaign.total_calls === 0) return 0;
    return Math.round((campaign.total_conversions / campaign.total_calls) * 100);
  };

  const groupedCampaigns = {
    active: campaigns.filter(c => c.status === "active"),
    paused: campaigns.filter(c => c.status === "paused"),
    completed: campaigns.filter(c => c.status === "completed"),
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Campaigns</h1>
            <p className="text-muted-foreground">Campaign performance & management</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Target className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        <CreateCampaignModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onCreateComplete={fetchCampaigns}
          userId={user?.id || ''}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              Loading campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              No campaigns yet. Create your first campaign to get started!
            </div>
          ) : (
            Object.entries(groupedCampaigns).map(([status, campaignList]) => (
              <div key={status} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status)}
                    <h3 className="font-semibold capitalize text-foreground">{status}</h3>
                  </div>
                  <Badge variant="outline" className="text-xs font-medium">
                    {campaignList.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {campaignList.map((campaign) => (
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
                                      {selectedCampaign?.description || 'No description'}
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
                                        <span className="text-sm font-medium">Total Calls</span>
                                      </div>
                                      <div className="text-2xl font-bold mb-1">
                                        {selectedCampaign?.total_calls.toLocaleString()}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Target: {selectedCampaign?.target_calls.toLocaleString()}
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card className="border-green-500/10">
                                    <CardContent className="p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 rounded-md bg-green-500/10">
                                          <TrendingUp className="h-4 w-4 text-green-600" />
                                        </div>
                                        <span className="text-sm font-medium">Conversions</span>
                                      </div>
                                      <div className="text-2xl font-bold mb-1">
                                        {selectedCampaign?.total_conversions.toLocaleString()}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {calculateConversionRate(selectedCampaign)}% conversion rate
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
                                        {formatUGX(Number(selectedCampaign?.total_deposits) || 0)}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Total deposits
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card className="border-blue-500/10">
                                    <CardContent className="p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 rounded-md bg-blue-500/10">
                                          <Users className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <span className="text-sm font-medium">Total Leads</span>
                                      </div>
                                      <div className="text-2xl font-bold mb-1">
                                        {selectedCampaign?.total_leads.toLocaleString()}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Active leads
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>

                                <Tabs defaultValue="overview" className="w-full">
                                  <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="schedule">Schedule</TabsTrigger>
                                  </TabsList>
                                  
                                  <TabsContent value="overview" className="space-y-4">
                                    <Card>
                                      <CardHeader>
                                        <CardTitle className="text-base">Campaign Progress</CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-4">
                                        <div>
                                          <div className="flex justify-between text-sm mb-2">
                                            <span>Calls Progress</span>
                                            <span className="font-medium">
                                              {selectedCampaign?.total_calls} / {selectedCampaign?.target_calls}
                                            </span>
                                          </div>
                                          <Progress 
                                            value={selectedCampaign?.target_calls ? (selectedCampaign.total_calls / selectedCampaign.target_calls) * 100 : 0} 
                                          />
                                        </div>
                                        <div>
                                          <div className="flex justify-between text-sm mb-2">
                                            <span>Conversions Progress</span>
                                            <span className="font-medium">
                                              {selectedCampaign?.total_conversions} / {selectedCampaign?.target_conversions}
                                            </span>
                                          </div>
                                          <Progress 
                                            value={selectedCampaign?.target_conversions ? (selectedCampaign.total_conversions / selectedCampaign.target_conversions) * 100 : 0} 
                                          />
                                        </div>
                                      </CardContent>
                                    </Card>
                                  </TabsContent>
                                
                                 <TabsContent value="schedule" className="space-y-4">
                                   <div className="grid grid-cols-2 gap-4">
                                     <div>
                                       <label className="text-sm font-medium">Start Date</label>
                                       <div className="mt-1 text-sm">{selectedCampaign?.start_date || 'Not set'}</div>
                                     </div>
                                     <div>
                                       <label className="text-sm font-medium">End Date</label>
                                       <div className="mt-1 text-sm">{selectedCampaign?.end_date || 'Not set'}</div>
                                     </div>
                                     <div className="col-span-2">
                                       <label className="text-sm font-medium">Description</label>
                                       <div className="mt-1 text-sm">{selectedCampaign?.description || 'No description'}</div>
                                     </div>
                                   </div>
                                 </TabsContent>
                               </Tabs>
                            </div>
                          </SheetContent>
                        </Sheet>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Leads</span>
                        <span className="font-semibold">{campaign.total_leads}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Calls</span>
                        <span className="font-semibold">{campaign.total_calls}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Conversions</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {campaign.total_conversions}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {campaignList.length === 0 && (
                <div className="text-center text-muted-foreground text-sm p-8 border-2 border-dashed border-border/50 rounded-xl bg-muted/20">
                  <div className="flex flex-col items-center gap-2">
                    {getStatusIcon(status)}
                    <div>No {status} campaigns</div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}