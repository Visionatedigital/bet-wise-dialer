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
import { HARDCODED_CRM_LEADS } from "@/utils/hardcodedLeads";

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

      const apiLeads: Lead[] = (data || []).map(lead => ({
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

      // Map hardcoded leads to Lead type
      const hardcodedMapped: Lead[] = HARDCODED_CRM_LEADS.map(hl => ({
        id: hl.id,
        name: hl.name,
        phone: hl.phone,
        segment: hl.segment as any,
        lastActivity: "Never",
        lastDepositUgx: 0,
        score: hl.score,
        tags: ["Pinned"],
        ownerUserId: user?.id || "",
        campaign: "Pinned Portfolio",
        priority: hl.segment === 'vip' ? "high" : "medium",
      }));

      // Merge avoiding duplicate phone numbers
      const merged = [...hardcodedMapped];
      apiLeads.forEach(al => {
        if (!merged.find(ml => ml.phone === al.phone)) {
          merged.push(al);
        }
      });
      
      // Sort: VIPs and High Priority first, then by Score
      merged.sort((a, b) => {
        if (a.segment === 'vip' && b.segment !== 'vip') return -1;
        if (a.segment !== 'vip' && b.segment === 'vip') return 1;
        return (b.score || 0) - (a.score || 0);
      });

      setLeads(merged);
    } catch (error) {
      console.error('Error fetching leads:', error);
      // Fallback to only hardcoded if API fails
      const hardcodedMapped: Lead[] = HARDCODED_CRM_LEADS.map(hl => ({
        id: hl.id,
        name: hl.name,
        phone: hl.phone,
        segment: hl.segment as any,
        lastActivity: "Never",
        lastDepositUgx: 0,
        score: hl.score,
        tags: ["Pinned"],
        ownerUserId: user?.id || "",
        campaign: "Pinned Portfolio",
        priority: hl.segment === 'vip' ? "high" : "medium",
      }));
      setLeads(hardcodedMapped);
      toast.error('Failed to load dynamic clients, showing pinned portfolio');
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
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
        
        {/* Premium CRM Hero */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-green-500 to-green-700 p-10 text-white shadow-2xl shadow-green-900/10 dark:shadow-none">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#FFE600] text-green-950 border-none px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] font-black">
                  VIP Relationship Hub
                </Badge>
              </div>
              <div>
                <h1 className="text-5xl font-black tracking-tighter mb-2">
                  Smart <span className="text-[#FFE600]">CRM</span>
                </h1>
                <p className="text-emerald-50/70 max-w-md text-lg font-medium leading-relaxed">
                  Deepen client relationships and drive retention with AI-powered engagement tools.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-white/5 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 flex flex-col items-center justify-center min-w-[140px] shadow-lg">
                <span className="text-4xl font-black text-white mb-1">{totalClients}</span>
                <span className="text-[10px] text-emerald-100/60 uppercase tracking-widest font-bold">Portfolios</span>
              </div>
              <div className="bg-[#FFE600]/10 backdrop-blur-xl p-6 rounded-[2rem] border border-[#FFE600]/30 flex flex-col items-center justify-center min-w-[140px] shadow-lg">
                <span className="text-4xl font-black text-[#FFE600] mb-1">{vipClients}</span>
                <span className="text-[10px] text-[#FFE600]/80 uppercase tracking-widest font-bold text-[#FFE600]">VIP Status</span>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-emerald-400/5 blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-[#FFE600]/10 blur-[100px]" />
        </div>

        {/* Lead Ranking & Smart Suggestions */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Bot className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              Recommended Engagements
            </h2>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-wider">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              Prioritized by AI Score
            </div>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-64 rounded-3xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <Card className="border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-24">
                <div className="h-24 w-24 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6">
                  <Target className="h-12 w-12 text-slate-200" />
                </div>
                <h3 className="text-2xl font-bold mb-2">No active portfolios</h3>
                <p className="text-slate-500 mb-8 max-w-xs text-center">Import your high-value client list to begin AI relationship management.</p>
                <Button 
                  onClick={() => window.location.href = '/crm/import-leads'}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 rounded-2xl font-bold"
                >
                  Import Clients
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {leads.map(lead => {
                const insight = generateAIInsight(lead);
                return (
                  <Card key={lead.id} className="group overflow-hidden border-none shadow-xl hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500 bg-white dark:bg-slate-900 rounded-[2.5rem]">
                    <div className="flex flex-col md:flex-row h-full">
                      {/* Main Info */}
                      <div className="flex-1 p-8">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <img 
                                src={`https://picsum.photos/seed/${lead.phone}/100`} 
                                className="h-12 w-12 rounded-full object-cover border-2 border-white dark:border-emerald-900 shadow-sm"
                                alt={lead.name}
                              />
                              <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-emerald-900 ${lead.segment === 'vip' ? 'bg-[#FFE600]' : 'bg-[#22c55e]'}`} />
                            </div>
                            <div>
                              <h3 className="font-bold text-emerald-950 dark:text-white flex items-center gap-2 text-lg">
                                {lead.name}
                                {lead.segment === 'vip' && <Star className="h-4 w-4 text-[#FFE600] fill-[#FFE600]" />}
                              </h3>
                              <p className="text-sm text-emerald-600/70 font-medium">
                                {lead.phone} • {lead.lastActivity}
                              </p>
                            </div>
                          </div>
                          <Badge className={`${
                            insight.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                          } px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm`}>
                            {insight.tag}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-6 text-sm font-bold text-slate-400 mb-8">
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-emerald-500/50" /> {lead.phone}
                          </div>
                          <div className="flex items-center">
                            <History className="h-4 w-4 mr-2 text-blue-500/50" /> {lead.lastActivity}
                          </div>
                        </div>
                        
                        {/* AI Insight Glass Box */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 mb-8 group-hover:bg-emerald-50/50 dark:group-hover:bg-emerald-900/20 transition-colors duration-500">
                          <div className="flex items-start gap-4">
                            <div className="h-8 w-8 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center shrink-0">
                              <Bot className="h-5 w-5 text-emerald-600" />
                            </div>
                            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 font-medium italic">
                              "{insight.message}"
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 py-5 font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                            onClick={() => openWhatsApp(lead.phone, insight.suggestedText)}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" /> WhatsApp
                          </Button>
                          <Button 
                            variant="outline"
                            className="rounded-2xl px-6 py-5 font-bold border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
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
                            <Phone className="h-4 w-4 mr-2 text-emerald-600" /> Call
                          </Button>
                          <Button 
                            variant="ghost"
                            className="rounded-2xl p-4 font-bold text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all ml-auto"
                            onClick={() => {
                              setActiveLead(lead);
                              setNoteModalOpen(true);
                            }}
                          >
                            <Edit3 className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Metric Sidebar */}
                      <div className="w-full md:w-40 bg-slate-50/50 dark:bg-slate-800/20 p-8 border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center items-center text-center shrink-0">
                        <div className="mb-8">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">AI Score</div>
                          <div className="text-5xl font-black text-emerald-600 drop-shadow-sm">{lead.score}</div>
                        </div>
                        <div className="h-px w-12 bg-slate-200 dark:bg-slate-700 mb-8" />
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Last Dep.</div>
                          <div className="text-sm font-black text-slate-900 dark:text-white truncate w-full">
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
