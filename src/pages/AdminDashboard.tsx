import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { api } from "@/integrations/supabase/client";
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

      // Fetch agent monitor data
      const monitorData = await api.get<any[]>('/monitor').catch(() => []);

      // Fetch distribution stats (lead counts & scores per agent)
      const distStats = await api.get<any>('/leads/distribution-stats').catch(() => ({ agents: [] }));
      const agentStats: Record<string, { lead_count: number; total_score: number }> = {};
      (distStats.agents || []).forEach((a: any) => {
        agentStats[a.id] = { lead_count: a.lead_count ?? 0, total_score: a.total_score ?? 0 };
      });

      const agentsWithLeads = (monitorData || []).map((a: any) => ({
        id: a.id,
        full_name: a.full_name || a.email || 'Unknown',
        email: a.email || '',
        status: a.current_call_start ? 'on-call' : (a.status || 'offline'),
        assignedLeads: agentStats[a.id]?.lead_count ?? 0,
        totalScore: agentStats[a.id]?.total_score ?? 0,
        managerId: a.manager_id,
      }));

      setAgents(agentsWithLeads);

      // Fetch managers from users endpoint
      const allUsers = await api.get<any[]>('/users').catch(() => []);
      const managerUsers = allUsers.filter((u: any) => u.roles?.includes('management') && u.approved);

      const managersWithAgents = managerUsers.map((m: any) => ({
        id: m.id,
        full_name: m.full_name || m.email || 'Unknown',
        email: m.email || '',
        assignedAgents: agentsWithLeads.filter(a => a.managerId === m.id).length,
      }));

      setManagers(managersWithAgents);

      // Fetch unassigned leads
      const leads = await api.get<any[]>('/leads/unassigned').catch(() => []);

      const formattedLeads = (leads || []).map((lead: any) => ({
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
      await api.patch(`/profiles/${agentId}`, { manager_id: managerId === 'unassign' ? null : managerId });
      toast.success('Manager assignment updated');
      fetchData();
    } catch (error) {
      console.error('Error assigning manager:', error);
      toast.error('Failed to assign manager');
    }
  };

  const handleUnassignAllLeads = async () => {
    try {
      await api.post('/leads/unassign-all');
      toast.success('All leads unassigned successfully');
      fetchData();
    } catch (error) {
      console.error('Error unassigning leads:', error);
      toast.error('Failed to unassign leads');
    }
  };

  const handleRequestLeads = async () => {
    toast.error('BangBet API sync is not available — please use the CSV/Excel import instead');
  };
  const handleDistributeLeads = async () => {
    setDistributing(true);
    try {
      const limit = requestLeadCount ? parseInt(requestLeadCount) : 10000;
      const res = await api.post<{ message: string; total_distributed: number }>('/leads/distribute', { limit });
      toast.success(res.message || `Distributed ${res.total_distributed} leads`);
      fetchData();
    } catch (error: any) {
      console.error('Error distributing leads:', error);
      toast.error(error?.message || 'Failed to distribute leads');
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
    toast.info('AI lead analysis is not available in this version');
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
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <FileUp className="h-4 w-4 mr-2" />
              Import CSV/Excel
            </Button>
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
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs bg-slate-900 text-white hover:bg-slate-800 border-none"
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
            </div>
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
                onClick={() => setShowImportModal(true)}
                variant="secondary"
                className="w-full"
              >
                <FileUp className="h-4 w-4 mr-2" />
                Import CSV/Excel
              </Button>

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
