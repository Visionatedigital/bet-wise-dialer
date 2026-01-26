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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Softphone } from "@/components/dashboard/Softphone";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { toast } from "sonner";
import { safeDisplayName } from "@/lib/formatters";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { LeadsKanban } from "@/components/dashboard/LeadsKanban";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CustomerProfile } from "@/components/telemarketing/CustomerProfile";

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
        const { data, error } = await supabase
          .from('campaigns')
          .select('ai_script, suggestions')
          .eq('target_segment' as any, currentLead.segment as any)
          .eq('status' as any, 'active' as any)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const scriptData = data as any;
          setCampaignScript(scriptData.ai_script);
          setCampaignSuggestions(Array.isArray(scriptData.suggestions) ? scriptData.suggestions : []);
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
      connectAI().then(() => {
        setTimeout(() => {
          const initialContext = `New call started with lead ${currentLead?.name || 'Unknown'}. Campaign: ${currentLead?.campaign || 'Default'}`;
          sendAISnippet(initialContext);
        }, 1000);
      }).catch(err => {
        console.error('AI coach failed:', err);
        toast.error('AI suggestions unavailable');
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

      // Fetch all leads assigned to this agent
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id as any)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedLeads: Lead[] = (data || []).map(lead => ({
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
        nextActionDue: lead.next_action_due,
        campaign: lead.campaign || "No Campaign",
        priority: lead.priority as any,
        status: lead.status || 'unassigned',
        trait: lead.trait || null
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
    if (user) fetchLeads();
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
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus === 'unassigned' ? null : (newStatus as any) } as any)
        .eq('id', leadId as any);

      if (error) throw error;

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

  const saveCallNotes = async () => {
    if (!currentCallId || !callNotes.trim()) return;
    try {
      const { error } = await supabase
        .from('call_activities')
        .update({ notes: callNotes } as any)
        .eq('id' as any, currentCallId as any);
      if (error) throw error;
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
