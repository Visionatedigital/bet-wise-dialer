import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Softphone } from "@/components/dashboard/Softphone";
import { QueueCard } from "@/components/dashboard/QueueCard";
import { AfterCallSummary } from "@/components/dashboard/AfterCallSummary";
import { AgentKPIs } from "@/components/dashboard/AgentKPIs";
import { CallHistoryModal } from "@/components/dashboard/CallHistoryModal";
import { LivePitchScript } from "@/components/dashboard/LivePitchScript";
import { CallSentimentOrb } from "@/components/dashboard/CallSentimentOrb";
import { type Lead } from "@/data/sampleData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, MessageSquare, FileText, CheckSquare, Radio, History } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getCategoryFromSegment, getSequenceForCategory } from "@/data/aiScriptsMock";
import type { CallSentiment } from "@/utils/RealtimeAI";
import { safeDisplayName } from "@/lib/formatters";
import { useAgentStatus } from "@/hooks/useAgentStatus";

function DashboardContent() {
  const { user } = useAuth();
  const { updateStatus } = useAgentStatus();
  const [currentLead, setCurrentLead] = useState<Lead | null>(null);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [queueLeads, setQueueLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showACS, setShowACS] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callNotes, setCallNotes] = useState("");
  const [complianceChecked, setComplianceChecked] = useState({
    introduction: false,
    dataProtection: false,
    responsibleGaming: false,
    recordingConsent: false
  });
  const hasRestoredIndex = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [showCallHistory, setShowCallHistory] = useState(false);
  
  // Mock AI state (no realtime pipeline)
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [callSentiment, setCallSentiment] = useState<CallSentiment>('neutral');
  const suggestionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sentimentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Initialize AudioContext and set agent status to online
  useEffect(() => {
    const ctx = new AudioContext({ sampleRate: 24000 });
    setAudioContext(ctx);

    // Set agent status to online when dashboard loads
    updateStatus('online');
    console.log('[Dashboard] Agent status set to online');

    return () => {
      ctx.close();
      // Set agent status to offline when dashboard unmounts
      updateStatus('offline');
      console.log('[Dashboard] Agent status set to offline');
    };
  }, [updateStatus]);

  // Fetch campaign AI scripts
  const [campaignScript, setCampaignScript] = useState<string | null>(null);
  const [campaignSuggestions, setCampaignSuggestions] = useState<any[]>([]);

  useEffect(() => {
    const loadCampaignScript = async () => {
      if (!currentLead?.segment) return;
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('ai_script, suggestions')
        .eq('target_segment', currentLead.segment)
        .eq('status', 'active')
        .single();
      
      if (data) {
        setCampaignScript(data.ai_script);
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        setCampaignSuggestions(suggestions);
        console.log('[Dashboard] Loaded campaign script for segment:', currentLead.segment);
      }
    };

    loadCampaignScript();
  }, [currentLead?.segment]);

  // Mock sentiment and suggestions with natural call flow
  useEffect(() => {
    // Clear timers when no call
    if (!currentCallId) {
      if (suggestionTimerRef.current) clearInterval(suggestionTimerRef.current);
      if (sentimentTimerRef.current) clearInterval(sentimentTimerRef.current);
      setCallSentiment('neutral');
      setSuggestions([]);
      return;
    }

    // Get the script sequence for this customer segment
    const category = getCategoryFromSegment(currentLead?.segment || null);
    const scriptSequence = getSequenceForCategory(category);
    const callStartTime = Date.now();
    const activeTimers: NodeJS.Timeout[] = [];

    // Schedule each suggestion at its designated time
    scriptSequence.forEach((suggestion) => {
      const timer = setTimeout(() => {
        setSuggestions(prev => [
          {
            type: suggestion.type,
            confidence: suggestion.confidence,
            title: suggestion.title,
            message: suggestion.message,
            timestamp: Date.now()
          },
          ...prev
        ].slice(0, 5)); // Keep last 5 suggestions visible
      }, suggestion.delay * 1000);
      
      activeTimers.push(timer);
    });

    // Sentiment cycles naturally through call phases
    let sentimentPhase = 0;
    const sentimentPhases: CallSentiment[] = ['neutral', 'neutral', 'positive', 'neutral', 'positive'];
    
    sentimentTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - callStartTime) / 1000;
      
      // Change sentiment based on call progress
      if (elapsed < 15) {
        setCallSentiment('neutral'); // Greeting phase
      } else if (elapsed < 35) {
        setCallSentiment(sentimentPhases[sentimentPhase % sentimentPhases.length]);
        sentimentPhase++;
      } else if (elapsed < 50) {
        setCallSentiment(Math.random() > 0.5 ? 'positive' : 'neutral'); // Active engagement
      } else {
        setCallSentiment('positive'); // Closing phase
      }
    }, 3000);

    return () => {
      activeTimers.forEach(timer => clearTimeout(timer));
      if (sentimentTimerRef.current) clearInterval(sentimentTimerRef.current);
    };
  }, [currentCallId, currentLead?.segment]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  // Auto-save notes every 30 seconds
  useEffect(() => {
    if (callNotes && currentCallId) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(async () => {
        await saveCallNotes();
      }, 30000); // 30 seconds

      return () => {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
      };
    }
  }, [callNotes, currentCallId]);

  // Persist lead index whenever it changes
