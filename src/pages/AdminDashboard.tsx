import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Phone, Calendar, Clock, Download, RefreshCw, LogOut, Settings, UserPlus, FileUp, Trash2, Shield, Target, Brain, UserX, BadgeCheck, Share2 } from "lucide-react";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";
import { DistributionAnalysisModal } from "@/components/analytics/DistributionAnalysisModal";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Agent {
  id: string;
  full_name: string;
  email: string;
  status: string;
  assignedLeads: number;
  managerId?: string | null;
  totalScore: number;
}

interface Manager {
  id: string;
  full_name: string;
  email: string;
  assignedAgents: number;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  segment: string;
  assigned: boolean;
  user_id: string | null;
}

const AdminDashboard = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([]);

  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [requestSegment, setRequestSegment] = useState<string>('vip_dormant');
  const [requestLeadCount, setRequestLeadCount] = useState<string>('100');
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>(''); // 'fetching', 'analyzing', 'saving'
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncCount, setLastSyncCount] = useState<number>(0);
  const [distributing, setDistributing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch agent monitor data from secure function
      const { data: monitorData, error: monitorError } = await supabase.rpc('get_agent_monitor_data', {
        manager_filter: null
      });
      if (monitorError) throw monitorError;

      // Build a map of today's assigned leads per agent
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      // 1. Fetch counts & scores (Safe query - Increased limit for accurate stats)
      const { data: leadRows, error: leadAggError } = await supabase
        .from('leads')
        .select('user_id, assigned_at, lead_score')
        .not('user_id', 'is', null)
        .gte('assigned_at', start.toISOString())
        .limit(50000); // Increase limit to capture full distribution stats

      if (leadAggError) throw leadAggError;

      const leadCounts: Record<string, number> = {};
      const leadScores: Record<string, number> = {};

      (leadRows || []).forEach((r: any) => {
        if (r.user_id) {
          leadCounts[r.user_id] = (leadCounts[r.user_id] || 0) + 1;
          leadScores[r.user_id] = (leadScores[r.user_id] || 0) + (r.lead_score || 0);
        }
      });

      const agentsWithLeads = (monitorData || []).map((a: any) => ({
        id: a.id,
        full_name: a.full_name || a.email || 'Unknown',
        email: a.email || '',
        status: a.current_call_start ? 'on-call' : (a.status || 'offline'),
        assignedLeads: leadCounts[a.id] ?? 0,
        totalScore: leadScores[a.id] ?? 0,
        managerId: a.manager_id,
      }));

      setAgents(agentsWithLeads);

      // Fetch managers
      const { data: managerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'management');

      const managerIds = managerRoles?.map(r => r.user_id) || [];

      const { data: managerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', managerIds)
        .eq('approved', true);

      const managersWithAgents = (managerProfiles || []).map((m: any) => ({
        id: m.id,
        full_name: m.full_name || m.email || 'Unknown',
        email: m.email || '',
        assignedAgents: agentsWithLeads.filter(a => a.managerId === m.id).length,
      }));

      setManagers(managersWithAgents);

      // Fetch unassigned leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(10000);

      const formattedLeads = (leads || []).map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        segment: lead.segment,
        assigned: false,
        user_id: lead.user_id
      }));

      setUnassignedLeads(formattedLeads);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };



  const handleManagerAssignment = async (agentId: string, managerId: string | null) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId === 'unassign' ? null : managerId })
        .eq('id', agentId);

      if (error) throw error;

      toast.success('Manager assignment updated');
      fetchData();
    } catch (error) {
      console.error('Error assigning manager:', error);
      toast.error('Failed to assign manager');
    }
  };

  const handleUnassignAllLeads = async () => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          user_id: null,
          assigned_at: null
        })
        .not('user_id', 'is', null);

      if (error) throw error;

      toast.success('All leads unassigned successfully');
      fetchData();
    } catch (error) {
      console.error('Error unassigning leads:', error);
      toast.error('Failed to unassign leads');
    }
  };

  const handleRequestLeads = async () => {
    setSyncing(true);
    setSyncStatus('Connecting to generic API...');

    // Simulate AI steps for UX (since the edge function does it all in one go, it might be too fast to see)
    setTimeout(() => setSyncStatus('Fetching player profiles...'), 800);
    setTimeout(() => setSyncStatus('AI Analyzing betting patterns...'), 2000);
    setTimeout(() => setSyncStatus('Calculating Lead Scores...'), 3500);

    try {
      const limit = requestLeadCount ? parseInt(requestLeadCount) : 2000; // Increased to get all leads

      const { data, error } = await supabase.functions.invoke('vip-dormant-sync', {
        body: {
          segment: requestSegment,
          limit: limit
        }
      });

      if (error) throw error;

      const syncedCount = data?.players_synced || 0;
      setLastSyncTime(new Date().toISOString());
      setLastSyncCount(syncedCount);

      toast.success(`Success! Imported and AI-Analyzed ${syncedCount} leads.`);
      fetchData(); // Refresh the dashboard
    } catch (error) {
      console.error('Error requesting leads:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast.error('Failed to request leads from BangBet - check console for details');
    } finally {
      setSyncing(false);
      setSyncStatus('');
    }
  };
  const handleDistributeLeads = async () => {
    setDistributing(true);
    try {
      // Pass the requested lead count as limit if available
      const limit = requestLeadCount ? parseInt(requestLeadCount) : 10000;

      // --- CLIENT SIDE DISTRIBUTION ---
      // Since Edge Function deployment failed, we run the logic here.

      // 1. Fetch Agents (Online & Approved AND Role is 'agent')
      // First fetch online profiles
      const { data: onlineProfiles, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('approved', true)
        .eq('status', 'online');

      if (agentsError) throw agentsError;

      if (!onlineProfiles || onlineProfiles.length === 0) {
        toast.error("No online users found.");
        setDistributing(false);
        return;
      }

      // Then filter for strictly 'agent' role to avoid distributing to admins/managers
      const { data: agentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'agent')
        .in('user_id', onlineProfiles.map(p => p.id));

      const validAgentIds = new Set(agentRoles?.map(r => r.user_id) || []);
      const onlineAgents = onlineProfiles.filter(p => validAgentIds.has(p.id));

      if (onlineAgents.length === 0) {
        toast.error("No online AGENTS found (Admins/Managers excluded).");
        setDistributing(false);
        return;
      }

      // 2. Fetch Unassigned Leads (Respecting Limit)
      // Try with score first, fallback if error
      let leadsToDistribute: any[] = [];
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('id, lead_score')
          .is('user_id', null)
          .order('lead_score', { ascending: false })
          .limit(limit);

        if (error) throw error;
        leadsToDistribute = data || [];
      } catch (err) {
        console.warn("Falling back to unscored distribution", err);
        const { data } = await supabase
          .from('leads')
          .select('id')
          .is('user_id', null)
          .limit(limit);
        leadsToDistribute = data || [];
      }

      if (leadsToDistribute.length === 0) {
        toast.info("No unassigned leads found.");
        return;
      }

      // 3. Current Load Balancing
      // To ensure true fairness, we should consider *current* load, 
      // but for now we'll just distribute this batch evenly among them.
      // A more advanced version would fetch current counts first.

      // Initialize trackers
      const agentStats = onlineAgents.map(a => ({
        id: a.id,
        count: 0,
        score: 0
      }));

      const updates = leadsToDistribute.map(lead => {
        // Sort to find best candidate (Lowest Score -> Lowest Count)
        agentStats.sort((a, b) => {
          if (a.score !== b.score) return a.score - b.score;
          return a.count - b.count;
        });

        const target = agentStats[0];
        target.count++;
        target.score += (lead.lead_score || 0);

        return {
          id: lead.id,
          user_id: target.id,
          assigned_at: new Date().toISOString()
        };
      });

      // 4. Perform Updates (Batched)
      const batchSize = 50;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        await Promise.all(batch.map(u =>
          supabase.from('leads').update({ user_id: u.user_id, assigned_at: u.assigned_at }).eq('id', u.id)
        ));
      }

      toast.success(`Successfully distributed ${updates.length} leads among ${onlineAgents.length} agents`);
      fetchData(); // Refresh the dashboard
    } catch (error: any) {
      console.error('Error distributing leads:', error);
      const errorMessage = error?.message || 'Failed to distribute leads';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setDistributing(false);
    }
  };

  // Ref to control analysis loop
  const stopAnalysisRef = useRef(false);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiLogs]);

  const handleAnalyzeLeads = async () => {
    // If already analyzing, this click means STOP
    if (analyzing) {
      stopAnalysisRef.current = true;
      toast.info("Stopping analysis after current batch...");
      return;
    }

    setAnalyzing(true);
    stopAnalysisRef.current = false;
    let totalProcessed = 0;

    try {
      toast.info("Starting AI Auto-Analysis. Click again to stop.");

      while (!stopAnalysisRef.current) {
        const { data, error } = await supabase.functions.invoke('analyze-leads');

        if (error) throw error;

        if (data?.logs && Array.isArray(data.logs)) {
          console.group(`🧠 AI Batch Logs (Total so far: ${totalProcessed})`);
          data.logs.forEach((log: string) => console.log(log));
          console.groupEnd();
        }

        const count = data?.processed || 0;

        if (count === 0) {
          toast.info("Analysis Complete: No more unscored leads found.");
          break;
        }

        totalProcessed += count;
        toast.success(`AI Processed batch of ${count} leads... (Total: ${totalProcessed})`);

        // Small delay to prevent rate limiting issues and allow UI updates
        await new Promise(r => setTimeout(r, 500));
      }

      if (totalProcessed > 0) {
        toast.success(`Analysis Finished! Total analyzed: ${totalProcessed} leads.`);
        fetchData();
      } else if (stopAnalysisRef.current) {
        toast.info("Analysis stopped by user.");
      }

    } catch (error) {
      console.error('Error analyzing leads:', error);
      toast.error('Failed to analyze leads');
    } finally {
      setAnalyzing(false);
      stopAnalysisRef.current = false;
    }
  };

  const [verifyingDeposits, setVerifyingDeposits] = useState(false);

  const handleVerifyDeposits = async () => {
    setVerifyingDeposits(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-player-deposits');
      if (error) throw error;

      if (data?.success) {
        const msg = `Found ${data.deposits_found} deposits from ${data.verified_count} checked calls! (Probable Rev: ${data.conversion_rate}%)`;
        toast.success(msg);
        if (data.deposits_found > 0) fetchData(); // Refresh stats
      } else {
        toast.info(data?.message || "Verification completed");
      }
    } catch (err) {
      console.error("Verification failed:", err);
      toast.error("Failed to verify deposits");
    } finally {
      setVerifyingDeposits(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage users, agents and lead assignments</p>
          </div>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <UserX className="h-4 w-4 mr-2" />
                  Unassign All Leads
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unassign all leads?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all lead assignments from all agents. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnassignAllLeads}>
                    Unassign All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Request New Leads Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Request New Leads <Badge variant="secondary" className="ml-2 bg-purple-100 text-purple-700 hover:bg-purple-100"><Brain className="w-3 h-3 mr-1" /> AI Active</Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-xs bg-slate-900 text-white hover:bg-slate-800 border-none"
              onClick={handleAnalyzeLeads}
            >
              {analyzing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  Stop Analysis
                </>
              ) : (
                <>
                  <Brain className="h-3 w-3 mr-1" />
                  Analyze Existing Leads
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">

              {/* AI Live Logs */}
              {aiLogs.length > 0 && (
                <div className="bg-slate-950 text-green-400 font-mono text-xs p-4 rounded-md h-48 overflow-y-auto mb-4 border border-slate-800 shadow-inner">
                  <div className="flex items-center gap-2 text-slate-400 mb-2 border-b border-slate-800 pb-2">
                    <Brain className="w-3 h-3" />
                    <span>AI Analysis Terminal</span>
                    {analyzing && <span className="animate-pulse ml-auto">● Processing...</span>}
                  </div>
                  <div className="space-y-1">
                    {aiLogs.map((log, i) => (
                      <div key={i} className="break-words">
                        <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Select Segment</Label>
                  <Select value={requestSegment} onValueChange={setRequestSegment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vip_dormant">VIP Dormant (14-30 days inactive)</SelectItem>
                      <SelectItem value="aviator_only">Aviator Only Players</SelectItem>
                      <SelectItem value="casino_only">Casino Only Players</SelectItem>
                      <SelectItem value="sportsbook_only">Sportsbook Only Players</SelectItem>
                      <SelectItem value="inactive_14_days">Inactive 14+ Days</SelectItem>
                      <SelectItem value="low_balance">Low Balance Players</SelectItem>
                      <SelectItem value="high_value">High Value Players</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Number of Leads (optional)</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Leave empty to fetch all available"
                    value={requestLeadCount}
                    onChange={(e) => setRequestLeadCount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    If not specified, all available leads for the selected segment will be imported
                  </p>
                </div>
              </div>

              <Button
                onClick={handleRequestLeads}
                disabled={syncing}
                className="w-full relative overflow-hidden"
              >
                {syncing ? (
                  <div className="flex items-center gap-2 animate-pulse">
                    <Brain className="h-4 w-4 animate-bounce text-purple-200" />
                    <span>{syncStatus || 'Processing...'}</span>
                  </div>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Request & Analyze Leads
                  </>
                )}
              </Button>

              <Button
                onClick={handleDistributeLeads}
                disabled={distributing}
                variant="outline"
                className="w-full"
              >
                {distributing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Distributing...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Distribute Leads to Agents
                  </>
                )}
              </Button>

              {lastSyncTime && (
                <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                  Last sync: {new Date(lastSyncTime).toLocaleString()} • {lastSyncCount} leads imported
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Active Agents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Agents
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                  onClick={() => setShowAnalysisModal(true)}
                >
                  <Brain className="w-3 h-3 mr-1" />
                  Analyze Distribution with AI
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead className="text-right">Total Score (AI)</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.map((agent) => (
                        <TableRow key={agent.id}>
                          <TableCell className="font-medium">{agent.full_name}</TableCell>
                          <TableCell>
                            <Badge
                              variant={agent.status === 'online' ? 'default' : 'secondary'}
                              className={agent.status === 'online' ? 'bg-green-500' : ''}
                            >
                              {agent.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={agent.managerId || 'unassign'}
                              onValueChange={(value) => handleManagerAssignment(agent.id, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Assign manager" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassign">Unassigned</SelectItem>
                                {managers.map((manager) => (
                                  <SelectItem key={manager.id} value={manager.id}>
                                    {manager.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {agent.totalScore > 0 ? (
                              <Badge variant="outline" className="border-purple-200 text-purple-700">
                                {agent.totalScore.toLocaleString()} pts
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{agent.assignedLeads}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Managers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Managers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Manager</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Assigned Agents</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managers.map((manager) => (
                        <TableRow key={manager.id}>
                          <TableCell className="font-medium">{manager.full_name}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{manager.email}</TableCell>
                          <TableCell className="text-right">{manager.assignedAgents}</TableCell>
                        </TableRow>
                      ))}
                      {managers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No managers found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>


      </div>

      <ImportLeadsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={fetchData}
      />

      <DistributionAnalysisModal
        open={showAnalysisModal}
        onOpenChange={setShowAnalysisModal}
        agents={agents.map(a => ({
          id: a.id,
          name: a.full_name,
          assignedLeads: a.assignedLeads,
          totalScore: a.totalScore,
          status: a.status
        }))}
      />


    </AdminLayout>
  );
};

export default AdminDashboard;
