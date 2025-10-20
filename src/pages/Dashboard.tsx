import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Softphone } from "@/components/dashboard/Softphone";
import { QueueCard } from "@/components/dashboard/QueueCard";
import { AfterCallSummary } from "@/components/dashboard/AfterCallSummary";
import { AgentKPIs } from "@/components/dashboard/AgentKPIs";
import { CallHistoryModal } from "@/components/dashboard/CallHistoryModal";
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
import { useRealtimeAI } from "@/hooks/useRealtimeAI";

function DashboardContent() {
  const { user } = useAuth();
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
  
  // Real-time AI integration
  const { isConnected: aiConnected, isConnecting: aiConnecting, suggestions, connect: connectAI, disconnect: disconnectAI, sendContext } = useRealtimeAI();

  // Send context to AI when call starts or notes change
  useEffect(() => {
    if (aiConnected && currentLead && currentCallId) {
      const context = `
        Lead Information:
        - Name: ${currentLead.name}
        - Segment: ${currentLead.segment}
        - Last Activity: ${currentLead.lastActivity || 'N/A'}
        - Priority: ${currentLead.priority}
        
        Call Notes: ${callNotes || 'No notes yet'}
        
        Compliance Status:
        - Introduction: ${complianceChecked.introduction ? 'Done' : 'Pending'}
        - Data Protection: ${complianceChecked.dataProtection ? 'Done' : 'Pending'}
        - Responsible Gaming: ${complianceChecked.responsibleGaming ? 'Done' : 'Pending'}
        - Recording Consent: ${complianceChecked.recordingConsent ? 'Done' : 'Pending'}
        
        Please provide real-time suggestions for this call.
      `;
      sendContext(context);
    }
  }, [aiConnected, currentLead, currentCallId, callNotes, complianceChecked, sendContext]);

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
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          campaigns(name)
        `)
        .order('created_at', { ascending: true });

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
        campaign: lead.campaigns?.name || "No Campaign",
        campaignId: lead.campaign_id || undefined,
        priority: lead.priority as "high" | "medium" | "low",
        slaMinutes: lead.sla_minutes || 0,
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
      toast.success(`Moved to next lead: ${queueLeads[nextIndex].name}`);
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
    
    // Create a new call activity record
    try {
      const { data, error } = await supabase
        .from('call_activities')
        .insert({
          user_id: user?.id,
          lead_name: lead.name,
          phone_number: lead.phone,
          campaign_id: lead.campaignId,
          status: 'in_progress',
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
    
    // Update call end time and status
    if (currentCallId) {
      try {
        const { error } = await supabase
          .from('call_activities')
          .update({
            end_time: new Date().toISOString(),
            status: 'completed'
          })
          .eq('id', currentCallId);

        if (error) throw error;
        
        toast.success('Call notes saved');
      } catch (error) {
        console.error('[Dashboard] Error ending call:', error);
        toast.error('Failed to save call notes');
      }
    }
    
    setShowACS(true);
    setCallDuration(450); // Mock duration
    setCurrentCallId(null);
  };

  const complianceItems = [
    { key: "introduction", label: "Proper introduction & company name" },
    { key: "dataProtection", label: "Data protection notice given" },
    { key: "responsibleGaming", label: "Responsible gaming reminder" },
    { key: "recordingConsent", label: "Call recording consent obtained" }
  ];

  const allComplianceChecked = Object.values(complianceChecked).every(Boolean);

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
                  <div className="bg-accent/50 rounded-lg p-4 text-sm">
                    <h4 className="font-medium mb-2">
                      Opening Script - {currentLead?.campaign || 'Default'}
                    </h4>
                    <p className="mb-3">
                      "Hello <strong>{currentLead?.name || '[Customer Name]'}</strong>, 
                      this is Robert calling from Betsure Uganda. I hope you're having a great day! 
                      I'm calling to share an exclusive offer that's perfect for valued customers like yourself..."
                    </p>
                    
                    {currentLead?.intent && (
                      <div className="bg-primary/10 border border-primary/20 rounded p-2 mt-2">
                        <strong>Customer Intent:</strong> {currentLead.intent}
                      </div>
                    )}
                  </div>

                  {/* Compliance Checklist */}
                  <div className="space-y-3">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Compliance Checklist
                    </Label>
                    
                    <div className="space-y-2">
                      {complianceItems.map((item) => (
                        <div key={item.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={item.key}
                            checked={complianceChecked[item.key as keyof typeof complianceChecked]}
                            onCheckedChange={(checked) => 
                              setComplianceChecked(prev => ({
                                ...prev,
                                [item.key]: checked as boolean
                              }))
                            }
                          />
                          <Label 
                            htmlFor={item.key} 
                            className="text-sm cursor-pointer"
                          >
                            {item.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    
                    {allComplianceChecked && (
                      <Badge className="bg-success text-success-foreground">
                        ✓ All compliance items checked
                      </Badge>
                    )}
                  </div>
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
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  AI Sidekick
                  {aiConnected && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      <Radio className="h-3 w-3 mr-1 text-success animate-pulse" />
                      Live
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant={aiConnected ? "destructive" : "default"}
                  onClick={aiConnected ? disconnectAI : connectAI}
                  disabled={aiConnecting}
                >
                  {aiConnecting ? "Connecting..." : aiConnected ? "Disconnect AI" : "Connect AI"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!aiConnected && !aiConnecting && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-2">AI Sidekick is offline</p>
                  <p className="text-sm">Click "Connect AI" to enable real-time assistance</p>
                </div>
              )}
              
              {aiConnecting && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Connecting to AI...</p>
                </div>
              )}

              {aiConnected && suggestions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-2">Listening to call...</p>
                  <p className="text-sm">AI suggestions will appear here</p>
                </div>
              )}

              {suggestions.map((suggestion, index) => {
                const bgColor = 
                  suggestion.type === 'action' ? 'bg-primary/10 border-primary/20' :
                  suggestion.type === 'sentiment' ? 'bg-info/10 border-info/20' :
                  suggestion.type === 'compliance' ? 'bg-destructive/10 border-destructive/20' :
                  'bg-accent/10 border-accent/20';
                
                const badgeVariant = 
                  suggestion.confidence === 'high' ? 'default' :
                  suggestion.confidence === 'medium' ? 'secondary' :
                  'outline';

                return (
                  <div key={index} className={`${bgColor} border rounded-lg p-3 text-sm`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={badgeVariant} className="text-xs">
                        {suggestion.confidence} confidence
                      </Badge>
                      <span className="font-medium">{suggestion.title}</span>
                    </div>
                    <p>{suggestion.message}</p>
                  </div>
                );
              })}
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