useEffect(() => {
  if (!user?.id) return;
  if (!hasRestoredIndex.current) return;
  console.log('[Leads] Saving currentLeadIndex to localStorage:', currentLeadIndex);
  localStorage.setItem(`lead_index_${user.id}`, currentLeadIndex.toString());
}, [currentLeadIndex, user?.id]);

// Robust restoration after leads load
useEffect(() => {
  if (!user?.id) return;
  if (hasRestoredIndex.current) return;
  if (queueLeads.length === 0) return;
  const savedIndex = localStorage.getItem(`lead_index_${user.id}`);
  const restoredIndex = savedIndex ? parseInt(savedIndex) : 0;
  const validIndex = Math.min(Math.max(0, restoredIndex), queueLeads.length - 1);
  console.log('[Leads] Restoring index after leads load:', { savedIndex, restoredIndex, validIndex, total: queueLeads.length });
  setCurrentLeadIndex(validIndex);
  setCurrentLead(queueLeads[validIndex]);
  hasRestoredIndex.current = true;
  if (savedIndex && restoredIndex === validIndex && restoredIndex > 0) {
    toast.success(`Restored position: Lead ${validIndex + 1} of ${queueLeads.length}`);
  }
}, [queueLeads, user?.id]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      
      // Fetch all leads assigned to the user
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select(`
          *,
          campaigns(name)
        `)
        .eq('user_id', user?.id as string)
        .order('created_at', { ascending: true });

      if (leadsError) throw leadsError;

      // Fetch all call activities for this user to determine which leads have been called
      const { data: callActivities, error: callError } = await supabase
        .from('call_activities')
        .select('phone_number')
        .eq('user_id', user?.id as string);

      if (callError) throw callError;

      // Create a set of phone numbers that have been called
      const calledPhones = new Set(
        (callActivities || []).map(activity => activity.phone_number)
      );

      // Filter out leads that have already been called
      const uncalledLeads = (leadsData || []).filter(
        lead => !calledPhones.has(lead.phone)
      );

      const formattedLeads: Lead[] = uncalledLeads.map(lead => ({
        id: lead.id,
        name: safeDisplayName(lead.name),
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
        campaign: lead.campaigns?.name || "No Campaign",
        campaignId: lead.campaign_id || undefined,
        priority: lead.priority as "high" | "medium" | "low",
        slaMinutes: lead.sla_minutes || 0,
        assignedAt: lead.assigned_at,
      }));

      setQueueLeads(formattedLeads);
      
      // Restore saved lead index from localStorage
      if (formattedLeads.length > 0 && !currentLead && user?.id) {
        const savedIndex = localStorage.getItem(`lead_index_${user.id}`);
        const restoredIndex = savedIndex ? parseInt(savedIndex) : 0;
        
        // Ensure the index is valid
        const validIndex = Math.min(Math.max(0, restoredIndex), formattedLeads.length - 1);
        
        console.log('[Leads] Restoring index inside fetchLeads:', { savedIndex, restoredIndex, validIndex, total: formattedLeads.length });
        setCurrentLeadIndex(validIndex);
        setCurrentLead(formattedLeads[validIndex]);
        hasRestoredIndex.current = true;
        
        if (savedIndex && restoredIndex === validIndex && restoredIndex > 0) {
          toast.success(`Restored position: Lead ${validIndex + 1} of ${formattedLeads.length}`);
        }
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleNextLead = () => {
    if (currentLeadIndex < queueLeads.length - 1) {
      const nextIndex = currentLeadIndex + 1;
      setCurrentLeadIndex(nextIndex);
      setCurrentLead(queueLeads[nextIndex]);
      toast.success(`Moved to next lead: ${safeDisplayName(queueLeads[nextIndex].name)}`);
    } else {
      toast.info("You're at the last lead");
    }
  };

  const handlePreviousLead = () => {
    if (currentLeadIndex > 0) {
      const prevIndex = currentLeadIndex - 1;
      setCurrentLeadIndex(prevIndex);
      setCurrentLead(queueLeads[prevIndex]);
      toast.success(`Moved to previous lead: ${queueLeads[prevIndex].name}`);
    } else {
      toast.info("You're at the first lead");
    }
  };

  const nextLead = queueLeads[currentLeadIndex + 1] || null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          handleNextLead();
          break;
        case 's':
          e.preventDefault();
          saveCallNotes();
          break;
        case 'c':
          e.preventDefault();
          if (nextLead) {
            handleCallLead(nextLead);
          }
          break;
        // R for record will be handled by Softphone component
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentLeadIndex, queueLeads, nextLead, currentCallId, callNotes]);

  const saveCallNotes = async () => {
    if (!currentCallId || !callNotes.trim()) return;

    try {
      const { error } = await supabase
        .from('call_activities')
        .update({ notes: callNotes })
        .eq('id', currentCallId);

      if (error) throw error;
      
      toast.success('Notes saved successfully');
      console.log('[Dashboard] Notes saved');
    } catch (error) {
      console.error('[Dashboard] Error saving notes:', error);
      toast.error('Failed to save notes');
    }
  };

  const handleCallLead = async (lead: Lead) => {
    const index = queueLeads.findIndex(l => l.id === lead.id);
    if (index !== -1) {
      setCurrentLeadIndex(index);
    }
    setCurrentLead(lead);
    setCallDuration(0);
    setCallNotes("");
    
    // Update agent status to on-call
    await updateStatus('on-call');
    
    // Create a new call activity record
    try {
      const { data, error } = await supabase
        .from('call_activities')
        .insert({
          user_id: user?.id,
          lead_name: lead.name,
          phone_number: lead.phone,
          campaign_id: lead.campaignId,
          status: 'connected',
          start_time: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentCallId(data.id);
      console.log('[Dashboard] Call activity created:', data.id);
    } catch (error) {
      console.error('[Dashboard] Error creating call activity:', error);
    }
    
    // Reset compliance checklist
    setComplianceChecked({
      introduction: false,
      dataProtection: false,
      responsibleGaming: false,
      recordingConsent: false
    });
  };

  const handleCallEnd = async () => {
    // Save final notes before showing summary
    if (currentCallId && callNotes.trim()) {
      await saveCallNotes();
    }
    
    // Update call end time, duration, and status
    if (currentCallId) {
      try {
        // Fetch the call start time to calculate duration
        const { data: callData, error: fetchError } = await supabase
          .from('call_activities')
          .select('start_time')
          .eq('id', currentCallId)
          .single();

        if (fetchError) throw fetchError;

        const endTime = new Date();
        const startTime = new Date(callData.start_time);
        const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

        const { error } = await supabase
          .from('call_activities')
          .update({
            end_time: endTime.toISOString(),
            duration_seconds: durationSeconds,
            status: 'completed'
          })
          .eq('id', currentCallId);

        if (error) throw error;
        
        setCallDuration(durationSeconds);
        toast.success('Call notes saved');
        console.log('[Dashboard] Call ended, duration:', durationSeconds, 'seconds');
      } catch (error) {
        console.error('[Dashboard] Error ending call:', error);
        toast.error('Failed to save call notes');
      }
    }
    
    // Set agent status back to online after call ends
    await updateStatus('online');
    
    setShowACS(true);
    setCurrentCallId(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
        <p className="text-muted-foreground">
          Your workspace for managing calls and leads • {new Date().toLocaleDateString('en-UG', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Africa/Kampala'
          })}
        </p>
      </div>

      {/* KPIs */}
      <AgentKPIs />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading leads...
        </div>
      ) : queueLeads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No leads available. Import leads to get started!
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Softphone & Queue */}
        <div className="lg:col-span-1 space-y-6">
          <Softphone 
            currentLead={currentLead}
            onNextLead={handleNextLead}
            onPreviousLead={handlePreviousLead}
            hasNextLead={currentLeadIndex < queueLeads.length - 1}
            hasPreviousLead={currentLeadIndex > 0}
            currentLeadPosition={currentLeadIndex + 1}
            totalLeads={queueLeads.length}
          />
          
          <QueueCard 
            nextLead={nextLead}
            queueLength={queueLeads.length}
            onCallLead={handleCallLead}
          />
          
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 rounded p-2 text-center">
                  <kbd className="bg-background px-1 rounded">N</kbd> Next Lead
                </div>
                <div className="bg-muted/50 rounded p-2 text-center">
                  <kbd className="bg-background px-1 rounded">S</kbd> Save Notes
                </div>
                <div className="bg-muted/50 rounded p-2 text-center">
                  <kbd className="bg-background px-1 rounded">R</kbd> Record
                </div>
                <div className="bg-muted/50 rounded p-2 text-center">
                  <kbd className="bg-background px-1 rounded">C</kbd> Call
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Script & AI Sidekick */}
        <div className="lg:col-span-2 space-y-6">
          {/* Script & Compliance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Live Script & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="pitch" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="pitch">Pitch</TabsTrigger>
                  <TabsTrigger value="faq">FAQ</TabsTrigger>
                  <TabsTrigger value="objections">Objections</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pitch" className="space-y-4">
                  <LivePitchScript
                    leadName={currentLead?.name || ''}
                    campaign={currentLead?.campaign || 'Default'}
                    leadIntent={currentLead?.intent}
                    isCallActive={currentCallId !== null}
                    audioContext={audioContext || undefined}
                  />
                </TabsContent>
                
                <TabsContent value="faq" className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="bg-accent/50 rounded-lg p-3">
                      <strong>Q: How do I make a deposit?</strong><br/>
                      A: You can deposit using Mobile Money (MTN, Airtel), bank transfer, or visit any of our agent locations.
                    </div>
                    <div className="bg-accent/50 rounded-lg p-3">
                      <strong>Q: What's the minimum deposit?</strong><br/>
                      A: The minimum deposit is UGX 10,000 for new customers.
                    </div>
                    <div className="bg-accent/50 rounded-lg p-3">
                      <strong>Q: How long do withdrawals take?</strong><br/>
                      A: Mobile Money withdrawals are instant. Bank transfers take 1-2 business days.
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="objections" className="space-y-4">
                  <div className="space-y-3 text-sm">
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                      <strong>Objection:</strong> "I don't have time to bet"<br/>
                      <strong>Response:</strong> "I understand you're busy! That's why our mobile app makes it quick and easy - you can place bets in under 30 seconds."
                    </div>
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                      <strong>Objection:</strong> "I'm not interested in bonuses"<br/>
                      <strong>Response:</strong> "No problem at all! Even without bonuses, we offer the best odds in Uganda and instant payouts."
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* AI Sidekick */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-warning" />
                AI Coach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="campaign" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="campaign">Campaign Script</TabsTrigger>
                  <TabsTrigger value="realtime">
                    Real-time AI
                    {suggestions.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {suggestions.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                
                {/* Campaign Script Tab */}
                <TabsContent value="campaign" className="space-y-4 mt-4">
                  {campaignScript ? (
                    <>
                      <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-4">
                        <h4 className="font-medium mb-2">Campaign Objective</h4>
                        <p className="text-sm whitespace-pre-line">{campaignScript}</p>
                      </div>
                      
                      {campaignSuggestions.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm">Key Talking Points</h4>
                          {campaignSuggestions.map((suggestion: any, index: number) => {
                            const bgColor = 
                              suggestion.type === 'action' ? 'bg-primary/10 border-primary/20' :
                              suggestion.type === 'compliance' ? 'bg-destructive/10 border-destructive/20' :
                              suggestion.type === 'info' ? 'bg-blue-50 border-blue-200' :
                              'bg-accent/10 border-accent/20';
                            
                            return (
                              <div key={index} className={`${bgColor} border rounded-lg p-3 text-sm`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {suggestion.type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Trigger: {suggestion.trigger}
                                  </span>
                                </div>
                                <p className="font-medium mt-1">{suggestion.message}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-2">No campaign script available</p>
                      <p className="text-sm">Select a lead with a campaign to see scripts</p>
                    </div>
                  )}
                </TabsContent>
                
                {/* Real-time AI Tab */}
                <TabsContent value="realtime" className="space-y-4 mt-4">
                  {/* Sentiment Orb with Suggestions */}
                  <CallSentimentOrb 
                    sentiment={callSentiment}
                    isActive={currentCallId !== null}
                    suggestions={suggestions}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Call Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Call Notes
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveCallNotes}
                    disabled={!currentCallId || !callNotes.trim()}
                  >
                    Save Now
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCallHistory(true)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    History
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Type your call notes here... (Auto-saves every 30s)"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>
                  {currentCallId ? 'Auto-saves every 30 seconds' : 'Start a call to save notes'}
                </span>
                <span>{callNotes.length} characters</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* After Call Summary Modal */}
      <AfterCallSummary
        open={showACS}
        onOpenChange={setShowACS}
        leadName={currentLead?.name || ""}
        callDuration={callDuration}
      />

      {/* Call History Modal */}
      <CallHistoryModal
        open={showCallHistory}
        onOpenChange={setShowCallHistory}
      />
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