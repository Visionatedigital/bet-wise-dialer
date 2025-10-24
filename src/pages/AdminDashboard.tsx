import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
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
                        <TableHead className="text-right">Assigned Leads</TableHead>
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
                          <TableCell className="text-right">{agent.assignedLeads}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

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
                    onValueChange={(value) => {
                      setSelectedSegment(value);
                      // Auto-select all leads in this segment
                      const segmentLeads = unassignedLeads
                        .filter(lead => lead.segment === value)
                        .map(lead => lead.id);
                      setSelectedLeads(segmentLeads);
                    }}
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

                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Unassigned Leads</Label>
                    <span className="text-xs text-muted-foreground">
                      {selectedLeads.length} selected
                    </span>
                  </div>
                  {unassignedLeads
                    .filter(lead => selectedSegment === 'all' || lead.segment === selectedSegment)
                    .map((lead) => (
                    <div key={lead.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={lead.id}
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={(checked) => toggleLeadSelection(lead.id)}
                      />
                      <label
                        htmlFor={lead.id}
                        className="text-sm cursor-pointer flex-1 flex items-center justify-between"
                      >
                        <span>{lead.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {lead.segment}
                        </Badge>
                      </label>
                    </div>
                  ))}
                  {unassignedLeads.filter(lead => 
                    selectedSegment === 'all' || lead.segment === selectedSegment
                  ).length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No unassigned leads in this segment
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleAssignLeads}
                  disabled={!selectedAgent || selectedLeads.length === 0 || loading}
                  className="w-full"
                >
                  Assign {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''}
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
