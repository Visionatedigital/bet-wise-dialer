import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, MessageSquare, Search, Filter, Download, UserMinus, Calendar, Clock, DollarSign, Target, Tag, User, Zap } from "lucide-react";
import { sampleCalls, formatUGX, formatKampalaTime, type Lead } from "@/data/sampleData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Leads() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLeads: Lead[] = (data || []).map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        segment: lead.segment as "dormant" | "semi-active" | "vip",
        lastActivity: lead.last_activity || "Never",
        lastDepositUgx: Number(lead.last_deposit_ugx) || 0,
        lastBetDate: lead.last_bet_date || undefined,
        intent: lead.intent || undefined,
        score: lead.score || 0,
        tags: lead.tags || [],
        ownerUserId: lead.user_id,
        nextAction: lead.next_action || undefined,
        nextActionDue: lead.next_action_due || undefined,
        campaign: lead.campaign || "No Campaign",
        priority: lead.priority as "high" | "medium" | "low",
        slaMinutes: lead.sla_minutes || 0,
      }));

      setLeads(formattedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone.includes(searchTerm);
    const matchesSegment = segmentFilter === "all" || lead.segment === segmentFilter;
    const matchesCampaign = campaignFilter === "all" || lead.campaign === campaignFilter;
    return matchesSearch && matchesSegment && matchesCampaign;
  });

  const uniqueCampaigns = [...new Set(leads.map(lead => lead.campaign))];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(filteredLeads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, leadId]);
    } else {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    }
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case "vip": return "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400";
      case "semi-active": return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "dormant": return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const maskPhone = (phone: string) => {
    return phone.replace(/(\+256 \d{3}) \d{3}(\d{3})/, '$1 ***$2');
  };

  const getLeadCalls = (leadId: string) => {
    return sampleCalls.filter(call => call.leadId === leadId);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground">Manage contacts & prospects</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button size="sm">
              <Target className="h-4 w-4 mr-2" />
              Import Leads
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Segments</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="semi-active">Semi-Active</SelectItem>
                  <SelectItem value="dormant">Dormant</SelectItem>
                </SelectContent>
              </Select>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {uniqueCampaigns.map(campaign => (
                    <SelectItem key={campaign} value={campaign}>{campaign}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedLeads.length > 0 && (
              <div className="flex items-center gap-2 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {selectedLeads.length} leads selected
                </span>
                <Button variant="outline" size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Assign Agent
                </Button>
                <Button variant="outline" size="sm">
                  <Target className="h-4 w-4 mr-2" />
                  Change Campaign
                </Button>
                <Button variant="outline" size="sm">
                  <UserMinus className="h-4 w-4 mr-2" />
                  Mark DNC
                </Button>
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead>Last Deposit</TableHead>
                  <TableHead>Next Action</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      Loading leads...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No leads found. Start by importing your first leads!
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {lead.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-xs text-muted-foreground">ID: {lead.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{maskPhone(lead.phone)}</TableCell>
                    <TableCell>
                      <Badge className={getSegmentColor(lead.segment)}>
                        {lead.segment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{lead.campaign}</TableCell>
                    <TableCell className="text-sm">{lead.intent || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{lead.score}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(lead.priority)}>
                        {lead.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{lead.lastActivity}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatUGX(lead.lastDepositUgx)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.nextAction ? (
                        <div>
                          <div>{lead.nextAction}</div>
                          {lead.nextActionDue && (
                            <div className="text-xs text-muted-foreground">
                              Due: {new Date(lead.nextActionDue).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedLead(lead)}
                            >
                              View
                            </Button>
                          </SheetTrigger>
                          <SheetContent className="w-[600px] sm:max-w-none">
                            <SheetHeader>
                              <SheetTitle className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>
                                    {selectedLead?.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div>{selectedLead?.name}</div>
                                  <div className="text-sm font-normal text-muted-foreground">
                                    {selectedLead?.phone}
                                  </div>
                                </div>
                              </SheetTitle>
                            </SheetHeader>

                            <div className="mt-6 space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <Card>
                                  <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">Last Deposit</span>
                                    </div>
                                    <div className="text-2xl font-bold">
                                      {formatUGX(selectedLead?.lastDepositUgx || 0)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Last bet: {selectedLead?.lastBetDate || "Never"}
                                    </div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Zap className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">Lead Score</span>
                                    </div>
                                    <div className="text-2xl font-bold">{selectedLead?.score}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {selectedLead?.segment} segment
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>

                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1">
                                  <Phone className="h-4 w-4 mr-2" />
                                  Call Now
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1">
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  WhatsApp
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1">
                                  <Mail className="h-4 w-4 mr-2" />
                                  Email
                                </Button>
                              </div>

                              <Tabs defaultValue="timeline" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                                  <TabsTrigger value="account">Account</TabsTrigger>
                                  <TabsTrigger value="notes">Notes</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="timeline" className="space-y-4">
                                  <div className="space-y-4">
                                    {getLeadCalls(selectedLead?.id || "").map((call) => (
                                      <div key={call.id} className="flex gap-3 p-3 rounded-lg border border-border">
                                        <div className="flex-shrink-0">
                                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Phone className="h-4 w-4 text-primary" />
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Call</span>
                                            <span className="text-xs text-muted-foreground">
                                              {formatKampalaTime(call.startedAt)}
                                            </span>
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                            Duration: {Math.floor(call.durationSeconds / 60)}m {call.durationSeconds % 60}s
                                          </div>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-xs">
                                              {call.disposition}
                                            </Badge>
                                            {call.sentiment && (
                                              <Badge 
                                                variant="outline" 
                                                className={`text-xs ${
                                                  call.sentiment === 'positive' ? 'text-green-600' :
                                                  call.sentiment === 'negative' ? 'text-red-600' :
                                                  'text-yellow-600'
                                                }`}
                                              >
                                                {call.sentiment}
                                              </Badge>
                                            )}
                                          </div>
                                          {call.notes && (
                                            <div className="text-sm mt-2 p-2 bg-muted rounded">
                                              {call.notes}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="account" className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">Segment</label>
                                      <div className="mt-1">
                                        <Badge className={getSegmentColor(selectedLead?.segment || "")}>
                                          {selectedLead?.segment}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Campaign</label>
                                      <div className="mt-1 text-sm">{selectedLead?.campaign}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Intent</label>
                                      <div className="mt-1 text-sm">{selectedLead?.intent || "—"}</div>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Owner</label>
                                      <div className="mt-1 text-sm">{selectedLead?.ownerUserId}</div>
                                    </div>
                                  </div>
                                  
                                  <Separator />
                                  
                                  <div>
                                    <label className="text-sm font-medium">Tags</label>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {selectedLead?.tags.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                          <Tag className="h-3 w-3 mr-1" />
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="notes" className="space-y-4">
                                  <div className="text-sm text-muted-foreground">
                                    Lead notes and attachments will appear here.
                                  </div>
                                </TabsContent>
                              </Tabs>
                            </div>
                          </SheetContent>
                        </Sheet>
                        <Button variant="ghost" size="sm">
                          <Phone className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}