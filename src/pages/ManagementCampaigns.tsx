import { useState, useEffect } from "react";
import { ManagementLayout } from "@/components/layout/ManagementLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp, Phone, Users, DollarSign, Plus, Play, Pause, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatUGX } from "@/lib/formatters";
import { CreateCampaignModal } from "@/components/campaigns/CreateCampaignModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  created_at: string;
}

export default function ManagementCampaigns() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

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

  const toggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    setUpdating(campaignId);
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('id', campaignId);

      if (error) throw error;
      toast.success(`Campaign ${newStatus === 'active' ? 'activated' : 'paused'}`);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign');
    } finally {
      setUpdating(null);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;

    setUpdating(campaignId);
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      toast.success('Campaign deleted');
      await fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setUpdating(null);
    }
  };

  const calculateStats = () => {
    const active = campaigns.filter(c => c.status === 'active').length;
    const totalCalls = campaigns.reduce((sum, c) => sum + c.total_calls, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.total_conversions, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + Number(c.total_deposits), 0);
    const conversionRate = totalCalls > 0 ? Math.round((totalConversions / totalCalls) * 100) : 0;

    return { active, totalCalls, totalConversions, totalRevenue, conversionRate };
  };

  const stats = calculateStats();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "paused": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "completed": return "bg-muted text-muted-foreground border-border";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campaign Management</h1>
            <p className="text-muted-foreground">Oversee all campaigns and performance</p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        <CreateCampaignModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onCreateComplete={fetchCampaigns}
          userId={user?.id || ''}
        />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Active</span>
              </div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-xs text-muted-foreground">campaigns</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Total Calls</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalCalls.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">across all campaigns</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Conversions</span>
              </div>
              <div className="text-2xl font-bold">{stats.totalConversions.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{stats.conversionRate}% rate</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-muted-foreground">Revenue</span>
              </div>
              <div className="text-2xl font-bold">{formatUGX(stats.totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">total deposits</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-muted-foreground">Avg Conv Rate</span>
              </div>
              <div className="text-2xl font-bold">{stats.conversionRate}%</div>
              <div className="text-xs text-muted-foreground">conversion rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No campaigns yet. Create your first campaign to get started!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Conv Rate</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    const convRate = campaign.total_calls > 0 
                      ? Math.round((campaign.total_conversions / campaign.total_calls) * 100) 
                      : 0;

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{campaign.name}</div>
                            {campaign.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {campaign.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{campaign.total_leads}</TableCell>
                        <TableCell className="text-right">
                          {campaign.total_calls.toLocaleString()}
                          <span className="text-xs text-muted-foreground ml-1">
                            / {campaign.target_calls.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {campaign.total_conversions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatUGX(Number(campaign.total_deposits))}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={convRate >= 10 ? "text-green-600 font-medium" : ""}>
                            {convRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {campaign.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleCampaignStatus(campaign.id, campaign.status)}
                                disabled={updating === campaign.id}
                              >
                                {campaign.status === 'active' ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteCampaign(campaign.id)}
                              disabled={updating === campaign.id}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ManagementLayout>
  );
}
