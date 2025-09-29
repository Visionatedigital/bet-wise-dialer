import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Softphone } from "@/components/dashboard/Softphone";
import { QueueCard } from "@/components/dashboard/QueueCard";
import { AfterCallSummary } from "@/components/dashboard/AfterCallSummary";
import { AgentKPIs } from "@/components/dashboard/AgentKPIs";
import { sampleLeads, type Lead } from "@/data/sampleData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lightbulb, MessageSquare, FileText, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

function DashboardContent() {
  const [currentLead, setCurrentLead] = useState<Lead | null>(sampleLeads[0]);
  const [showACS, setShowACS] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callNotes, setCallNotes] = useState("");
  const [complianceChecked, setComplianceChecked] = useState({
    introduction: false,
    dataProtection: false,
    responsibleGaming: false,
    recordingConsent: false
  });

  // Queue management
  const queueLeads = sampleLeads.slice(1, 5); // Next 4 leads in queue
  const nextLead = queueLeads[0] || null;

  const handleCallLead = (lead: Lead) => {
    setCurrentLead(lead);
    setCallDuration(0);
    setCallNotes("");
    // Reset compliance checklist
    setComplianceChecked({
      introduction: false,
      dataProtection: false,
      responsibleGaming: false,
      recordingConsent: false
    });
  };

  const handleCallEnd = () => {
    setShowACS(true);
    setCallDuration(450); // Mock duration
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

      {/* Main Working Area */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Softphone & Queue */}
        <div className="lg:col-span-1 space-y-6">
          <Softphone currentLead={currentLead} />
          
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
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-warning" />
                AI Sidekick
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-success text-success-foreground text-xs">
                    High Confidence
                  </Badge>
                  <span className="font-medium">Next Best Action</span>
                </div>
                <p>Customer likely to ask about bonus eligibility. Prepare deposit bonus details.</p>
              </div>
              
              <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">Sentiment</Badge>
                  <span className="font-medium">Positive</span>
                </div>
                <p>Customer tone indicates interest. Good time to present offer details.</p>
              </div>

              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-destructive text-destructive-foreground text-xs">
                    Reminder
                  </Badge>
                  <span className="font-medium">Responsible Gaming</span>
                </div>
                <p>Remember to mention our responsible gaming tools and 18+ age requirement.</p>
              </div>
            </CardContent>
          </Card>

          {/* Call Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Call Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Type your call notes here... (Auto-saves)"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>Auto-saves every 30 seconds</span>
                <span>{callNotes.length} characters</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* After Call Summary Modal */}
      <AfterCallSummary
        open={showACS}
        onOpenChange={setShowACS}
        leadName={currentLead?.name || ""}
        callDuration={callDuration}
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