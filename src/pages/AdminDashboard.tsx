import { useState, useEffect } from "react";
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
import { Users, Target, UserX, Upload, Download, RefreshCw, Share2 } from "lucide-react";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";
import { ImportLeadsForAgentModal } from "@/components/leads/ImportLeadsForAgentModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Agent {
  id: string;
  full_name: string;
  email: string;
  status: string;
  assignedLeads: number;
  managerId?: string | null;
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
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [numberOfLeads, setNumberOfLeads] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAgentImportModal, setShowAgentImportModal] = useState(false);
  const [requestSegment, setRequestSegment] = useState<string>('vip_dormant');
  const [requestLeadCount, setRequestLeadCount] = useState<string>('100');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncCount, setLastSyncCount] = useState<number>(0);
  const [distributing, setDistributing] = useState(false);

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

      // Build a map of today's assigned leads per agent (client-side aggregation to avoid group-by issues)
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data: leadRows, error: leadAggError } = await supabase
        .from('leads')
        .select('user_id, assigned_at')
        .not('user_id', 'is', null)
        .gte('assigned_at', start.toISOString());
      if (leadAggError) throw leadAggError;
      const leadCounts: Record<string, number> = {};
      (leadRows || []).forEach((r: any) => { if (r.user_id) leadCounts[r.user_id] = (leadCounts[r.user_id] || 0) + 1; });

      const agentsWithLeads = (monitorData || []).map((a: any) => ({
        id: a.id,
        full_name: a.full_name || a.email || 'Unknown',
        email: a.email || '',
        status: a.current_call_start ? 'on-call' : (a.status || 'offline'),
        assignedLeads: leadCounts[a.id] ?? 0,
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

  const handleAssignLeads = async () => {
    if (!selectedAgent) {
      toast.error('Please select an agent');
      return;
    }

    const numLeads = parseInt(numberOfLeads);
    if (!numLeads || numLeads <= 0) {
      toast.error('Please enter a valid number of leads');
      return;
    }

    // Filter leads by segment
    const filteredLeads = unassignedLeads.filter(lead =>
      selectedSegment === 'all' || lead.segment === selectedSegment
    );

    if (filteredLeads.length === 0) {
      toast.error('No unassigned leads available in the selected segment');
      return;
    }

    if (numLeads > filteredLeads.length) {
      toast.error(`Only ${filteredLeads.length} leads available in this segment`);
      return;
    }

    // Take the first N leads
    const leadsToAssign = filteredLeads.slice(0, numLeads).map(lead => lead.id);

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          user_id: selectedAgent,
          assigned_at: new Date().toISOString()
        })
        .in('id', leadsToAssign);

      if (error) throw error;

      toast.success(`Assigned ${numLeads} lead(s) successfully`);
      setNumberOfLeads("");
      setSelectedAgent("");
      fetchData();
    } catch (error) {
      console.error('Error assigning leads:', error);
      toast.error('Failed to assign leads');
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

      toast.success(`Successfully synced ${syncedCount} leads from BangBet`);
      fetchData(); // Refresh the dashboard
    } catch (error) {
      console.error('Error requesting leads:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast.error('Failed to request leads from BangBet - check console for details');
    } finally {
      setSyncing(false);
    }
  };

  const handleDistributeLeads = async () => {
    setDistributing(true);
    try {
      const { data, error } = await supabase.functions.invoke('distribute-leads');

      if (error) {
        console.error('Distribution error:', error);
        throw error;
      }

      const distributed = data?.distributed || 0;
      toast.success(`Successfully distributed ${distributed} leads among agents`);
      fetchData(); // Refresh the dashboard
    } catch (error: any) {
      console.error('Error distributing leads:', error);
      const errorMessage = error?.message || 'Failed to distribute leads';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setDistributing(false);
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
            <Button onClick={() => setShowImportModal(true)}>
              <Target className="h-4 w-4 mr-2" />
              Import Leads
            </Button>
          </div>
        </div>

        {/* Request New Leads Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Request New Leads from BangBet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
                className="w-full"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing from BangBet...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Request Leads
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

        <div className="grid gap-6 md:grid-cols-1">
          {/* Bulk Lead Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Bulk Assign Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Agent</Label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name} ({agent.assignedLeads} leads)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Segment</Label>
                  <Select
                    value={selectedSegment}
                    onValueChange={setSelectedSegment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose segment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Segments</SelectItem>
                      <SelectItem value="vip">VIP</SelectItem>
                      <SelectItem value="semi-active">Semi-Active</SelectItem>
                      <SelectItem value="dormant">Dormant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Number of Leads to Assign</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g., 150"
                    value={numberOfLeads}
                    onChange={(e) => setNumberOfLeads(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {unassignedLeads.filter(lead =>
                      selectedSegment === 'all' || lead.segment === selectedSegment
                    ).length} unassigned leads available in this segment
                  </p>
                </div>

                <Button
                  onClick={handleAssignLeads}
                  disabled={!selectedAgent || !numberOfLeads || loading}
                  className="w-full"
                >
                  Assign Leads
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <Button
                  onClick={() => setShowAgentImportModal(true)}
                  disabled={!selectedAgent || loading}
                  variant="outline"
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV for Selected Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportLeadsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={fetchData}
      />

      <ImportLeadsForAgentModal
        open={showAgentImportModal}
        onOpenChange={setShowAgentImportModal}
        onImportComplete={fetchData}
        agentId={selectedAgent}
        agentName={agents.find(a => a.id === selectedAgent)?.full_name || ''}
      />
    </AdminLayout>
  );
};

export default AdminDashboard;
