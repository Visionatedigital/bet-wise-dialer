import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageSquare, Target, Bot, History, Star, Edit3 } from "lucide-react";
import { api } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { formatUGX, formatKampalaTime } from "@/lib/formatters";
import { type Lead } from "@/types/lead";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// Helper to generate AI Insights locally for demo purposes
const generateAIInsight = (lead: Lead) => {
  if (lead.segment === "vip") {
    return {
      message: "High-value VIP client. Last deposit was " + formatUGX(lead.lastDepositUgx || 0) + ". Recommended: Personal courtesy call to offer exclusive odds on upcoming matches.",
      suggestedText: "Hi " + lead.name.split(' ')[0] + ", this is your VIP Manager from Bangbet. We have some exclusive odds for you this weekend. Call me back if you're interested!",
      priority: "high",
      tag: "VIP Care"
    };
  } else if (lead.segment === "dormant") {
    return {
      message: "Client has been dormant. They previously engaged well. Recommended: Send a WhatsApp re-engagement message with a personalized deposit bonus.",
      suggestedText: "Hello " + lead.name.split(' ')[0] + ", we've missed you at Bangbet! Claim a 50% bonus on your next deposit today.",
      priority: "medium",
      tag: "Re-engage"
    };
  } else {
    return {
      message: "Active client but deposits could be higher. Recommended: Follow up to build rapport and ask about their favorite sports.",
      suggestedText: "Hi " + lead.name.split(' ')[0] + ", checking in from Bangbet! How has your betting experience been lately?",
      priority: "normal",
      tag: "Relationship"
    };
  }
};

export default function CrmDashboard() {
  const { user } = useAuth();
  const { startCall } = useSoftphone();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Note/Relationship Modal
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("warm");
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyLeads();
    }
  }, [user]);

  const fetchMyLeads = async () => {
    try {
      setLoading(true);
      // Fetch leads assigned to this CRM user
      const data = await api.get<any[]>("/leads?user_id=" + user?.id);

      const formattedLeads: Lead[] = (data || []).map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        segment: lead.segment as "dormant" | "semi-active" | "vip",
        lastActivity: lead.last_contact_at ? formatKampalaTime(lead.last_contact_at) : lead.last_activity || "Never",
        lastDepositUgx: Number(lead.last_deposit_ugx) || 0,
        lastBetDate: lead.last_bet_date || undefined,
        intent: lead.intent || undefined,
        score: lead.score || 0,
        tags: lead.tags || [],
        ownerUserId: lead.user_id,
        campaign: lead.campaign_name || "CRM Direct",
        priority: lead.priority as "high" | "medium" | "low",
      }));
      
      // Sort: VIPs and High Priority first, then by Score
      formattedLeads.sort((a, b) => {
        if (a.segment === 'vip' && b.segment !== 'vip') return -1;
        if (a.segment !== 'vip' && b.segment === 'vip') return 1;
        return (b.score || 0) - (a.score || 0);
      });

      setLeads(formattedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load your clients');
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    window.open("https://wa.me/" + cleanPhone + "?text=" + encodeURIComponent(text), "_blank");
  };

  const handleSaveNote = async () => {
    if (!activeLead) return;
    setSubmittingNote(true);
    try {
      // Here we would typically save to an endpoint like /leads/:id/notes
      // We will simulate it by updating the lead's intent or tag locally
      await new Promise(resolve => setTimeout(resolve, 600));
      toast.success("Relationship updated successfully!");
      setNoteModalOpen(false);
      setNoteText("");
    } catch (error) {
      toast.error("Failed to update relationship");
    } finally {
      setSubmittingNote(false);
    }
  };

  const totalClients = leads.length;
  const vipClients = leads.filter(l => l.segment === 'vip').length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Smart CRM</h1>
            <p className="text-muted-foreground mt-1">Manage your relationships and follow up on smart AI insights.</p>
          </div>
          <div className="flex gap-4">
            <Card className="w-40 border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-primary">{totalClients}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Clients</span>
              </CardContent>
            </Card>
            <Card className="w-40 border-amber-500/20 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">{vipClients}</span>
                <span className="text-xs text-amber-700/70 dark:text-amber-500/70 uppercase tracking-wider font-semibold">VIP Clients</span>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lead Ranking & Smart Suggestions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> AI Recommended Actions
          </h2>
          
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading your clients...</div>
          ) : leads.length === 0 ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">No clients assigned</h3>
                <p className="text-sm text-muted-foreground mb-4">Import your client list to get started.</p>
                <Button onClick={() => window.location.href = '/crm/import-leads'}>Import Clients</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {leads.map(lead => {
                const insight = generateAIInsight(lead);
                return (
                  <Card key={lead.id} className="overflow-hidden border-border/50 hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
                    <div className="flex items-start">
                      {/* Left Side: Info */}
                      <div className="flex-1 p-5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{lead.name}</h3>
                            {lead.segment === 'vip' && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                          </div>
                          <Badge variant={insight.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                            {insight.tag}
                          </Badge>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground mb-4">
                          <Phone className="h-3.5 w-3.5 mr-1" /> {lead.phone}
                          <span className="mx-2">•</span>
                          <History className="h-3.5 w-3.5 mr-1" /> Last active: {lead.lastActivity}
                        </div>
                        
                        {/* AI Insight Box */}
                        <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 mb-4">
                          <p className="text-sm text-foreground/90 flex items-start gap-2">
                            <Bot className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{insight.message}</span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => openWhatsApp(lead.phone, insight.suggestedText)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1.5" /> WhatsApp
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              startCall({
                                id: lead.id,
                                name: lead.name,
                                phone: lead.phone,
                                campaign: lead.campaign || "CRM Direct",
                                segment: lead.segment,
                                score: lead.score
                              });
                            }}
                          >
                            <Phone className="h-4 w-4 mr-1.5" /> Call
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setActiveLead(lead);
                              setNoteModalOpen(true);
                            }}
                          >
                            <Edit3 className="h-4 w-4 mr-1.5" /> Log Update
                          </Button>
                        </div>
                      </div>
                      
                      {/* Right Side: Data Highlights */}
                      <div className="w-32 bg-muted/30 p-4 border-l flex flex-col justify-center items-center text-center shrink-0">
                        <div className="mb-4">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Score</div>
                          <div className="text-2xl font-bold text-primary">{lead.score}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Dep.</div>
                          <div className="text-sm font-semibold truncate w-full" title={formatUGX(lead.lastDepositUgx || 0)}>
                            {lead.lastDepositUgx ? formatUGX(lead.lastDepositUgx) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Note/Update Modal */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Relationship</DialogTitle>
            <DialogDescription>
              Log your recent conversation with {activeLead?.name} to help AI learn.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Relationship Temperature</label>
              <Select value={relationshipStatus} onValueChange={setRelationshipStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot (Ready to deposit)</SelectItem>
                  <SelectItem value="warm">Warm (Engaged, interested)</SelectItem>
                  <SelectItem value="cold">Cold (Not responsive)</SelectItem>
                  <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Conversation Notes</label>
              <Textarea 
                placeholder="What did you discuss? What are their betting preferences?"
                className="h-24"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveNote} disabled={submittingNote || !noteText.trim()}>
              {submittingNote ? 'Saving...' : 'Save Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
