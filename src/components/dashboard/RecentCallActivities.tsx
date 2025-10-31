import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Clock } from "lucide-react";
import { maskPhone } from "@/lib/formatters";

interface CallActivity {
  id: string;
  phone_number: string;
  lead_name: string;
  duration_seconds: number;
  notes: string;
  created_at: string;
  campaign_name: string;
  agent_name: string;
  status: string;
}

interface RecentCallActivitiesProps {
  dateRange: string;
  selectedAgent?: string;
}

export function RecentCallActivities({ dateRange, selectedAgent }: RecentCallActivitiesProps) {
  const [activities, setActivities] = useState<CallActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCallActivities();
  }, [dateRange, selectedAgent]);

  const fetchCallActivities = async () => {
    try {
      setLoading(true);

      // Calculate date filter
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Build the query
      let query = supabase
        .from('call_activities')
        .select(`
          id,
          phone_number,
          lead_name,
          duration_seconds,
          notes,
          created_at,
          status,
          user_id,
          campaign_id
        `)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter by agent if selected
      if (selectedAgent && selectedAgent !== 'all') {
        query = query.eq('user_id', selectedAgent);
      }

      const { data: callData, error: callError } = await query;

      if (callError) throw callError;

      // Fetch agent names
      const userIds = [...new Set(callData?.map(c => c.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      // Fetch campaign names
      const campaignIds = [...new Set(callData?.map(c => c.campaign_id).filter(Boolean))];
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds);

      // Map the data
      const enrichedActivities: CallActivity[] = (callData || []).map(call => {
        const agent = profiles?.find(p => p.id === call.user_id);
        const campaign = campaigns?.find(c => c.id === call.campaign_id);

        return {
          id: call.id,
          phone_number: call.phone_number || 'N/A',
          lead_name: call.lead_name || 'Unknown',
          duration_seconds: call.duration_seconds || 0,
          notes: call.notes || 'No notes',
          created_at: call.created_at,
          campaign_name: campaign?.name || 'No Campaign',
          agent_name: agent?.full_name || 'Unknown Agent',
          status: call.status || 'completed'
        };
      });

      setActivities(enrichedActivities);
    } catch (error) {
      console.error('Error fetching call activities:', error);
      toast.error('Failed to load call activities');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Recent Call Activities
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Detailed call records with notes from agents
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading call activities...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No call activities found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="text-sm">
                      {formatDate(activity.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {activity.agent_name}
                    </TableCell>
                    <TableCell>{activity.lead_name}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {maskPhone(activity.phone_number)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{activity.campaign_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(activity.duration_seconds)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={activity.notes}>
                        {activity.notes}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        activity.status === 'converted' ? 'default' :
                        activity.status === 'connected' ? 'secondary' :
                        'outline'
                      }>
                        {activity.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
