import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, Sparkles, FileText, FileSpreadsheet, File } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { IParagraphOptions } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

interface ExportReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: string;
  selectedAgent: string;
}

interface AgentOption {
  id: string;
  name: string;
  email: string;
}

// Helper function to format date and time for Excel export (in EAT - Africa/Kampala timezone)
const formatDateForExport = (dateString: string) => {
  const callDate = new Date(dateString);
  // Format date as YYYY-MM-DD for better Excel compatibility (in EAT timezone)
  const formattedDate = callDate.toLocaleDateString('en-CA', { 
    timeZone: 'Africa/Kampala',
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }) || callDate.toISOString().split('T')[0];
  // Format time as HH:MM:SS (in EAT timezone)
  const formattedTime = callDate.toLocaleTimeString('en-US', { 
    timeZone: 'Africa/Kampala',
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  }) || callDate.toTimeString().split(' ')[0];
  return { formattedDate, formattedTime };
};

export function ExportReportModal({ open, onOpenChange, dateRange, selectedAgent: initialSelectedAgent }: ExportReportModalProps) {
  const { user } = useAuth();
  const { isManagement, isAdmin } = useUserRole();
  const [verbosity, setVerbosity] = useState("balanced");
  const [focusArea, setFocusArea] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(initialSelectedAgent);
  const [availableAgents, setAvailableAgents] = useState<AgentOption[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [reportType, setReportType] = useState<"summary" | "excel">("summary");
  const [fileType, setFileType] = useState<"docx" | "xlsx" | "pdf" | "csv">("csv");

  // Update selectedAgent when initialSelectedAgent changes
  useEffect(() => {
    setSelectedAgent(initialSelectedAgent);
  }, [initialSelectedAgent]);

  // Fetch available agents when modal opens (for managers/admins)
  useEffect(() => {
    if (open && (isManagement || isAdmin)) {
      fetchAvailableAgents();
    } else if (open && user) {
      // For regular agents, just set their own ID
      setAvailableAgents([{
        id: user.id,
        name: user.email || 'You',
        email: user.email || ''
      }]);
      setSelectedAgent(user.id);
    }
  }, [open, isManagement, isAdmin, user, initialSelectedAgent]);

  const fetchAvailableAgents = async () => {
    setLoadingAgents(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, manager_id')
        .eq('approved', true);

      // If manager, only show their team agents
      if (isManagement && !isAdmin && user) {
        query = query.eq('manager_id', user.id);
      }
      // If admin, show all agents
      // Otherwise, query will fetch all approved agents

      const { data: profiles, error } = await query;

      if (error) throw error;

      const agents: AgentOption[] = (profiles || []).map(p => ({
        id: p.id,
        name: p.full_name || p.email || 'Unknown',
        email: p.email || ''
      }));

      setAvailableAgents(agents);
      
      // If initial selected agent is not in the list, default to "all"
      if (initialSelectedAgent !== 'all' && !agents.find(a => a.id === initialSelectedAgent)) {
        setSelectedAgent('all');
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents list');
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      // Calculate date range - use same logic as Performance.tsx for consistency
      let startDate: Date;
      let endDate: Date;
      
      if (dateRange === 'month') {
        startDate = new Date();
        startDate.setDate(1); // First day of current month
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'today') {
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      } else {
        const daysMap: Record<string, number> = {
          'week': 7,
          'quarter': 90,
          '7d': 7,
          '30d': 30,
          '90d': 90
        };
        const daysAgo = daysMap[dateRange] || 30;
        startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      }

      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date range specified');
      }
      
      console.log('[ExportReportModal] Date range:', {
        dateRange,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateLocal: startDate.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }),
        endDateLocal: endDate.toLocaleString('en-US', { timeZone: 'Africa/Kampala' })
      });

      let callActivities: any[] = [];
      let profiles: any[] = [];
      let campaigns: any[] = [];

      // Fetch real call activities with filters - use start_time for date filtering
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
            deposit_amount,
            user_id,
            campaign_id,
            call_type
        `)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: false })
        .range(0, 99999); // Fetch up to 100,000 records to include ALL calls in reports

      // For managers, filter to only show their assigned agents' calls
      if (isManagement && !isAdmin && user) {
        // First, get the list of agent IDs assigned to this manager
        const { data: managerAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);
        
        const managerAgentIds = managerAgents?.map(a => a.id) || [];
        
        if (managerAgentIds.length === 0) {
          toast.error('No agents assigned to your team. Please contact admin to assign agents.');
          setIsGenerating(false);
          return;
        }
        
        // Filter calls to only those from assigned agents
        if (selectedAgent !== 'all') {
          // Ensure selected agent is actually assigned to this manager
          if (!managerAgentIds.includes(selectedAgent)) {
            toast.error('Selected agent is not assigned to your team');
            setIsGenerating(false);
            return;
          }
          query = query.eq('user_id', selectedAgent);
        } else {
          // Show all calls from assigned agents
          query = query.in('user_id', managerAgentIds);
        }
      } else if (selectedAgent !== 'all') {
        query = query.eq('user_id', selectedAgent);
      }

      const { data: fetchedCalls, error: fetchError } = await query;
      if (fetchError) {
        console.error('Error fetching call activities:', fetchError);
        throw new Error(`Failed to fetch call data: ${fetchError.message || 'Unknown error'}`);
      }

      if (!fetchedCalls || fetchedCalls.length === 0) {
        toast.error('No call activities found for the selected period');
        return;
      }

      // Filter out calls without required data (at minimum need user_id)
      callActivities = fetchedCalls.filter(call => call.user_id);
      
      // Additional date filtering to ensure we only include calls from the selected date range
      // This matches the logic in Performance.tsx exactly
      callActivities = callActivities.filter((call: any) => {
        if (!call.start_time && !call.created_at) return false;
        const callDate = new Date(call.start_time || call.created_at);
        return callDate >= startDate && callDate <= endDate;
      });
      
      console.log('[ExportReportModal] Filtered calls:', {
        fetchedCount: fetchedCalls.length,
        afterDateFilter: callActivities.length,
        dateRange,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Fetch agent names separately
      const userIds = [...new Set(callActivities.map(c => c.user_id).filter(Boolean))];
      const { data: fetchedProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      profiles = fetchedProfiles || [];

      // Fetch campaign names separately
      const campaignIds = [...new Set(callActivities.map(c => c.campaign_id).filter(Boolean))];
      const { data: fetchedCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds);
      campaigns = fetchedCampaigns || [];

      // Deduplication function: Groups calls by (user_id, phone_number) and removes duplicates within 10 minutes
      // Priority: converted > connected > longest duration > most recent
      const deduplicateAllCalls = (calls: any[]): any[] => {
        if (!calls || calls.length === 0) return [];
        
        const callGroups = new Map<string, any[]>();
        
        calls.forEach((call) => {
          const key = `${call.user_id}_${call.phone_number || 'unknown'}`;
          if (!callGroups.has(key)) {
            callGroups.set(key, []);
          }
          callGroups.get(key)!.push(call);
        });

        const deduplicated: any[] = [];
        const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

        callGroups.forEach((group) => {
          if (group.length === 1) {
            deduplicated.push(group[0]);
            return;
          }

          group.sort((a, b) => {
            const timeA = new Date(a.start_time || a.created_at).getTime();
            const timeB = new Date(b.start_time || b.created_at).getTime();
            return timeA - timeB;
          });

          let lastKeptCall: any = null;
          
          group.forEach((call) => {
            const callTime = new Date(call.start_time || call.created_at).getTime();
            
            if (!lastKeptCall) {
              lastKeptCall = call;
              deduplicated.push(call);
              return;
            }

            const lastKeptTime = new Date(lastKeptCall.start_time || lastKeptCall.created_at).getTime();
            const timeDiff = callTime - lastKeptTime;

            if (timeDiff > DEDUP_WINDOW_MS) {
              lastKeptCall = call;
              deduplicated.push(call);
            } else {
              const shouldReplace = 
                (call.status === 'converted' && lastKeptCall.status !== 'converted') ||
                (call.status === 'connected' && lastKeptCall.status !== 'connected' && lastKeptCall.status !== 'converted') ||
                (call.status === lastKeptCall.status && 
                 (Number(call.duration_seconds) || 0) > (Number(lastKeptCall.duration_seconds) || 0)) ||
                (call.status === lastKeptCall.status && 
                 (Number(call.duration_seconds) || 0) === (Number(lastKeptCall.duration_seconds) || 0) &&
                 callTime > lastKeptTime);

              if (shouldReplace) {
                const index = deduplicated.indexOf(lastKeptCall);
                if (index > -1) {
                  deduplicated.splice(index, 1);
                }
                lastKeptCall = call;
                deduplicated.push(call);
              }
            }
          });
        });

        return deduplicated;
      };

      // Helper function to clean notes (remove session IDs)
      const cleanNotes = (notes: string | null | undefined): string => {
        if (!notes) return 'No remarks';
        // Remove session IDs like "session:ATVId_..." (case insensitive, handles various formats)
        let cleaned = notes.replace(/session:ATVId_[a-f0-9]+/gi, '').trim();
        // Also remove standalone session IDs without "session:" prefix
        cleaned = cleaned.replace(/ATVId_[a-f0-9]+/gi, '').trim();
        // Remove multiple spaces and clean up
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        // Remove leading/trailing punctuation that might be left behind (colons, spaces, hyphens)
        cleaned = cleaned.replace(/^[:\\s-]+|[:\\s-]+$/g, '').trim();
        return cleaned || 'No remarks';
      };

      // Enrich call activities with agent and campaign names
      let enrichedCallActivities = callActivities.map(call => ({
        ...call,
        profiles: profiles?.find(p => p.id === call.user_id) || null,
        campaigns: campaigns?.find(c => c.id === call.campaign_id) || null,
        // Clean notes to remove session IDs
        notes: cleanNotes(call.notes)
      }));

      // Apply deduplication: one number = one call count per agent
      const beforeDedupCount = enrichedCallActivities.length;
      enrichedCallActivities = deduplicateAllCalls(enrichedCallActivities);
      const afterDedupCount = enrichedCallActivities.length;
      
      console.log('[ExportReportModal] Deduplication:', {
        beforeDedup: beforeDedupCount,
        afterDedup: afterDedupCount,
        removed: beforeDedupCount - afterDedupCount
      });

      // Generate AI report (only for summary reports)
      let reportText = '';
      
      // Calculate team-wide metrics for context (needed for both report types)
      const teamTotalCalls = enrichedCallActivities.length;
      // Only count calls that actually rang and were answered (duration > 0 OR status is converted)
      const teamConnects = enrichedCallActivities.filter(c => {
        if (c.status === 'converted') return true;
        if (c.status === 'connected') {
          return (Number(c.duration_seconds) || 0) > 0;
        }
        return false;
      }).length;
      const teamConversions = enrichedCallActivities.filter(c => c.status === 'converted').length;
      const teamTotalDuration = enrichedCallActivities.reduce((sum, c) => sum + (Number(c.duration_seconds) || 0), 0);
      const teamAvgHandleTime = teamTotalCalls > 0 ? Math.round(teamTotalDuration / teamTotalCalls) : 0;
      
      // Calculate calls per hour for team
      const daysMapForWorkingHours: Record<string, number> = {
        'today': 1,
        'week': 7,
        'month': 30,
        'quarter': 90,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      const days = daysMapForWorkingHours[dateRange] || 30;
      const workingHoursPerDay = 8;
      const totalWorkingHours = days * workingHoursPerDay;
      const teamCallsPerHour = totalWorkingHours > 0 ? (teamTotalCalls / totalWorkingHours).toFixed(1) : '0.0';

      if (reportType === 'summary') {
        // Generate AI report for summary reports
        console.log(`[ExportReportModal] Generating AI report for ${enrichedCallActivities.length} calls`);
        
        const { data, error } = await supabase.functions.invoke('generate-ai-report', {
          body: {
            callActivities: enrichedCallActivities.slice(0, 500), // Limit to 500 calls to prevent payload size issues
            dateRange,
            verbosity,
            focusArea,
            teamMetrics: selectedAgent === 'all' ? {
              totalCalls: teamTotalCalls,
              callsPerHour: parseFloat(teamCallsPerHour),
              avgHandleTime: teamAvgHandleTime,
              connectRate: teamTotalCalls > 0 ? ((teamConnects / teamTotalCalls) * 100).toFixed(1) : '0.0',
              conversionRate: teamConnects > 0 ? ((teamConversions / teamConnects) * 100).toFixed(1) : '0.0'
            } : undefined
          }
        });

        if (error) {
          console.error('[ExportReportModal] Edge function error:', error);
          // Extract more detailed error message from the error object
          const errorMessage = error.message || error.error || 'Failed to generate report';
          const errorDetails = error.context || error.details;
          throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
        }

        if (!data || !data.report) {
          console.error('[ExportReportModal] No report data returned:', data);
          throw new Error('No report data returned from server');
        }

        reportText = data.report;
      } else {
        // For Excel reports, we'll generate the reportText later
        reportText = '';
      }

      // Calculate agent-specific KPIs if a specific agent is selected
      let agentKPIs: any = null;
      let agentProfile: any = null;
      let enrichedAgentCalls: any[] = []; // Store deduplicated agent calls for use in sortedCalls
      
      if (selectedAgent !== 'all') {
        agentProfile = profiles?.find(p => p.id === selectedAgent);
        
        // Filter agent calls BEFORE deduplication (same as Performance.tsx)
        const agentCallsBeforeDedup = callActivities.filter(c => c.user_id === selectedAgent);
        
        // Apply deduplication to agent calls only (same logic as Performance.tsx)
        const deduplicatedAgentCalls = deduplicateAllCalls(agentCallsBeforeDedup);
        
        // Enrich deduplicated agent calls with profile info
        // Also clean notes to remove session IDs
        enrichedAgentCalls = deduplicatedAgentCalls.map(call => ({
          ...call,
          profiles: profiles?.find(p => p.id === call.user_id) || null,
          campaigns: campaigns?.find(c => c.id === call.campaign_id) || null,
          // Clean notes to remove session IDs
          notes: cleanNotes(call.notes)
        }));
        
        console.log('[ExportReportModal] Agent KPIs calculation:', {
          selectedAgent,
          agentName: agentProfile?.full_name,
          beforeDedup: agentCallsBeforeDedup.length,
          afterDedup: deduplicatedAgentCalls.length,
          dateRange
        });
        
        // Total calls = all deduplicated call attempts (one per phone number)
        const totalCalls = deduplicatedAgentCalls.length;
        
        // Connects = only calls that actually rang and were answered (duration > 0 OR status is converted)
        const connects = deduplicatedAgentCalls.filter(c => {
          if (c.status === 'converted') return true;
          if (c.status === 'connected') {
            return (Number(c.duration_seconds) || 0) > 0;
          }
          return false;
        }).length;
        
        const conversions = deduplicatedAgentCalls.filter(c => c.status === 'converted').length;
        const totalRevenue = deduplicatedAgentCalls.reduce((sum, c) => sum + (Number(c.deposit_amount) || 0), 0);
        
        // Calculate average handle time only from connected calls (those with duration > 0)
        const connectedCallsWithDuration = deduplicatedAgentCalls.filter(c => {
          if (c.status === 'converted') return true;
          if (c.status === 'connected') {
            return (Number(c.duration_seconds) || 0) > 0;
          }
          return false;
        });
        const totalDuration = connectedCallsWithDuration.reduce((sum, c) => sum + (Number(c.duration_seconds) || 0), 0);
        const avgHandleTime = connects > 0 ? Math.round(totalDuration / connects) : 0;
        
        const connectRate = totalCalls > 0 ? ((connects / totalCalls) * 100).toFixed(1) : '0.0';
        const conversionRate = connects > 0 ? ((conversions / connects) * 100).toFixed(1) : '0.0';
        
        // Calculate calls per hour
        // Get date range to calculate working hours
        const daysMapForAgentKPIs: Record<string, number> = {
          'today': 1,
          'week': 7,
          'month': 30,
          'quarter': 90,
          '7d': 7,
          '30d': 30,
          '90d': 90
        };
        const days = daysMapForAgentKPIs[dateRange] || 30;
        const workingHoursPerDay = 8; // Assuming 8-hour work days
        const totalWorkingHours = days * workingHoursPerDay;
        const callsPerHour = totalWorkingHours > 0 ? (totalCalls / totalWorkingHours).toFixed(1) : '0.0';
        
        // Format average handle time
        const formatDuration = (seconds: number) => {
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        agentKPIs = {
          agentName: agentProfile?.full_name || 'Unknown Agent',
          email: agentProfile?.email || '',
          totalCalls,
          connects,
          conversions,
          connectRate: parseFloat(connectRate),
          conversionRate: parseFloat(conversionRate),
          totalRevenue,
          avgHandleTime: formatDuration(avgHandleTime),
          avgHandleTimeSeconds: avgHandleTime,
          callsPerHour: parseFloat(callsPerHour)
        };
      }

      // Parse the report text into paragraphs (only for summary reports)
      const paragraphs: Paragraph[] = [];

      // Only generate paragraphs for summary reports
      if (reportType === 'summary') {
        // Title
        const reportTitle = selectedAgent !== 'all' && agentKPIs
          ? `Agent Performance Report - ${agentKPIs.agentName}`
          : "Call Center Performance Report";
        
        paragraphs.push(
        new Paragraph({
          text: reportTitle,
          heading: HeadingLevel.TITLE,
          spacing: { after: 200 },
        })
      );

      // Date range and generation info
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Period: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      if (selectedAgent !== 'all' && agentKPIs) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Agent: ${agentKPIs.agentName} (${agentKPIs.email})`,
                bold: true,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala' })}`,
              italics: true,
            }),
          ],
          spacing: { after: 400 },
        })
      );

      // Add Agent KPI Section if specific agent is selected
      if (selectedAgent !== 'all' && agentKPIs) {
        paragraphs.push(
          new Paragraph({
            text: "Key Performance Indicators (KPIs)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 200 },
          })
        );

        // KPI Table-like structure using paragraphs
        const kpiItems = [
          { label: "Total Calls Made", value: agentKPIs.totalCalls.toString(), target: "60 calls/day" },
          { label: "Calls Per Hour", value: agentKPIs.callsPerHour.toFixed(1), target: "7.5 calls/hour target" },
          { label: "Connects", value: agentKPIs.connects.toString(), target: "40 connects/day" },
          { label: "Connect Rate", value: `${agentKPIs.connectRate}%`, target: "70% target" },
          { label: "Conversions", value: agentKPIs.conversions.toString(), target: "12 conversions/day" },
          { label: "Conversion Rate (Conversation Rate)", value: `${agentKPIs.conversionRate}%`, target: "25% target" },
          { label: "Total Revenue", value: `UGX ${agentKPIs.totalRevenue.toLocaleString()}`, target: "Revenue generated" },
          { label: "Average Handle Time", value: agentKPIs.avgHandleTime, target: "Optimal: 3-5 min" },
        ];

        for (const kpi of kpiItems) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${kpi.label}: `,
                  bold: true,
                }),
                new TextRun({
                  text: kpi.value,
                }),
                new TextRun({
                  text: ` (Target: ${kpi.target})`,
                  italics: true,
                  color: "666666",
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }

        // Performance summary
        paragraphs.push(
          new Paragraph({
            text: "Performance Summary",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          })
        );

        const performanceSummary = [];
        if (agentKPIs.totalCalls >= 60) {
          performanceSummary.push("✓ Exceeded daily call target");
        } else {
          performanceSummary.push(`⚠ Call volume below target (${agentKPIs.totalCalls}/60 calls)`);
        }

        if (agentKPIs.callsPerHour >= 7.5) {
          performanceSummary.push("✓ Excellent calls per hour rate");
        } else if (agentKPIs.callsPerHour >= 5.0) {
          performanceSummary.push(`⚠ Calls per hour below target (${agentKPIs.callsPerHour.toFixed(1)}/7.5 calls/hour)`);
        } else {
          performanceSummary.push(`⚠ Low calls per hour, improve productivity (${agentKPIs.callsPerHour.toFixed(1)}/7.5 calls/hour)`);
        }

        if (agentKPIs.connectRate >= 70) {
          performanceSummary.push("✓ Excellent connect rate");
        } else if (agentKPIs.connectRate >= 50) {
          performanceSummary.push("⚠ Connect rate below target, consider improving call timing");
        } else {
          performanceSummary.push("⚠ Low connect rate, review lead quality and calling strategy");
        }

        if (agentKPIs.conversionRate >= 25) {
          performanceSummary.push("✓ Strong conversion (conversation) rate performance");
        } else if (agentKPIs.conversionRate >= 15) {
          performanceSummary.push("⚠ Conversion rate below target, focus on closing techniques");
        } else {
          performanceSummary.push("⚠ Low conversion rate, requires coaching on sales techniques");
        }

        // Check average handle time
        const avgHandleMinutes = Math.floor(agentKPIs.avgHandleTimeSeconds / 60);
        if (avgHandleMinutes >= 3 && avgHandleMinutes <= 5) {
          performanceSummary.push("✓ Optimal average handle time");
        } else if (avgHandleMinutes < 3) {
          performanceSummary.push("⚠ Average handle time too short, may indicate rushed calls");
        } else {
          performanceSummary.push("⚠ Average handle time too long, focus on efficiency");
        }

        for (const summary of performanceSummary) {
          paragraphs.push(
            new Paragraph({
              text: summary,
              bullet: {
                level: 0,
              },
              spacing: { after: 100 },
            })
          );
        }

        paragraphs.push(
          new Paragraph({
            text: "Detailed Call Log",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          })
        );

        // Add call log table
        // Sort calls by date (most recent first)
        // For agent-specific reports, use the deduplicated agent calls we calculated above
        let sortedCallsForSummary;
        if (selectedAgent !== 'all' && enrichedAgentCalls.length > 0) {
          // Use the deduplicated agent calls we calculated for KPIs
          sortedCallsForSummary = enrichedAgentCalls
            .sort((a, b) => new Date(b.start_time || b.created_at).getTime() - new Date(a.start_time || a.created_at).getTime())
            .slice(0, 100); // Limit to 100 most recent calls to keep document size manageable
        } else {
          // For team reports, use all enriched calls
          sortedCallsForSummary = enrichedCallActivities
            .filter(call => selectedAgent === 'all' || call.user_id === selectedAgent)
            .sort((a, b) => new Date(b.start_time || b.created_at).getTime() - new Date(a.start_time || a.created_at).getTime())
            .slice(0, 100); // Limit to 100 most recent calls to keep document size manageable
        }
        const sortedCalls = sortedCallsForSummary;

        if (sortedCalls.length > 0) {
          paragraphs.push(
            new Paragraph({
              text: `This section contains ${sortedCalls.length} call records with agent names, phone numbers called, and remarks.`,
              spacing: { after: 200 },
            })
          );

          // Group calls by date for better organization
          const callsByDate = new Map<string, typeof sortedCalls>();
          sortedCalls.forEach(call => {
            const date = new Date(call.start_time).toLocaleDateString('en-US', { 
              timeZone: 'Africa/Kampala',
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            });
            if (!callsByDate.has(date)) {
              callsByDate.set(date, []);
            }
            callsByDate.get(date)!.push(call);
          });

          // Add calls grouped by date
          Array.from(callsByDate.entries()).forEach(([date, calls]) => {
            paragraphs.push(
              new Paragraph({
                text: date,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              })
            );

            calls.forEach((call, index) => {
              const agentName = call.profiles?.full_name || 'Unknown Agent';
              const phoneNumber = call.phone_number || 'N/A';
              const remarks = call.notes || 'No remarks';
              const leadName = call.lead_name || 'Unknown Lead';
              const status = call.status || 'unknown';
              const duration = call.duration_seconds 
                ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}`
                : '0:00';
              const callTime = new Date(call.start_time).toLocaleTimeString('en-US', { 
                timeZone: 'Africa/Kampala',
                hour: '2-digit', 
                minute: '2-digit' 
              });

              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Call ${index + 1}: `,
                      bold: true,
                    }),
                    new TextRun({
                      text: `${callTime} - ${agentName} called ${phoneNumber} (${leadName})`,
                    }),
                  ],
                  spacing: { after: 50 },
                })
              );

              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Status: ${status.charAt(0).toUpperCase() + status.slice(1)} | Duration: ${duration} | `,
                      italics: true,
                      color: "666666",
                    }),
                    new TextRun({
                      text: `Remarks: ${remarks}`,
                    }),
                  ],
                  spacing: { after: 100 },
                  indent: { left: 400 },
                })
              );
            });
          });
        } else {
          paragraphs.push(
            new Paragraph({
              text: "No call records found for the selected period.",
              spacing: { after: 200 },
            })
          );
        }

        paragraphs.push(
          new Paragraph({
            text: "AI Analysis & Insights",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          })
        );
      }

      // Split report into sections and paragraphs
      const lines = reportText.split('\n').filter(line => line.trim().length > 0);
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Check if it's a section header (ends with : or is a numbered section)
        if (trimmedLine.endsWith(':') && trimmedLine.length < 80) {
          paragraphs.push(
            new Paragraph({
              text: trimmedLine,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 200 },
            })
          );
        } else if (/^\d+\.\s/.test(trimmedLine) && trimmedLine.length < 100) {
          // Numbered section (e.g., "1. Executive Summary")
          paragraphs.push(
            new Paragraph({
              text: trimmedLine,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 150 },
            })
          );
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
          // Bullet point
          paragraphs.push(
            new Paragraph({
              text: trimmedLine.substring(2),
              bullet: {
                level: 0,
              },
              spacing: { after: 100 },
            })
          );
        } else {
          // Regular paragraph
          paragraphs.push(
            new Paragraph({
              text: trimmedLine,
              spacing: { after: 150 },
            })
          );
        }
      }
      } // End of if (reportType === 'summary') for paragraph generation

      // Generate file based on selected type
      const agentSuffix = selectedAgent !== 'all' && agentKPIs 
        ? `-${agentKPIs.agentName.replace(/\s+/g, '-')}` 
        : '';
      const dateStr = new Date().toISOString().split('T')[0];
      let blob: Blob;
      let fileName: string;

      // Prepare sorted calls data - shared between preview and download to ensure consistency
      // Prepare sorted calls data - shared between preview and download to ensure consistency
      // For agent-specific reports, use the deduplicated agent calls we calculated above
      let sortedCalls;
      if (selectedAgent !== 'all' && enrichedAgentCalls.length > 0) {
        // Use the deduplicated agent calls we calculated for KPIs
        sortedCalls = enrichedAgentCalls
          .sort((a, b) => new Date(b.start_time || b.created_at).getTime() - new Date(a.start_time || a.created_at).getTime());
      } else {
        // For team reports, use all enriched calls
        sortedCalls = enrichedCallActivities
          .filter(call => selectedAgent === 'all' || call.user_id === selectedAgent)
          .sort((a, b) => new Date(b.start_time || b.created_at).getTime() - new Date(a.start_time || a.created_at).getTime());
      }

      // Handle Excel Report (structured data only)
      if (reportType === 'excel') {
        // Generate Excel spreadsheet with structured data using ExcelJS for better compatibility
        // Use minimal metadata for maximum Google Drive compatibility
        const excelWorkbook = new ExcelJS.Workbook();
        // Removed metadata properties that might cause Google Drive conversion issues
        // excelWorkbook.creator = 'BetSure Dialer';
        // excelWorkbook.created = new Date();
        // excelWorkbook.modified = new Date();
        // excelWorkbook.lastModifiedBy = 'BetSure Dialer';
        // excelWorkbook.company = 'BetSure';
        
        // Create Summary sheet with KPIs
        const summarySheet = excelWorkbook.addWorksheet('Summary');
        
        // Ensure sheet has proper properties
        summarySheet.properties.defaultRowHeight = 15;
        
        // Create shared summary data array - used by both ExcelJS download and preview
        const generatedDate = new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala' });
        const summaryDataRows: any[][] = [
          ['Performance Report Summary'],
          [],
          ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)],
          ['Generated:', generatedDate]
        ];
        
        if (selectedAgent !== 'all' && agentKPIs) {
          summaryDataRows.push(
            ['Agent:', agentKPIs.agentName],
            ['Email:', agentKPIs.email],
            [],
            ['Key Performance Indicators'],
            ['Metric', 'Value', 'Target'],
            ['Total Calls Made', agentKPIs.totalCalls || 0, '60 calls/day'],
            ['Calls Per Hour', parseFloat(agentKPIs.callsPerHour.toFixed(1)), '7.5 calls/hour'],
            ['Connects', agentKPIs.connects || 0, '40 connects/day'],
            ['Connect Rate', `${agentKPIs.connectRate}%`, '70%'],
            ['Conversions', agentKPIs.conversions || 0, '12 conversions/day'],
            ['Conversion Rate', `${agentKPIs.conversionRate}%`, '25%'],
            ['Total Revenue', `UGX ${agentKPIs.totalRevenue.toLocaleString()}`, ''],
            ['Average Handle Time', agentKPIs.avgHandleTime || '0:00', '3-5 min']
          );
        } else {
          summaryDataRows.push(
            [],
            ['Team Performance Summary'],
            ['Metric', 'Value'],
            ['Total Calls', teamTotalCalls],
            ['Calls Per Hour', parseFloat(teamCallsPerHour)],
            ['Connects', teamConnects],
            ['Connect Rate', teamTotalCalls > 0 ? `${((teamConnects / teamTotalCalls) * 100).toFixed(1)}%` : '0%'],
            ['Conversions', teamConversions],
            ['Conversion Rate', teamConnects > 0 ? `${((teamConversions / teamConnects) * 100).toFixed(1)}%` : '0%']
          );
        }
        
        // Add rows to ExcelJS sheet using the shared data
        summaryDataRows.forEach(row => {
          if (row.length === 3 && row[0] !== 'Metric') {
            // Row with 3 columns - use explicit cell assignment
            const excelRow = summarySheet.addRow([row[0]]);
            excelRow.getCell(2).value = row[1];
            excelRow.getCell(3).value = row[2] || '';
          } else if (row.length === 2 && row[0] !== 'Metric') {
            // Row with 2 columns - use explicit cell assignment
            const excelRow = summarySheet.addRow([row[0]]);
            excelRow.getCell(2).value = row[1];
          } else {
            // Header rows or empty rows - add as-is
            summarySheet.addRow(row);
          }
        });
        
        // Create Call Log sheet
        const callLogSheet = excelWorkbook.addWorksheet('Call Log');
        
        // Ensure sheet has proper properties (minimal for Google Drive compatibility)
        // callLogSheet.properties.defaultRowHeight = 15;  // Commented for compatibility
        
        // Add header row
        const headerRow = callLogSheet.addRow(['Date', 'Time', 'Agent Name', 'Phone Number', 'Lead Name', 'Status', 'Duration', 'Remarks']);
        
        // Style header row (commented out for Google Drive compatibility)
        // Google Drive converter may not support all formatting
        // headerRow.font = { bold: true };
        // headerRow.fill = {
        //   type: 'pattern',
        //   pattern: 'solid',
        //   fgColor: { argb: 'FFE0E0E0' }
        // };
        
        // Use the shared sortedCalls array defined above to ensure consistency with preview
        sortedCalls.forEach(call => {
          const { formattedDate, formattedTime } = formatDateForExport(call.start_time);
          const agentName = call.profiles?.full_name || 'Unknown Agent';
          const phoneNumber = call.phone_number || 'N/A';
          const remarks = call.notes || 'No remarks';
          callLogSheet.addRow([
            formattedDate,
            formattedTime,
            agentName,
            phoneNumber,
            call.lead_name || 'Unknown Lead',
            call.status || 'unknown',
            call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00',
            remarks
          ]);
        });
        
        // Skip column auto-sizing for Google Drive compatibility
        // Google Drive converter has issues with column width settings
        // Users can adjust column widths in Google Sheets after opening
        
        // Generate Excel file buffer using ExcelJS (better compatibility)
        // ExcelJS writeBuffer returns a Promise that resolves to ArrayBuffer in browser
        try {
          console.log('[ExcelJS] Starting workbook write...', {
            sheetCount: excelWorkbook.worksheets.length,
            sheetNames: excelWorkbook.worksheets.map(ws => ws.name),
          });
          
          // Ensure workbook has at least one sheet with data
          if (excelWorkbook.worksheets.length === 0) {
            throw new Error('Workbook has no worksheets');
          }
          
          // Verify each sheet has data
          excelWorkbook.worksheets.forEach((sheet, index) => {
            if (sheet.rowCount === 0) {
              console.warn(`[ExcelJS] Sheet "${sheet.name}" has no rows`);
            }
          });
          
          // Write buffer with explicit options for maximum compatibility
          const excelBuffer = await excelWorkbook.xlsx.writeBuffer({
            useStyles: false,  // Disable styles for Google Drive compatibility
            useSharedStrings: false
          });
          
          // ExcelJS writeBuffer returns ArrayBuffer in browser - use directly
          // Validate buffer is not empty and has minimum size (Excel files should be at least a few KB)
          if (!excelBuffer) {
            throw new Error('Generated Excel buffer is null or undefined');
          }
          
          const bufferSize = excelBuffer instanceof ArrayBuffer 
            ? excelBuffer.byteLength 
            : (excelBuffer as any).length || 0;
            
          if (bufferSize === 0) {
            throw new Error('Generated Excel buffer is empty');
          }
          
          if (bufferSize < 1000) {
            console.warn('[ExcelJS] Buffer size is unusually small:', bufferSize, 'bytes');
          }
          
          console.log('[ExcelJS] Buffer generated successfully', {
            bufferType: excelBuffer.constructor.name,
            byteLength: bufferSize,
            sheets: excelWorkbook.worksheets.length
          });
          
          // Convert to Uint8Array if needed for Blob compatibility
          let finalBuffer: ArrayBuffer | Uint8Array;
          if (excelBuffer instanceof ArrayBuffer) {
            finalBuffer = excelBuffer;
          } else if (excelBuffer instanceof Uint8Array) {
            finalBuffer = excelBuffer;
          } else {
            // Fallback: convert to Uint8Array
            finalBuffer = new Uint8Array(excelBuffer as any);
          }
          
          // Create Blob with explicit MIME type for maximum compatibility
          blob = new Blob([finalBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          });
          
          console.log('[ExcelJS] Blob created successfully', {
            blobSize: blob.size,
            blobType: blob.type,
            isValidSize: blob.size > 0
          });
        } catch (excelError) {
          console.error('[ExcelJS] Error generating Excel file:', excelError);
          // Fallback to XLSX library if ExcelJS fails
          const xlsxWorkbook = XLSX.utils.book_new();
          const summaryData: any[][] = [['Performance Report Summary'], [], ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)], ['Generated:', new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala' })]];
          if (selectedAgent !== 'all' && agentKPIs) {
            summaryData.push(['Agent:', agentKPIs.agentName], ['Email:', agentKPIs.email], [], ['Key Performance Indicators'], ['Metric', 'Value', 'Target']);
            summaryData.push(['Total Calls Made', agentKPIs.totalCalls, '60 calls/day'], ['Calls Per Hour', agentKPIs.callsPerHour.toFixed(1), '7.5 calls/hour'], ['Connects', agentKPIs.connects, '40 connects/day'], ['Connect Rate', `${agentKPIs.connectRate}%`, '70%'], ['Conversions', agentKPIs.conversions, '12 conversions/day'], ['Conversion Rate', `${agentKPIs.conversionRate}%`, '25%'], ['Total Revenue', `UGX ${agentKPIs.totalRevenue.toLocaleString()}`, ''], ['Average Handle Time', agentKPIs.avgHandleTime, '3-5 min']);
          } else {
            summaryData.push([], ['Team Performance Summary'], ['Metric', 'Value'], ['Total Calls', teamTotalCalls], ['Calls Per Hour', teamCallsPerHour], ['Connects', teamConnects], ['Connect Rate', teamTotalCalls > 0 ? `${((teamConnects / teamTotalCalls) * 100).toFixed(1)}%` : '0%'], ['Conversions', teamConversions], ['Conversion Rate', teamConnects > 0 ? `${((teamConversions / teamConnects) * 100).toFixed(1)}%` : '0%']);
          }
          const xlsxSummarySheet = XLSX.utils.aoa_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxSummarySheet, 'Summary');
          const callLogData: any[][] = [['Date', 'Time', 'Agent Name', 'Phone Number', 'Lead Name', 'Status', 'Duration', 'Remarks']];
          sortedCalls.forEach(call => {
            const callDate = new Date(call.start_time);
            const { formattedDate, formattedTime } = formatDateForExport(call.start_time);
            const agentName = call.profiles?.full_name || 'Unknown Agent';
            const phoneNumber = call.phone_number || 'N/A';
            const remarks = call.notes || 'No remarks';
            callLogData.push([formattedDate, formattedTime, agentName, phoneNumber, call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', remarks]);
          });
          const xlsxCallLogSheet = XLSX.utils.aoa_to_sheet(callLogData);
          XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxCallLogSheet, 'Call Log');
          const excelArray = XLSX.write(xlsxWorkbook, { type: 'array', bookType: 'xlsx', cellStyles: false, cellDates: true });
          blob = new Blob([new Uint8Array(excelArray)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        }
        fileName = `performance-report${agentSuffix}-${dateStr}.xlsx`;
        
        // Store Excel data as JSON for preview/editing (using XLSX for reading)
        const xlsxWorkbook = XLSX.utils.book_new();
        // Use the SAME summaryDataRows array created above to ensure preview matches download exactly
        // Deep copy summaryDataRows to avoid mutation
        const summaryData = summaryDataRows.map(row => [...row]);
        const xlsxSummarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxSummarySheet, 'Summary');
        const callLogData: any[][] = [['Date', 'Time', 'Agent Name', 'Phone Number', 'Lead Name', 'Status', 'Duration', 'Remarks']];
        sortedCalls.forEach(call => {
          const { formattedDate, formattedTime } = formatDateForExport(call.start_time);
          callLogData.push([formattedDate, formattedTime, call.profiles?.full_name || 'Unknown Agent', call.phone_number || 'N/A', call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', call.notes || 'No remarks']);
        });
        const xlsxCallLogSheet = XLSX.utils.aoa_to_sheet(callLogData);
        XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxCallLogSheet, 'Call Log');
        const excelData = {
          sheets: xlsxWorkbook.SheetNames.map(sheetName => ({
            name: sheetName,
            data: XLSX.utils.sheet_to_json(xlsxWorkbook.Sheets[sheetName], { header: 1, defval: '' })
          }))
        };
        reportText = JSON.stringify(excelData);
      } else if (fileType === 'csv') {
        // Generate CSV file - best compatibility with Google Sheets
        const csvRows: string[] = [];
        
        // Add summary section
        csvRows.push('Performance Report Summary');
        csvRows.push('');
        csvRows.push(`Report Period,${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`);
        csvRows.push(`Generated,${new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala' })}`);
        csvRows.push('');
        
        if (selectedAgent !== 'all' && agentKPIs) {
          csvRows.push(`Agent,${agentKPIs.agentName}`);
          csvRows.push(`Email,${agentKPIs.email}`);
          csvRows.push('');
          csvRows.push('Key Performance Indicators');
          csvRows.push('Metric,Value,Target');
          csvRows.push(`Total Calls Made,${agentKPIs.totalCalls},60 calls/day`);
          csvRows.push(`Calls Per Hour,${agentKPIs.callsPerHour.toFixed(1)},7.5 calls/hour`);
          csvRows.push(`Connects,${agentKPIs.connects},40 connects/day`);
          csvRows.push(`Connect Rate,${agentKPIs.connectRate}%,70%`);
          csvRows.push(`Conversions,${agentKPIs.conversions},12 conversions/day`);
          csvRows.push(`Conversion Rate,${agentKPIs.conversionRate}%,25%`);
          csvRows.push(`Total Revenue,UGX ${agentKPIs.totalRevenue.toLocaleString()},`);
          csvRows.push(`Average Handle Time,${agentKPIs.avgHandleTime},3-5 min`);
        } else {
          csvRows.push('Team Performance Summary');
          csvRows.push('Metric,Value');
          csvRows.push(`Total Calls,${teamTotalCalls}`);
          csvRows.push(`Calls Per Hour,${teamCallsPerHour}`);
          csvRows.push(`Connects,${teamConnects}`);
          csvRows.push(`Connect Rate,${teamTotalCalls > 0 ? ((teamConnects / teamTotalCalls) * 100).toFixed(1) : '0'}%`);
          csvRows.push(`Conversions,${teamConversions}`);
          csvRows.push(`Conversion Rate,${teamConnects > 0 ? ((teamConversions / teamConnects) * 100).toFixed(1) : '0'}%`);
        }
        
        csvRows.push('');
        csvRows.push('Call Log');
        csvRows.push('Date,Time,Agent Name,Phone Number,Lead Name,Status,Duration,Remarks');
        
        // Add call log data - use shared sortedCalls to ensure consistency
        sortedCalls.forEach(call => {
          const callDate = new Date(call.start_time);
          // Format date as YYYY-MM-DD for better Excel compatibility
          const dateStr = callDate.toLocaleDateString('en-CA', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          }) || callDate.toISOString().split('T')[0];
          // Format time as HH:MM:SS
          const timeStr = callDate.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          }) || callDate.toTimeString().split(' ')[0];
          // Ensure all required fields are present
          const agentName = call.profiles?.full_name || 'Unknown Agent';
          const phoneNumber = call.phone_number || 'N/A';
          const leadName = call.lead_name || 'Unknown Lead';
          const status = call.status || 'unknown';
          const duration = call.duration_seconds 
            ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` 
            : '0:00';
          const remarks = (call.notes || 'No remarks').replace(/,/g, ';'); // Replace commas in notes to avoid CSV issues
          
          // Escape fields that contain commas or quotes
          const escapeCsvField = (field: string) => {
            if (field.includes(',') || field.includes('"') || field.includes('\n')) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          };
          
          csvRows.push([
            escapeCsvField(dateStr),
            escapeCsvField(timeStr),
            escapeCsvField(agentName),
            escapeCsvField(phoneNumber),
            escapeCsvField(leadName),
            escapeCsvField(status),
            escapeCsvField(duration),
            escapeCsvField(remarks)
          ].join(','));
        });
        
        // Create CSV blob with UTF-8 BOM for Excel/Google Sheets compatibility
        const csvContent = csvRows.join('\n');
        const csvBlob = new Blob(['\ufeff' + csvContent], { 
          type: 'text/csv;charset=utf-8;' 
        });
        
        blob = csvBlob;
        fileName = `performance-report${agentSuffix}-${dateStr}.csv`;
        reportText = csvContent;
      } else if (fileType === 'docx') {
        // Generate Word document
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: paragraphs,
            },
          ],
        });
        blob = await Packer.toBlob(doc);
        fileName = `performance-report${agentSuffix}-${dateStr}.docx`;
      } else if (fileType === 'xlsx') {
        // Generate Excel spreadsheet using ExcelJS for better compatibility
        // Use minimal metadata for maximum Google Drive compatibility
        const excelWorkbook = new ExcelJS.Workbook();
        // Removed metadata properties that might cause Google Drive conversion issues
        // excelWorkbook.creator = 'BetSure Dialer';
        // excelWorkbook.created = new Date();
        // excelWorkbook.modified = new Date();
        // excelWorkbook.lastModifiedBy = 'BetSure Dialer';
        // excelWorkbook.company = 'BetSure';
        
        // Create Summary sheet
        const summarySheet = excelWorkbook.addWorksheet('Summary');
        
        // Ensure sheet has proper properties
        summarySheet.properties.defaultRowHeight = 15;
        
        summarySheet.addRow(['Performance Report Summary']);
        summarySheet.addRow([]);
        summarySheet.addRow(['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)]);
        summarySheet.addRow(['Generated:', new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala' })]);
        
        if (selectedAgent !== 'all' && agentKPIs) {
          summarySheet.addRow(['Agent:', agentKPIs.agentName]);
          summarySheet.addRow(['Email:', agentKPIs.email]);
          summarySheet.addRow([]);
          summarySheet.addRow(['Key Performance Indicators']);
          summarySheet.addRow(['Metric', 'Value', 'Target']);
          // Use explicit cell assignment to ensure proper column placement
          const row1 = summarySheet.addRow(['Total Calls Made']);
          row1.getCell(2).value = agentKPIs.totalCalls || 0;
          row1.getCell(3).value = '60 calls/day';
          const row2 = summarySheet.addRow(['Calls Per Hour']);
          row2.getCell(2).value = parseFloat(agentKPIs.callsPerHour.toFixed(1));
          row2.getCell(3).value = '7.5 calls/hour';
          const row3 = summarySheet.addRow(['Connects']);
          row3.getCell(2).value = agentKPIs.connects || 0;
          row3.getCell(3).value = '40 connects/day';
          const row4 = summarySheet.addRow(['Connect Rate']);
          row4.getCell(2).value = `${agentKPIs.connectRate}%`;
          row4.getCell(3).value = '70%';
          const row5 = summarySheet.addRow(['Conversions']);
          row5.getCell(2).value = agentKPIs.conversions || 0;
          row5.getCell(3).value = '12 conversions/day';
          const row6 = summarySheet.addRow(['Conversion Rate']);
          row6.getCell(2).value = `${agentKPIs.conversionRate}%`;
          row6.getCell(3).value = '25%';
          const row7 = summarySheet.addRow(['Total Revenue']);
          row7.getCell(2).value = `UGX ${agentKPIs.totalRevenue.toLocaleString()}`;
          row7.getCell(3).value = '';
          const row8 = summarySheet.addRow(['Average Handle Time']);
          row8.getCell(2).value = agentKPIs.avgHandleTime || '0:00';
          row8.getCell(3).value = '3-5 min';
        } else {
          // Team-wide summary - use explicit cell assignment to ensure proper column placement
          summarySheet.addRow([]);
          summarySheet.addRow(['Team Performance Summary']);
          summarySheet.addRow(['Metric', 'Value']);
          const teamRow1 = summarySheet.addRow(['Total Calls']);
          teamRow1.getCell(2).value = teamTotalCalls;
          const teamRow2 = summarySheet.addRow(['Calls Per Hour']);
          teamRow2.getCell(2).value = parseFloat(teamCallsPerHour);
          const teamRow3 = summarySheet.addRow(['Connects']);
          teamRow3.getCell(2).value = teamConnects;
          const teamRow4 = summarySheet.addRow(['Connect Rate']);
          teamRow4.getCell(2).value = teamTotalCalls > 0 ? `${((teamConnects / teamTotalCalls) * 100).toFixed(1)}%` : '0%';
          const teamRow5 = summarySheet.addRow(['Conversions']);
          teamRow5.getCell(2).value = teamConversions;
          const teamRow6 = summarySheet.addRow(['Conversion Rate']);
          teamRow6.getCell(2).value = teamConnects > 0 ? `${((teamConversions / teamConnects) * 100).toFixed(1)}%` : '0%';
        }
        
        // Create Call Log sheet
        const callLogSheet = excelWorkbook.addWorksheet('Call Log');
        
        // Ensure sheet has proper properties (minimal for Google Drive compatibility)
        // callLogSheet.properties.defaultRowHeight = 15;  // Commented for compatibility
        
        // Add header row
        const headerRow = callLogSheet.addRow(['Date', 'Time', 'Agent Name', 'Phone Number', 'Lead Name', 'Status', 'Duration', 'Remarks']);
        
        // Style header row (commented out for Google Drive compatibility)
        // Google Drive converter may not support all formatting
        // headerRow.font = { bold: true };
        // headerRow.fill = {
        //   type: 'pattern',
        //   pattern: 'solid',
        //   fgColor: { argb: 'FFE0E0E0' }
        // };
        
        // Use the shared sortedCalls array defined above to ensure consistency with preview
        sortedCalls.forEach(call => {
          const { formattedDate, formattedTime } = formatDateForExport(call.start_time);
          const agentName = call.profiles?.full_name || 'Unknown Agent';
          const phoneNumber = call.phone_number || 'N/A';
          const remarks = call.notes || 'No remarks';
          callLogSheet.addRow([
            formattedDate,
            formattedTime,
            agentName,
            phoneNumber,
            call.lead_name || 'Unknown Lead',
            call.status || 'unknown',
            call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00',
            remarks
          ]);
        });
        
        // Skip column auto-sizing for Google Drive compatibility
        // Google Drive converter has issues with column width settings
        // Users can adjust column widths in Google Sheets after opening
        
        // Generate Excel file buffer using ExcelJS (better compatibility)
        // ExcelJS writeBuffer returns a Promise that resolves to ArrayBuffer in browser
        try {
          console.log('[ExcelJS] Starting workbook write...', {
            sheetCount: excelWorkbook.worksheets.length,
            sheetNames: excelWorkbook.worksheets.map(ws => ws.name),
          });
          
          // Ensure workbook has at least one sheet with data
          if (excelWorkbook.worksheets.length === 0) {
            throw new Error('Workbook has no worksheets');
          }
          
          // Verify each sheet has data
          excelWorkbook.worksheets.forEach((sheet, index) => {
            if (sheet.rowCount === 0) {
              console.warn(`[ExcelJS] Sheet "${sheet.name}" has no rows`);
            }
          });
          
          // Write buffer with explicit options for maximum compatibility
          const excelBuffer = await excelWorkbook.xlsx.writeBuffer({
            useStyles: false,  // Disable styles for Google Drive compatibility
            useSharedStrings: false
          });
          
          // ExcelJS writeBuffer returns ArrayBuffer in browser - use directly
          // Validate buffer is not empty and has minimum size (Excel files should be at least a few KB)
          if (!excelBuffer) {
            throw new Error('Generated Excel buffer is null or undefined');
          }
          
          const bufferSize = excelBuffer instanceof ArrayBuffer 
            ? excelBuffer.byteLength 
            : (excelBuffer as any).length || 0;
            
          if (bufferSize === 0) {
            throw new Error('Generated Excel buffer is empty');
          }
          
          if (bufferSize < 1000) {
            console.warn('[ExcelJS] Buffer size is unusually small:', bufferSize, 'bytes');
          }
          
          console.log('[ExcelJS] Buffer generated successfully', {
            bufferType: excelBuffer.constructor.name,
            byteLength: bufferSize,
            sheets: excelWorkbook.worksheets.length
          });
          
          // Convert to Uint8Array if needed for Blob compatibility
          let finalBuffer: ArrayBuffer | Uint8Array;
          if (excelBuffer instanceof ArrayBuffer) {
            finalBuffer = excelBuffer;
          } else if (excelBuffer instanceof Uint8Array) {
            finalBuffer = excelBuffer;
          } else {
            // Fallback: convert to Uint8Array
            finalBuffer = new Uint8Array(excelBuffer as any);
          }
          
          // Create Blob with explicit MIME type for maximum compatibility
          blob = new Blob([finalBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          });
          
          console.log('[ExcelJS] Blob created successfully', {
            blobSize: blob.size,
            blobType: blob.type,
            isValidSize: blob.size > 0
          });
        } catch (excelError) {
          console.error('[ExcelJS] Error generating Excel file:', excelError);
          // Fallback to XLSX library if ExcelJS fails
          const xlsxWorkbook = XLSX.utils.book_new();
          const summaryData: any[][] = [['Performance Report Summary'], [], ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)], ['Generated:', new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala' })]];
          if (selectedAgent !== 'all' && agentKPIs) {
            summaryData.push(['Agent:', agentKPIs.agentName], ['Email:', agentKPIs.email], [], ['Key Performance Indicators'], ['Metric', 'Value', 'Target']);
            summaryData.push(['Total Calls Made', agentKPIs.totalCalls, '60 calls/day'], ['Calls Per Hour', agentKPIs.callsPerHour.toFixed(1), '7.5 calls/hour'], ['Connects', agentKPIs.connects, '40 connects/day'], ['Connect Rate', `${agentKPIs.connectRate}%`, '70%'], ['Conversions', agentKPIs.conversions, '12 conversions/day'], ['Conversion Rate', `${agentKPIs.conversionRate}%`, '25%'], ['Total Revenue', `UGX ${agentKPIs.totalRevenue.toLocaleString()}`, ''], ['Average Handle Time', agentKPIs.avgHandleTime, '3-5 min']);
          } else {
            summaryData.push([], ['Team Performance Summary'], ['Metric', 'Value'], ['Total Calls', teamTotalCalls], ['Calls Per Hour', teamCallsPerHour], ['Connects', teamConnects], ['Connect Rate', teamTotalCalls > 0 ? `${((teamConnects / teamTotalCalls) * 100).toFixed(1)}%` : '0%'], ['Conversions', teamConversions], ['Conversion Rate', teamConnects > 0 ? `${((teamConversions / teamConnects) * 100).toFixed(1)}%` : '0%']);
          }
          const xlsxSummarySheet = XLSX.utils.aoa_to_sheet(summaryData);
          XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxSummarySheet, 'Summary');
          const callLogData: any[][] = [['Date', 'Time', 'Agent Name', 'Phone Number', 'Lead Name', 'Status', 'Duration', 'Remarks']];
          sortedCalls.forEach(call => {
            const callDate = new Date(call.start_time);
            const { formattedDate, formattedTime } = formatDateForExport(call.start_time);
            const agentName = call.profiles?.full_name || 'Unknown Agent';
            const phoneNumber = call.phone_number || 'N/A';
            const remarks = call.notes || 'No remarks';
            callLogData.push([formattedDate, formattedTime, agentName, phoneNumber, call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', remarks]);
          });
          const xlsxCallLogSheet = XLSX.utils.aoa_to_sheet(callLogData);
          XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxCallLogSheet, 'Call Log');
          const excelArray = XLSX.write(xlsxWorkbook, { type: 'array', bookType: 'xlsx', cellStyles: false, cellDates: true });
          blob = new Blob([new Uint8Array(excelArray)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        }
        fileName = `performance-report${agentSuffix}-${dateStr}.xlsx`;
        
        // Store Excel data as JSON for preview/editing (using XLSX for reading)
        // Create summaryDataRows array to match the ExcelJS download structure
        const generatedDate = new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala' });
        const summaryDataRows: any[][] = [
          ['Performance Report Summary'],
          [],
          ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)],
          ['Generated:', generatedDate]
        ];
        if (selectedAgent !== 'all' && agentKPIs) {
          summaryDataRows.push(['Agent:', agentKPIs.agentName], ['Email:', agentKPIs.email], [], ['Key Performance Indicators'], ['Metric', 'Value', 'Target']);
          summaryDataRows.push(['Total Calls Made', agentKPIs.totalCalls, '60 calls/day'], ['Calls Per Hour', agentKPIs.callsPerHour.toFixed(1), '7.5 calls/hour'], ['Connects', agentKPIs.connects, '40 connects/day'], ['Connect Rate', `${agentKPIs.connectRate}%`, '70%'], ['Conversions', agentKPIs.conversions, '12 conversions/day'], ['Conversion Rate', `${agentKPIs.conversionRate}%`, '25%'], ['Total Revenue', `UGX ${agentKPIs.totalRevenue.toLocaleString()}`, ''], ['Average Handle Time', agentKPIs.avgHandleTime, '3-5 min']);
        } else {
          summaryDataRows.push([], ['Team Performance Summary'], ['Metric', 'Value'], ['Total Calls', teamTotalCalls], ['Calls Per Hour', teamCallsPerHour], ['Connects', teamConnects], ['Connect Rate', teamTotalCalls > 0 ? `${((teamConnects / teamTotalCalls) * 100).toFixed(1)}%` : '0%'], ['Conversions', teamConversions], ['Conversion Rate', teamConnects > 0 ? `${((teamConversions / teamConnects) * 100).toFixed(1)}%` : '0%']);
        }
        
        const xlsxWorkbook = XLSX.utils.book_new();
        // Use the SAME summaryDataRows array created above to ensure preview matches download exactly
        // Deep copy summaryDataRows to avoid mutation
        const summaryData = summaryDataRows.map(row => [...row]);
        const xlsxSummarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxSummarySheet, 'Summary');
        const callLogData: any[][] = [['Date', 'Time', 'Agent Name', 'Phone Number', 'Lead Name', 'Status', 'Duration', 'Remarks']];
        sortedCalls.forEach(call => {
          const { formattedDate, formattedTime } = formatDateForExport(call.start_time);
          callLogData.push([formattedDate, formattedTime, call.profiles?.full_name || 'Unknown Agent', call.phone_number || 'N/A', call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', call.notes || 'No remarks']);
        });
        const xlsxCallLogSheet = XLSX.utils.aoa_to_sheet(callLogData);
        XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxCallLogSheet, 'Call Log');
        const excelData = {
          sheets: xlsxWorkbook.SheetNames.map(sheetName => ({
            name: sheetName,
            data: XLSX.utils.sheet_to_json(xlsxWorkbook.Sheets[sheetName], { header: 1, defval: '' })
          }))
        };
        reportText = JSON.stringify(excelData);
      } else {
      // Generate PDF
        const pdf = new jsPDF();
        let yPos = 20;
        const pageHeight = pdf.internal.pageSize.height;
      const margin = 20;
        const lineHeight = 7;

      // Title
        pdf.setFontSize(18);
        pdf.text(selectedAgent !== 'all' && agentKPIs 
          ? `Agent Performance Report - ${agentKPIs.agentName}`
          : "Call Center Performance Report", margin, yPos);
        yPos += 15;

      // Date range
        pdf.setFontSize(12);
        pdf.text(`Period: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`, margin, yPos);
        yPos += 10;
        pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPos);
        yPos += 15;
        
        // Add report content
        pdf.setFontSize(10);
        const lines = reportText.split('\n');
        lines.forEach((line: string) => {
          if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
          }
          
          const trimmedLine = line.trim();
          if (trimmedLine) {
            if (trimmedLine.endsWith(':') && trimmedLine.length < 80) {
              // Section header
              pdf.setFontSize(12);
              pdf.setFont(undefined, 'bold');
              pdf.text(trimmedLine, margin, yPos);
              yPos += 10;
              pdf.setFontSize(10);
              pdf.setFont(undefined, 'normal');
            } else {
              pdf.text(trimmedLine, margin, yPos);
              yPos += lineHeight;
            }
        } else {
            yPos += 5; // Space for empty lines
          }
        });
        
        blob = pdf.output('blob');
        fileName = `performance-report${agentSuffix}-${dateStr}.pdf`;
      }

      // Save report to database (no immediate download - user will preview in Reports tab)
      try {
        if (!user?.id) {
          console.warn('Cannot save report: user not authenticated');
        } else {
          const reportTitle = selectedAgent !== 'all' && agentKPIs
            ? `Agent Performance Report - ${agentKPIs.agentName}`
            : `Team Performance Report - ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`;
          
          // Determine file type from reportType and fileType
          // Excel reports are always xlsx, summary reports use the selected fileType
          const actualFileType: 'docx' | 'xlsx' | 'pdf' = reportType === 'excel' ? 'xlsx' : fileType;
          
          // Ensure reportText is valid (for Excel reports, it's JSON string)
          const reportContent = reportText || (reportType === 'excel' ? '{}' : 'Report content not available');
          
          // Prepare insert data
          const insertData: any = {
            user_id: user.id,
            report_title: reportTitle,
            report_content: reportContent,
            date_range: dateRange,
            selected_agent: selectedAgent !== 'all' ? selectedAgent : null,
            agent_name: selectedAgent !== 'all' && agentKPIs ? agentKPIs.agentName : null,
            file_name: fileName
          };
          
          // Only include file_type if it's a valid value (in case migration hasn't been run)
          if (actualFileType && ['docx', 'xlsx', 'pdf', 'csv'].includes(actualFileType)) {
            insertData.file_type = actualFileType;
          }

          // Try to insert with file_type first
          let saveError = null;
          let insertAttempt = await supabase
            .from('generated_reports')
            .insert(insertData);
          
          saveError = insertAttempt.error;

          // If error and file_type was included, try without it
          if (saveError && insertData.file_type) {
            console.warn('Initial insert failed, retrying without file_type:', {
              code: saveError.code,
              message: saveError.message
            });
            
            const insertDataWithoutFileType = { ...insertData };
            delete insertDataWithoutFileType.file_type;
            
            const retryAttempt = await supabase
              .from('generated_reports')
              .insert(insertDataWithoutFileType);
            
            if (retryAttempt.error) {
              saveError = retryAttempt.error;
              console.error('Error saving report to database (after retry):', {
                error: saveError,
                code: saveError.code,
                message: saveError.message,
                details: saveError.details,
                hint: saveError.hint,
                data: insertDataWithoutFileType
              });
            } else {
              saveError = null; // Success on retry
            }
          } else if (saveError) {
            console.error('Error saving report to database:', {
              error: saveError,
              code: saveError.code,
              message: saveError.message,
              details: saveError.details,
              hint: saveError.hint,
              data: insertData
            });
          }

          if (saveError) {
            if (saveError.code === '42P01' || saveError.message?.includes('relation') || saveError.message?.includes('does not exist')) {
              console.warn('generated_reports table does not exist. Please apply the migration first.');
              toast.warning('Report generated but could not be saved. Please check the Reports tab.');
            } else if (saveError.code === '42501' || saveError.message?.includes('permission denied') || saveError.message?.includes('policy')) {
              toast.error('Permission denied. You may not have permission to save reports.');
            } else {
              toast.error(`Failed to save report: ${saveError.message || 'Unknown error'}`);
            }
          } else {
            console.log('Report saved to database successfully');
            toast.success(`Report generated successfully! View it in the Reports tab.`, {
              description: `Format: ${(reportType === 'excel' ? 'xlsx' : fileType).toUpperCase()}`,
              duration: 5000
            });
            onOpenChange(false); // Close the modal
          }
        }
      } catch (saveErr: any) {
        if (saveErr?.code === '42P01' || saveErr?.message?.includes('relation') || saveErr?.message?.includes('does not exist')) {
          console.warn('generated_reports table does not exist. Please apply the migration first.');
        } else {
          console.error('Error saving report:', saveErr);
        }
      }
      
      // Report is saved, user will preview in Reports tab
    } catch (error: any) {
      console.error('Error generating report:', error);
      // Extract detailed error message
      let errorMessage = 'Unknown error occurred';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = typeof error.error === 'string' ? error.error : error.error.message || errorMessage;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Check if it's an edge function error
      if (error?.status || error?.statusCode) {
        const status = error.status || error.statusCode;
        errorMessage = `Server error (${status}): ${errorMessage}`;
      }
      
      console.error('[ExportReportModal] Full error details:', {
        error,
        message: errorMessage,
        stack: error?.stack
      });
      
      toast.error(`Failed to generate report: ${errorMessage}`, {
        description: 'Please check the console for more details.',
        duration: 5000
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Performance Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="mb-2">
              <strong>Report Period:</strong> {dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}
            </p>
          </div>

          {/* Report Type Selection - Moved to top for visibility */}
          <div className="space-y-2">
            <Label htmlFor="report-type">Report Type</Label>
            <Select value={reportType} onValueChange={(value: "summary" | "excel") => {
              setReportType(value);
              if (value === 'excel') {
                setFileType('xlsx'); // Excel reports are always .xlsx
              }
            }}>
              <SelectTrigger id="report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>Summary Report (AI-Generated)</span>
                  </div>
                </SelectItem>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Excel Report (Structured Data)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {reportType === 'summary' 
                ? 'AI-powered analysis with insights and recommendations (Word/PDF)'
                : 'Structured data report with detailed metrics and call logs (Excel only)'}
            </p>
          </div>

          {/* Agent Selection (only show if manager/admin) */}
          {(isManagement || isAdmin) && (
            <div className="space-y-2">
              <Label htmlFor="agent-select">Select Agent</Label>
              <Select 
                value={selectedAgent} 
                onValueChange={setSelectedAgent}
                disabled={loadingAgents || isGenerating}
              >
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder={loadingAgents ? "Loading agents..." : "Select an agent"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents (Team Report)</SelectItem>
                  {availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} {agent.email ? `(${agent.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedAgent === 'all' 
                  ? 'Generate a report for all agents in your team'
                  : `Generate a detailed KPI report for the selected agent`}
              </p>
            </div>
          )}

          {/* Show selected agent info for regular agents */}
          {!isManagement && !isAdmin && user && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p>
                <strong>Agent:</strong> {user.email || 'You'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This report will include your personal performance KPIs
              </p>
            </div>
          )}

          {/* File Type Selection (only for Summary Reports) */}
          {reportType === 'summary' && (
            <div className="space-y-2">
              <Label htmlFor="file-type">File Format</Label>
              <Select value={fileType} onValueChange={(value: "docx" | "xlsx" | "pdf" | "csv") => setFileType(value)}>
                <SelectTrigger id="file-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>CSV File (.csv) - Best for Google Sheets</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="docx">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>Word Document (.docx)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4" />
                      <span>PDF Document (.pdf)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the format for your summary report. You'll be able to preview before downloading.
              </p>
            </div>
          )}

          {/* Customization Options (only for Summary Reports) */}
          {reportType === 'summary' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verbosity">Report Detail Level</Label>
              <Select value={verbosity} onValueChange={setVerbosity}>
                <SelectTrigger id="verbosity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise - Key insights only</SelectItem>
                  <SelectItem value="balanced">Balanced - Standard detail</SelectItem>
                  <SelectItem value="detailed">Detailed - Comprehensive analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="focus">Focus Area</Label>
              <Select value={focusArea} onValueChange={setFocusArea}>
                <SelectTrigger id="focus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Metrics</SelectItem>
                  <SelectItem value="conversion">Conversion Optimization</SelectItem>
                  <SelectItem value="efficiency">Call Efficiency</SelectItem>
                  <SelectItem value="quality">Call Quality & Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          )}

          {/* Generate Button */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {reportType === 'excel' ? 'Generate Excel Report' : 'Generate Report'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}