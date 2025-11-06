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
import { Users, Target } from "lucide-react";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";

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
        .order('created_at', { ascending: false });

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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage users, agents and lead assignments</p>
          </div>
          <Button onClick={() => setShowImportModal(true)}>
            <Target className="h-4 w-4 mr-2" />
            Import Leads
          </Button>
        </div>

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
    </AdminLayout>
  );
};

export default AdminDashboard;
