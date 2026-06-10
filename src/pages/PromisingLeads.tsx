import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, Search, Filter, Download, 
  ChevronRight, ArrowUpRight, DollarSign, 
  Target, Zap, RefreshCw, BarChart3, 
  UserCheck, PieChart, Info
} from "lucide-react";
import { api } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatUGX, formatKampalaTime } from "@/lib/formatters";
import { Lead } from "@/types/lead";
import { ImportPerformanceModal } from "@/components/leads/ImportPerformanceModal";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

export default function PromisingLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [importModalOpen, setImportModalOpen] = useState(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      // Fetch leads that have been called and marked as interested or already in follow-up
      const data = await api.get<any[]>('/leads?limit=1000');
      
      const filteredData = (data || []).filter(l => 
        l.status === 'interested' || 
        l.lifecycle_stage === 'interested' || 
        l.lifecycle_stage === 'follow_up' ||
        l.lifecycle_stage === 'converting' ||
        l.lifecycle_stage === 'converted'
      );

      const formattedLeads: Lead[] = filteredData.map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        segment: l.segment,
        priority: l.priority,
        status: l.status,
        lifecycleStage: l.lifecycle_stage || 'interested',
        followUpCategory: l.follow_up_category || 'Uncategorized',
        postCallDepositUgx: Number(l.post_call_deposit_ugx) || 0,
        postCallBetCount: Number(l.post_call_bet_count) || 0,
        postCallLastActivity: l.post_call_last_activity,
        performanceUpdatedAt: l.performance_updated_at,
        last_contact_at: l.last_contact_at,
        score: l.score || 0,
        campaign: l.campaign_name || l.campaign
      }));

      setLeads(formattedLeads);
    } catch (error) {
      console.error('Error fetching promising leads:', error);
      toast.error('Failed to load promising leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const updateLeadStage = async (leadId: string, stage: string) => {
    try {
      await api.patch(`/leads/${leadId}`, { lifecycle_stage: stage });
      toast.success(`Lead moved to ${stage}`);
      fetchLeads();
    } catch (error) {
      toast.error('Failed to update stage');
    }
  };

  const updateLeadCategory = async (leadId: string, category: string) => {
    try {
      await api.patch(`/leads/${leadId}`, { follow_up_category: category });
      toast.success(`Category updated to ${category}`);
      fetchLeads();
    } catch (error) {
      toast.error('Failed to update category');
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || lead.followUpCategory === categoryFilter;
    const matchesStage = stageFilter === "all" || lead.lifecycleStage === stageFilter;
    return matchesSearch && matchesCategory && matchesStage;
  });

  const stats = {
    totalInterested: leads.length,
    convertedCount: leads.filter(l => l.postCallDepositUgx && l.postCallDepositUgx > 0).length,
    totalRevenue: leads.reduce((sum, l) => sum + (l.postCallDepositUgx || 0), 0),
    avgDeposit: leads.length > 0 
      ? leads.reduce((sum, l) => sum + (l.postCallDepositUgx || 0), 0) / leads.filter(l => l.postCallDepositUgx && l.postCallDepositUgx > 0).length || 0
      : 0
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              Lead Lifecycle Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Track promising leads and their post-call conversion performance.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Sync Data
            </Button>
            <Button size="sm" onClick={() => setImportModalOpen(true)} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              <TrendingUp className="h-4 w-4 mr-2" />
              Import Performance
            </Button>
          </div>
        </div>

        {/* Analytics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-primary/10 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Target className="h-3 w-3 mr-1 text-primary" />
                Interest Pool
              </CardDescription>
              <CardTitle className="text-3xl font-bold">{stats.totalInterested}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Total interested leads</div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-blue-500/10 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <UserCheck className="h-3 w-3 mr-1 text-blue-500" />
                Conversions
              </CardDescription>
              <CardTitle className="text-3xl font-bold">{stats.convertedCount}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs flex items-center text-blue-600 font-medium">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                {stats.totalInterested > 0 ? ((stats.convertedCount / stats.totalInterested) * 100).toFixed(1) : 0}% Conv. Rate
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-emerald-500/10 shadow-sm transition-all hover:shadow-md font-sans">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                <DollarSign className="h-3 w-3 mr-1 text-emerald-500" />
                Post-Call Rev.
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-sans">
                {formatUGX(stats.totalRevenue)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Cumulative deposits since calling</div>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-amber-500/10 shadow-sm transition-all hover:shadow-md font-sans">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground font-sans">
                <PieChart className="h-3 w-3 mr-1 text-amber-500 font-sans" />
                Avg. Deposit
              </CardDescription>
              <CardTitle className="text-2xl font-bold font-sans">
                {formatUGX(stats.avgDeposit)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Average amount per conversion</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card className="border-none shadow-none bg-transparent">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-primary/20"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[180px] h-11">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Stage" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="converting">Converting</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] h-11">
                  <div className="flex items-center gap-2 text-md">
                    <Filter className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Category" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="High Potential">High Potential</SelectItem>
                  <SelectItem value="Wait & See">Wait & See</SelectItem>
                  <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="h-11">
                <Download className="h-4 w-4 mr-2" />
                Export Rep.
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Leads Table */}
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50 dark:bg-slate-900/50">
                <TableRow>
                  <TableHead className="font-bold py-5">Promising Lead</TableHead>
                  <TableHead className="font-bold">Lifecycle Stage</TableHead>
                  <TableHead className="font-bold">Manager Category</TableHead>
                  <TableHead className="font-bold text-emerald-600 dark:text-emerald-400">Post-Call Dep.</TableHead>
                  <TableHead className="font-bold">Bet Activity</TableHead>
                  <TableHead className="font-bold">Last Action</TableHead>
                  <TableHead className="text-right font-bold pr-6">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 opacity-20" />
                      Analyzing leads data...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                      No matching leads found. Start converting some calls!
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {lead.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{lead.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{lead.phone}</div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Select 
                          value={lead.lifecycleStage || "interested"} 
                          onValueChange={(val) => updateLeadStage(lead.id, val)}
                        >
                          <SelectTrigger className={`h-8 w-32 border-none shadow-none focus:ring-0 ${
                            lead.lifecycleStage === 'converted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20' :
                            lead.lifecycleStage === 'converting' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20' :
                            lead.lifecycleStage === 'follow_up' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-900/30'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                            <SelectItem value="converting">Converting</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                            <SelectItem value="dead">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell>
                        <Select 
                          value={lead.followUpCategory || "Uncategorized"} 
                          onValueChange={(val) => updateLeadCategory(lead.id, val)}
                        >
                          <SelectTrigger className="h-8 w-36 border-slate-200 bg-white/50 dark:bg-slate-900/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                            <SelectItem value="VIP">VIP</SelectItem>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="High Potential">High Potential</SelectItem>
                            <SelectItem value="Wait & See">Wait & See</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="font-sans font-bold text-emerald-600 dark:text-emerald-400">
                        {lead.postCallDepositUgx && lead.postCallDepositUgx > 0 ? (
                          <div className="flex items-center gap-1 font-sans">
                            <ArrowUpRight className="h-3 w-3 font-sans" />
                            {formatUGX(lead.postCallDepositUgx)}
                          </div>
                        ) : "—"}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground opacity-50" />
                          <span className="font-medium">{lead.postCallBetCount || 0} bets</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <div>Called: {formatKampalaTime(lead.last_contact_at || "")}</div>
                        {lead.performanceUpdatedAt && (
                          <div className="text-[10px] text-blue-500 mt-0.5">
                            Sync: {new Date(lead.performanceUpdatedAt).toLocaleDateString()}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right pr-6">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View Activity Details</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Performance Guide Footer */}
        <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl flex items-start gap-3 border border-slate-200 dark:border-slate-800">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Manager Tip:</strong> Regularly import data from the Bangbet BO to track post-dialer conversion performance. Use the "Inerested" lifecycle stage to filter leads that showed promise during the call and move them to "Follow Up" for secondary campaigns.
          </div>
        </div>
      </div>

      <ImportPerformanceModal 
        open={importModalOpen} 
        onOpenChange={setImportModalOpen}
        onImportComplete={fetchLeads}
      />
    </DashboardLayout>
  );
}
