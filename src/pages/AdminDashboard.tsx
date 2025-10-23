import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserPlus } from "lucide-react";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";

interface Agent {
  id: string;
  full_name: string;
  email: string;
  status: string;
  assignedLeads: number;
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
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch agents with agent role
      const { data: agentRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'agent');

      const agentIds = agentRoles?.map(r => r.user_id) || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, status')
        .in('id', agentIds)
        .eq('approved', true);

      // Count assigned leads for each agent
      const agentsWithLeads = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id);

          return {
            ...profile,
            assignedLeads: count || 0
          };
        })
      );

      setAgents(agentsWithLeads);

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
    if (!selectedAgent || selectedLeads.length === 0) {
      toast.error('Please select an agent and at least one lead');
      return;
    }

    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          user_id: selectedAgent,
          assigned_at: new Date().toISOString()
        })
        .in('id', selectedLeads);

      if (error) throw error;

      toast.success(`Assigned ${selectedLeads.length} lead(s) successfully`);
      setSelectedLeads([]);
      setSelectedAgent("");
      fetchData();
    } catch (error) {
      console.error('Error assigning leads:', error);
      toast.error('Failed to assign leads');
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage agents and lead assignments
            </p>
          </div>
          <Button onClick={() => setShowImportModal(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Import Leads
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Agents Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Active Agents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Leads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{agent.full_name}</div>
                          <div className="text-sm text-muted-foreground">{agent.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.status === 'available' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{agent.assignedLeads}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lead Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Assign Leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Agent</label>
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
                <label className="text-sm font-medium">
                  Unassigned Leads ({unassignedLeads.length})
                </label>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  {unassignedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer"
                      onClick={() => toggleLeadSelection(lead.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => {}}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {lead.phone} • {lead.segment}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleAssignLeads}
                disabled={!selectedAgent || selectedLeads.length === 0}
                className="w-full"
              >
                Assign {selectedLeads.length} Lead(s)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportLeadsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={fetchData}
      />
    </DashboardLayout>
  );
};

export default AdminDashboard;
