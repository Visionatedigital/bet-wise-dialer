import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Clock } from "lucide-react";
import { maskPhone, formatEAT } from "@/lib/formatters";
import { isRateLimitError, getRateLimitMessage } from "@/utils/rateLimitHandler";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

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
  const { user } = useAuth();
  const { isManagement, isAdmin } = useUserRole();
  const [activities, setActivities] = useState<CallActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCallActivities();
  }, [dateRange, selectedAgent, user, isManagement, isAdmin]);

  const fetchCallActivities = async () => {
    try {
      setLoading(true);

      if (!user) return;

      // Determine which user IDs to fetch data for
      let userIds: string[] = [];
      
      if (isManagement && !isAdmin && user) {
        // For managers, fetch their assigned agents
        const { data: managerAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);
        
        userIds = managerAgents?.map(a => a.id) || [];
        
        if (userIds.length === 0) {
          setActivities([]);
          setLoading(false);
          return;
        }
      } else {
        // For regular agents or admins, use their own ID
        userIds = [user.id];
      }

      // Calculate date filter - handle both numeric strings and named ranges
      const daysMap: Record<string, number> = {
        'today': 0,
        'week': 7,
        'month': 30,
        'quarter': 90,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      
      let daysAgo: number;
      if (daysMap[dateRange] !== undefined) {
        daysAgo = daysMap[dateRange];
      } else {
        const parsed = parseInt(dateRange);
        daysAgo = isNaN(parsed) ? 7 : parsed; // Default to 7 days if invalid
      }
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      
      // Validate the date before using it
      if (isNaN(startDate.getTime())) {
        console.error('[RecentCallActivities] Invalid date calculated from dateRange:', dateRange);
        toast.error('Invalid date range specified');
        return;
      }

      // Build the query - include start_time and end_time for duration calculation
      let query = supabase
        .from('call_activities')
        .select(`
          id,
          phone_number,
          lead_name,
          duration_seconds,
          notes,
          created_at,
          start_time,
          end_time,
          status,
          user_id,
          campaign_id
        `)
        .in('user_id', userIds)
        .gte('start_time', startDate.toISOString())
        .order('start_time', { ascending: false })
        .limit(50);

      // Filter by agent if selected (and ensure it's in the manager's team)
      if (selectedAgent && selectedAgent !== 'all') {
        if (isManagement && !isAdmin && !userIds.includes(selectedAgent)) {
          // Selected agent is not in manager's team
          setActivities([]);
          setLoading(false);
          return;
        }
        query = query.eq('user_id', selectedAgent);
      }

      const { data: callData, error: callError } = await query;

      if (callError) throw callError;

      // Get unique phone numbers to fetch lead data
      const phoneNumbers = [...new Set(callData?.map(c => c.phone_number).filter(Boolean))];
      
      // Fetch lead data to get real names and phone numbers
      let leadsMap = new Map();
      if (phoneNumbers.length > 0) {
        const { data: leads } = await supabase
          .from('leads')
          .select('phone, name, campaign_id')
          .in('phone', phoneNumbers);
        
        if (leads) {
          leads.forEach(lead => {
            leadsMap.set(lead.phone, lead);
          });
        }
      }

      // Fetch agent names - use agentUserIds to avoid redeclaration
      const agentUserIds = [...new Set(callData?.map(c => c.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', agentUserIds);

      // Fetch campaign names
      const campaignIds = [...new Set(callData?.map(c => c.campaign_id).filter(Boolean))];
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds);

      // Helper function to clean notes (remove session IDs)
      const cleanNotes = (notes: string | null): string => {
        if (!notes) return '';
        // Remove session IDs like "session:ATVId_..."
        let cleaned = notes.replace(/session:ATVId_[a-f0-9]+/gi, '').trim();
        // Remove multiple spaces
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        return cleaned || 'No notes';
      };

      // Helper function to calculate duration
      const calculateDuration = (call: any): number => {
        // If duration_seconds is set and > 0, use it
        if (call.duration_seconds && call.duration_seconds > 0) {
          return call.duration_seconds;
        }
        
        // Otherwise calculate from start_time and end_time
        if (call.start_time && call.end_time) {
          const start = new Date(call.start_time);
          const end = new Date(call.end_time);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
            // Ensure duration is non-negative (handle edge cases where end_time might be before start_time)
            return Math.max(0, durationSeconds);
          }
        }
        
        return 0;
      };

      // Map the data
      const enrichedActivities: CallActivity[] = (callData || []).map(call => {
        const agent = profiles?.find(p => p.id === call.user_id);
        const campaign = campaigns?.find(c => c.id === call.campaign_id);
        
        // Try to get lead data from leads table
        const lead = call.phone_number ? leadsMap.get(call.phone_number) : null;
        
        // Use lead data if available, otherwise fall back to call_activities data
        const leadName = lead?.name || call.lead_name || 'Unknown';
        const phoneNumber = call.phone_number || lead?.phone || 'N/A';
        const campaignId = call.campaign_id || lead?.campaign_id;
        const actualCampaign = campaignId ? campaigns?.find(c => c.id === campaignId) : null;
        
        // Calculate duration
        const duration = calculateDuration(call);
        
        // Clean notes
        const cleanedNotes = cleanNotes(call.notes);

        return {
          id: call.id,
          phone_number: phoneNumber,
          lead_name: leadName,
          duration_seconds: duration,
          notes: cleanedNotes,
          created_at: call.start_time || call.created_at, // Use start_time for display
          campaign_name: actualCampaign?.name || campaign?.name || 'No Campaign',
          agent_name: agent?.full_name || 'Unknown Agent',
          status: call.status || 'completed'
        };
      });

      setActivities(enrichedActivities);
    } catch (error: any) {
      console.error('Error fetching call activities:', error);
      
      // Check for rate limit errors
      const rateLimit = isRateLimitError(error);
      if (rateLimit.isRateLimit) {
        toast.error(getRateLimitMessage(rateLimit), {
          duration: 10000
        });
      } else {
        toast.error('Failed to load call activities: ' + (error?.message || 'Unknown error'));
      }
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
    // Use the centralized EAT formatter
    return formatEAT(dateString);
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
                    <TableCell className="font-medium">
                      {activity.lead_name && activity.lead_name !== 'Unknown' 
                        ? activity.lead_name 
                        : <span className="text-muted-foreground italic">Unknown</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {activity.phone_number && activity.phone_number !== 'N/A' 
                        ? maskPhone(activity.phone_number) 
                        : 'N/A'}
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
