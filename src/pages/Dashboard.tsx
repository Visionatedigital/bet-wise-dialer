import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AfterCallSummary } from "@/components/dashboard/AfterCallSummary";
import { AgentKPIs } from "@/components/dashboard/AgentKPIs";
import { CallHistoryModal } from "@/components/dashboard/CallHistoryModal";
import { LivePitchScript } from "@/components/dashboard/LivePitchScript";
import { CallSentimentOrb } from "@/components/dashboard/CallSentimentOrb";
import { useRealtimeAI } from "@/hooks/useRealtimeAI";
import { type Lead } from "@/types/lead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, MessageSquare, FileText, History, LayoutDashboard, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Softphone } from "@/components/dashboard/Softphone";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { toast } from "sonner";
import { safeDisplayName } from "@/lib/formatters";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { LeadsKanban } from "@/components/dashboard/LeadsKanban";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CustomerProfile } from "@/components/telemarketing/CustomerProfile";

const DUMMY_TRAITS = [
  "Casino Player 🎰",
  "Aviator Player 🚀",
  "Man Utd Fan 👹",
  "Arsenal Fan 🔫",
  "Chelsea Fan 🦁",
  "High Roller 💎",
  "Bonus Hunter 🎁",
  "Daily Bettor 📅",
  "Liverpool Fan 🔴",
  "Real Madrid Fan ⚪"
];

const getFallbackTrait = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DUMMY_TRAITS[Math.abs(hash) % DUMMY_TRAITS.length];
};

function DashboardContent() {
  const { user } = useAuth();
  const { updateStatus } = useAgentStatus();
  const { showSoftphone, setShowSoftphone, startCall } = useSoftphone();
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showACS, setShowACS] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callNotes, setCallNotes] = useState("");
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callTranscript, setCallTranscript] = useState<string>('');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [selectedLeadForProfile, setSelectedLeadForProfile] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<any>(null);

  // Real-time AI coach
  const {
    isConnected: isAIConnected,
    isConnecting: isAIConnecting,
    suggestions,
    sentiment: callSentiment,
    connect: connectAI,
    disconnect: disconnectAI,
    clearSuggestions,
    sendContext: sendAISnippet,
  } = useRealtimeAI();

  // Initialize AudioContext and set agent status
  useEffect(() => {
    const ctx = new AudioContext({ sampleRate: 24000 });
    setAudioContext(ctx);
    updateStatus('online');

    return () => {
      ctx.close();
      updateStatus('offline');
    };
  }, [updateStatus]);

  // Fetch campaign AI scripts
  const [campaignScript, setCampaignScript] = useState<string | null>(null);
  const [campaignSuggestions, setCampaignSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const loadCampaignScript = async () => {
      if (!currentLead?.segment) return;
      try {
        const campaigns = await api.get<any[]>('/campaigns');
        const match = (campaigns || []).find((c: any) =>
          c.target_segment === currentLead.segment && c.status === 'active'
        );
        if (match) {
          setCampaignScript(match.ai_script);
          setCampaignSuggestions(Array.isArray(match.suggestions) ? match.suggestions : []);
        } else {
          setCampaignScript(null);
          setCampaignSuggestions([]);
        }
      } catch (err) {
        console.error('Error loading script:', err);
      }
    };
    loadCampaignScript();
  }, [currentLead?.segment]);

  // AI Coach connection logic
  useEffect(() => {
    if (isCallActive) {
      console.log('[Dashboard] Call active, connecting AI coach...');
      connectAI()
        .then(() => {
          // Wait a bit for the connection to stabilize before sending initial context
          setTimeout(() => {
            const initialContext = `New call started with lead ${currentLead?.name || 'Unknown'} in campaign ${currentLead?.campaign || 'No Campaign'}.
            Key Stats:
            - Last Deposit: ${currentLead?.lastDepositUgx || 0} UGX
            - Preferred Product: ${currentLead?.preferredProduct || 'Unknown'}
            - Segment: ${currentLead?.segment || 'Unknown'}
            
            Monitor the conversation and use these stats to provide real-time suggestions to help close the deal.`;
            console.log('[Dashboard] Sending initial context to AI:', initialContext);
            sendAISnippet(initialContext);
          }, 1000);
        })
        .catch((err) => {
          console.error('[Dashboard] Failed to connect AI coach:', err);
          toast.error('Failed to connect AI coach. Suggestions may not be available.');
        });
    } else {
      clearSuggestions();
      disconnectAI();
    }
  }, [isCallActive, currentLead?.name, connectAI, disconnectAI, clearSuggestions, sendAISnippet]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      if (!user?.id) return;

      const data = await api.get<any[]>('/leads');

      const formattedLeads: Lead[] = ((data as any[]) || []).map(lead => ({
        id: lead.id,
        name: safeDisplayName(lead.name),
        phone: lead.phone,
        segment: lead.segment as any,
        lastActivity: lead.last_activity || "Never",
        lastDepositUgx: Number(lead.last_deposit_ugx) || 0,
        lastBetDate: lead.last_bet_date,
        intent: lead.intent,
        score: lead.score || 0,
        tags: lead.tags || [],
        ownerUserId: lead.user_id,
        nextAction: lead.next_action,
        nextActionDue: lead.next_action_due,
        campaign: lead.campaign || "No Campaign",
        campaignId: lead.campaign_id || undefined,
        priority: lead.priority as "high" | "medium" | "low",
        slaMinutes: lead.sla_minutes || 0,
        assignedAt: lead.assigned_at,
        preferredProduct: lead.preferred_product || undefined,
        status: lead.status || 'unassigned',
        trait: lead.trait || getFallbackTrait(lead.id)
      }));

      setAllLeads(formattedLeads);
    } catch (error: any) {
      console.error('Error fetching leads:', error);
      toast.error(`Failed to load leads: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  // Auto-save notes every 30 seconds
  useEffect(() => {
    if (callNotes && currentCallId) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        await saveCallNotes();
      }, 30000);
      return () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      };
    }
  }, [callNotes, currentCallId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCallNotes();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentCallId, callNotes]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await api.patch(`/leads/${leadId}`, { status: newStatus === 'unassigned' ? null : newStatus });

      setAllLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, status: newStatus } : l
      ));

      toast.success(`Lead moved to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLeadForProfile(lead.id);
  };

  const handleCallLead = async (lead: Lead) => {
    setCurrentLead(lead);
    setShowSoftphone(true);
    await updateStatus('on-call');
    startCall({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      campaign: lead.campaign || "No Campaign"
    });
  };

  const generateDailyReport = async () => {
    try {
      if (!user?.id) return;

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const allData = await api.get<any[]>('/leads');
      const data = (allData || []).filter((lead: any) =>
        lead.updated_at && lead.updated_at >= twentyFourHoursAgo
      ).sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      if (!data || data.length === 0) {
        toast.info("No lead activity recorded in the last 24 hours.");
        return;
      }

      // Format as CSV
      const headers = ["Phone", "Status", "Notes", "Timestamp"];
      const csvRows = [
        headers.join(","),
        ...((data as any[]) || []).map(row => {
          const phone = row.phone || "";
          const status = row.status || "unassigned";
          // Escape quotes in notes and replace newlines
          const notes = (row.last_activity || "").replace(/"/g, '""').replace(/\n/g, ' ');
          const timestamp = new Date(row.updated_at).toLocaleString();
          return `"${phone}","${status}","${notes}","${timestamp}"`;
        })
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `daily_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Daily report generated and downloaded.");
    } catch (err: any) {
      console.error('Error generating report:', err);
      toast.error(`Failed to generate report: ${err.message}`);
    }
  };

  const saveCallNotes = async () => {
    if (!currentCallId || !callNotes.trim()) return;
    try {
      await api.patch(`/call-activities/${currentCallId}`, { notes: callNotes });
      toast.success('Notes saved');
    } catch (error) {
      toast.error('Failed to save notes');
    }
  };

  const showSidebar = !!currentLead || showSoftphone;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full space-y-6 overflow-hidden">
      {/* KPIs at the top */}
      <div className="shrink-0 w-full mb-2">
        <AgentKPIs />
      </div>

      <div className="flex-1 flex gap-6 min-w-0 min-h-0 w-full overflow-hidden">
        {/* Main Content - Kanban Board */}
        <div className="flex-1 min-w-0 flex flex-col bg-card/30 rounded-2xl border border-border/40 p-4 min-h-0 transition-all duration-300 w-full">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold uppercase tracking-tight">Leads Pipeline</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
                {allLeads.length} Total Leads
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={generateDailyReport}
                className="h-8 border-primary/20 hover:bg-primary/5 text-primary font-bold"
              >
                <FileText className="h-4 w-4 mr-2" />
                Generate Daily Report
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchLeads} className="h-8 hover:bg-primary/5">
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 min-w-0 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">
                Loading pipeline...
              </div>
            ) : (
              <LeadsKanban
                leads={allLeads}
                onStatusChange={handleStatusChange}
                onSelectLead={handleSelectLead}
                selectedLeadId={currentLead?.id}
              />
            )}
          </div>
        </div>
      </div>

      <AfterCallSummary
        open={showACS}
        onOpenChange={setShowACS}
        leadName={currentLead?.name || ""}
        callDuration={callDuration}
      />

      <CallHistoryModal
        open={showCallHistory}
        onOpenChange={setShowCallHistory}
      />

      {/* Customer Profile Modal */}
      <Dialog open={!!selectedLeadForProfile} onOpenChange={() => setSelectedLeadForProfile(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
          <DialogTitle className="sr-only">Customer Profile</DialogTitle>
          <DialogDescription className="sr-only">
            Detailed view of the customer profile and betting habits
          </DialogDescription>
          {selectedLeadForProfile && (
            <CustomerProfile
              leadId={selectedLeadForProfile}
              onClose={() => setSelectedLeadForProfile(null)}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
