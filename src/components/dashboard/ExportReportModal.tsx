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
import { shouldUseMockData, mockTeamAgentsData, mockDailyPerformanceData } from "@/utils/mockData";

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
      if (shouldUseMockData()) {
        // Use mock agents
        const mockAgents: AgentOption[] = mockTeamAgentsData.map(a => ({
          id: a.id,
          name: a.name,
          email: a.email
        }));
        setAvailableAgents(mockAgents);
        setLoadingAgents(false);
        
        // If initial selected agent is not in the list, default to "all"
        if (initialSelectedAgent !== 'all' && !mockAgents.find(a => a.id === initialSelectedAgent)) {
          setSelectedAgent('all');
        }
      } else {
        fetchAvailableAgents();
      }
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
      const isMockMode = shouldUseMockData();
      
      // Calculate date range
      const daysMap: Record<string, number> = {
        'today': 0,
        'week': 7,
        'month': 30,
        'quarter': 90,
        '7d': 7,
        '30d': 30,
        '90d': 90
      };
      const daysAgo = daysMap[dateRange] || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Validate date
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid date range specified');
      }

      let callActivities: any[] = [];
      let profiles: any[] = [];
      let campaigns: any[] = [];

      if (isMockMode) {
        // Generate mock call activities based on selected agent and date range
        const selectedMockAgent = selectedAgent !== 'all' 
          ? mockTeamAgentsData.find(a => a.id === selectedAgent)
          : null;

        // Get daily performance data for the date range
        const daysToInclude = Math.min(daysAgo, mockDailyPerformanceData.length);
        const relevantDailyData = mockDailyPerformanceData.slice(-daysToInclude);

        // Generate call activities from mock data
        callActivities = [];
        let callId = 1;

        if (selectedMockAgent) {
          // For specific agent, use their performance data
          const totalCalls = selectedMockAgent.calls;
          const totalConnects = selectedMockAgent.connects;
          const totalConversions = selectedMockAgent.conversions;
          const avgRevenuePerConversion = selectedMockAgent.revenue / selectedMockAgent.conversions;

          // Distribute calls across the date range
          const callsPerDay = Math.ceil(totalCalls / daysToInclude);
          const connectsPerDay = Math.ceil(totalConnects / daysToInclude);
          const conversionsPerDay = Math.ceil(totalConversions / daysToInclude);

          relevantDailyData.forEach((dayData, dayIndex) => {
            const dayDate = new Date();
            dayDate.setDate(dayDate.getDate() - (daysToInclude - dayIndex - 1));
            
            // Generate calls for this day
            const dayCalls = Math.min(callsPerDay, totalCalls - callActivities.length);
            const dayConnects = Math.min(connectsPerDay, totalConnects - callActivities.filter(c => c.status === 'connected' || c.status === 'converted').length);
            const dayConversions = Math.min(conversionsPerDay, totalConversions - callActivities.filter(c => c.status === 'converted').length);

            for (let i = 0; i < dayCalls; i++) {
              const isConnect = i < dayConnects;
              const isConversion = isConnect && i < dayConversions;
              
              callActivities.push({
                id: `mock-call-${callId++}`,
                phone_number: `+2567${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
                lead_name: `Lead ${callId}`,
                duration_seconds: isConnect ? Math.floor(Math.random() * 300) + 60 : Math.floor(Math.random() * 30),
                notes: isConversion ? 'Successfully converted. Customer made deposit.' : (isConnect ? 'Connected but not converted' : 'No answer'),
                created_at: dayDate.toISOString(),
                status: isConversion ? 'converted' : (isConnect ? 'connected' : 'no_answer'),
                deposit_amount: isConversion ? avgRevenuePerConversion : 0,
                user_id: selectedMockAgent.id,
                campaign_id: 'mock-campaign-1'
              });
            }
          });
        } else {
          // For "all agents", aggregate data from all mock agents
          relevantDailyData.forEach((dayData, dayIndex) => {
            const dayDate = new Date();
            dayDate.setDate(dayDate.getDate() - (daysToInclude - dayIndex - 1));
            
            // Distribute calls across agents
            const callsPerAgent = Math.ceil(dayData.calls / mockTeamAgentsData.length);
            
            mockTeamAgentsData.forEach((agent, agentIndex) => {
              const agentCalls = Math.min(callsPerAgent, dayData.calls - (agentIndex * callsPerAgent));
              const agentConnects = Math.ceil(agentCalls * (agent.connectRate / 100));
              const agentConversions = Math.ceil(agentConnects * (agent.conversionRate / 100));
              const avgRevenuePerConversion = agent.revenue / agent.conversions;

              for (let i = 0; i < agentCalls; i++) {
                const isConnect = i < agentConnects;
                const isConversion = isConnect && i < agentConversions;
                
                callActivities.push({
                  id: `mock-call-${callId++}`,
                  phone_number: `+2567${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
                  lead_name: `Lead ${callId}`,
                  duration_seconds: isConnect ? Math.floor(Math.random() * 300) + 60 : Math.floor(Math.random() * 30),
                  notes: isConversion ? 'Successfully converted. Customer made deposit.' : (isConnect ? 'Connected but not converted' : 'No answer'),
                  created_at: dayDate.toISOString(),
                  status: isConversion ? 'converted' : (isConnect ? 'connected' : 'no_answer'),
                  deposit_amount: isConversion ? avgRevenuePerConversion : 0,
                  user_id: agent.id,
                  campaign_id: 'mock-campaign-1'
                });
              }
            });
          });
        }

        // Create mock profiles
        if (selectedMockAgent) {
          profiles = [{
            id: selectedMockAgent.id,
            full_name: selectedMockAgent.name,
            email: selectedMockAgent.email
          }];
        } else {
          profiles = mockTeamAgentsData.map(a => ({
            id: a.id,
            full_name: a.name,
            email: a.email
          }));
        }

        // Create mock campaigns
        campaigns = [{
          id: 'mock-campaign-1',
          name: 'VIP Campaign'
        }];

        console.log(`[ExportReportModal] Generated ${callActivities.length} mock call activities for ${selectedAgent !== 'all' ? selectedMockAgent?.name : 'all agents'}`);
      } else {
        // Fetch real call activities with filters
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
        .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(1000); // Limit to prevent payload size issues

        // Only apply user_id filter when we have a real UUID.
        // Mock agents use IDs like "agent-2" which are NOT valid UUIDs and will cause Supabase to return 400.
      if (selectedAgent !== 'all') {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              selectedAgent
            );
          if (isUuid) {
        query = query.eq('user_id', selectedAgent);
          } else {
            console.warn(
              '[ExportReportModal] Skipping user_id filter because selectedAgent is not a valid UUID:',
              selectedAgent
            );
          }
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
      }

      // Enrich call activities with agent and campaign names
      const enrichedCallActivities = callActivities.map(call => ({
        ...call,
        profiles: profiles?.find(p => p.id === call.user_id) || null,
        campaigns: campaigns?.find(c => c.id === call.campaign_id) || null
      }));

      // Generate AI report (only for summary reports)
      let reportText = '';
      
      // Calculate team-wide metrics for context (needed for both report types)
      const teamTotalCalls = enrichedCallActivities.length;
      const teamConnects = enrichedCallActivities.filter(c => c.status === 'connected' || c.status === 'converted').length;
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

        if (error) throw error;

        if (!data || !data.report) {
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
      
      if (selectedAgent !== 'all') {
        agentProfile = profiles?.find(p => p.id === selectedAgent);
        const agentCalls = enrichedCallActivities.filter(c => c.user_id === selectedAgent);
        
        const totalCalls = agentCalls.length;
        const connects = agentCalls.filter(c => c.status === 'connected' || c.status === 'converted').length;
        const conversions = agentCalls.filter(c => c.status === 'converted').length;
        const totalRevenue = agentCalls.reduce((sum, c) => sum + (Number(c.deposit_amount) || 0), 0);
        const totalDuration = agentCalls.reduce((sum, c) => sum + (Number(c.duration_seconds) || 0), 0);
        const avgHandleTime = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
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
              text: `Generated: ${new Date().toLocaleDateString()}`,
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
        const sortedCalls = enrichedCallActivities
          .filter(call => selectedAgent === 'all' || call.user_id === selectedAgent)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          .slice(0, 100); // Limit to 100 most recent calls to keep document size manageable

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

      // Handle Excel Report (structured data only) - but allow CSV if selected
      if (reportType === 'excel' && fileType !== 'csv') {
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
        
        // Add summary data
        summarySheet.addRow(['Performance Report Summary']);
        summarySheet.addRow([]);
        summarySheet.addRow(['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)]);
        summarySheet.addRow(['Generated:', new Date().toLocaleDateString()]);
        
        if (selectedAgent !== 'all' && agentKPIs) {
          summarySheet.addRow(['Agent:', agentKPIs.agentName]);
          summarySheet.addRow(['Email:', agentKPIs.email]);
          summarySheet.addRow([]);
          summarySheet.addRow(['Key Performance Indicators']);
          summarySheet.addRow(['Metric', 'Value', 'Target']);
          summarySheet.addRow(['Total Calls Made', agentKPIs.totalCalls, '60 calls/day']);
          summarySheet.addRow(['Calls Per Hour', agentKPIs.callsPerHour.toFixed(1), '7.5 calls/hour']);
          summarySheet.addRow(['Connects', agentKPIs.connects, '40 connects/day']);
          summarySheet.addRow(['Connect Rate', `${agentKPIs.connectRate}%`, '70%']);
          summarySheet.addRow(['Conversions', agentKPIs.conversions, '12 conversions/day']);
          summarySheet.addRow(['Conversion Rate', `${agentKPIs.conversionRate}%`, '25%']);
          summarySheet.addRow(['Total Revenue', `UGX ${agentKPIs.totalRevenue.toLocaleString()}`, '']);
          summarySheet.addRow(['Average Handle Time', agentKPIs.avgHandleTime, '3-5 min']);
        } else {
          // Team-wide summary
          summarySheet.addRow([]);
          summarySheet.addRow(['Team Performance Summary']);
          summarySheet.addRow(['Metric', 'Value']);
          summarySheet.addRow(['Total Calls', teamTotalCalls]);
          summarySheet.addRow(['Calls Per Hour', teamCallsPerHour]);
          summarySheet.addRow(['Connects', teamConnects]);
          summarySheet.addRow(['Connect Rate', teamTotalCalls > 0 ? `${((teamConnects / teamTotalCalls) * 100).toFixed(1)}%` : '0%']);
          summarySheet.addRow(['Conversions', teamConversions]);
          summarySheet.addRow(['Conversion Rate', teamConnects > 0 ? `${((teamConversions / teamConnects) * 100).toFixed(1)}%` : '0%']);
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
        
        const sortedCalls = enrichedCallActivities
          .filter(call => selectedAgent === 'all' || call.user_id === selectedAgent)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          .slice(0, 1000);
        
        sortedCalls.forEach(call => {
          const callDate = new Date(call.start_time);
          callLogSheet.addRow([
            callDate.toLocaleDateString(),
            callDate.toLocaleTimeString(),
            call.profiles?.full_name || 'Unknown Agent',
            call.phone_number || 'N/A',
            call.lead_name || 'Unknown Lead',
            call.status || 'unknown',
            call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00',
            call.notes || 'No remarks'
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
          const summaryData: any[][] = [['Performance Report Summary'], [], ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)], ['Generated:', new Date().toLocaleDateString()]];
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
            callLogData.push([callDate.toLocaleDateString(), callDate.toLocaleTimeString(), call.profiles?.full_name || 'Unknown Agent', call.phone_number || 'N/A', call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', call.notes || 'No remarks']);
          });
          const xlsxCallLogSheet = XLSX.utils.aoa_to_sheet(callLogData);
          XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxCallLogSheet, 'Call Log');
          const excelArray = XLSX.write(xlsxWorkbook, { type: 'array', bookType: 'xlsx', cellStyles: false, cellDates: true });
          blob = new Blob([new Uint8Array(excelArray)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        }
        fileName = `performance-report${agentSuffix}-${dateStr}.xlsx`;
        
        // Store Excel data as JSON for preview/editing (using XLSX for reading)
        const xlsxWorkbook = XLSX.utils.book_new();
        const summaryData: any[][] = [['Performance Report Summary'], [], ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)], ['Generated:', new Date().toLocaleDateString()]];
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
          callLogData.push([callDate.toLocaleDateString(), callDate.toLocaleTimeString(), call.profiles?.full_name || 'Unknown Agent', call.phone_number || 'N/A', call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', call.notes || 'No remarks']);
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
        console.log('[CSV] Generating CSV file...');
        const csvRows: string[] = [];
        
        // Add summary section
        csvRows.push('Performance Report Summary');
        csvRows.push('');
        csvRows.push(`Report Period,${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`);
        csvRows.push(`Generated,${new Date().toLocaleDateString()}`);
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
        
        // Add call log data
        const sortedCalls = enrichedCallActivities
          .filter(call => selectedAgent === 'all' || call.user_id === selectedAgent)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          .slice(0, 1000);
        
        sortedCalls.forEach(call => {
          const callDate = new Date(call.start_time);
          const dateStr = callDate.toLocaleDateString();
          const timeStr = callDate.toLocaleTimeString();
          const agentName = (call.profiles?.full_name || 'Unknown Agent').replace(/,/g, ';');
          const phoneNumber = (call.phone_number || 'N/A').replace(/,/g, ';');
          const leadName = (call.lead_name || 'Unknown Lead').replace(/,/g, ';');
          const status = (call.status || 'unknown').replace(/,/g, ';');
          const duration = call.duration_seconds 
            ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` 
            : '0:00';
          const remarks = (call.notes || 'No remarks').replace(/,/g, ';').replace(/"/g, '""');
          
          // Simple CSV row - no complex escaping needed since we replaced commas
          csvRows.push(`${dateStr},${timeStr},${agentName},${phoneNumber},${leadName},${status},${duration},"${remarks}"`);
        });
        
        // Create CSV content with proper line endings
        const csvContent = csvRows.join('\r\n');
        console.log('[CSV] CSV content length:', csvContent.length, 'characters');
        console.log('[CSV] First 200 chars:', csvContent.substring(0, 200));
        
        // Create blob WITHOUT BOM first to test, then add BOM if needed
        // Some systems don't handle BOM well
        const csvBlob = new Blob([csvContent], { 
          type: 'text/csv;charset=utf-8' 
        });
        
        console.log('[CSV] Blob created:', {
          size: csvBlob.size,
          type: csvBlob.type
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
        summarySheet.addRow(['Generated:', new Date().toLocaleDateString()]);
        
        if (selectedAgent !== 'all' && agentKPIs) {
          summarySheet.addRow(['Agent:', agentKPIs.agentName]);
          summarySheet.addRow(['Email:', agentKPIs.email]);
          summarySheet.addRow([]);
          summarySheet.addRow(['Key Performance Indicators']);
          summarySheet.addRow(['Metric', 'Value', 'Target']);
          summarySheet.addRow(['Total Calls Made', agentKPIs.totalCalls, '60 calls/day']);
          summarySheet.addRow(['Calls Per Hour', agentKPIs.callsPerHour.toFixed(1), '7.5 calls/hour']);
          summarySheet.addRow(['Connects', agentKPIs.connects, '40 connects/day']);
          summarySheet.addRow(['Connect Rate', `${agentKPIs.connectRate}%`, '70%']);
          summarySheet.addRow(['Conversions', agentKPIs.conversions, '12 conversions/day']);
          summarySheet.addRow(['Conversion Rate', `${agentKPIs.conversionRate}%`, '25%']);
          summarySheet.addRow(['Total Revenue', `UGX ${agentKPIs.totalRevenue.toLocaleString()}`, '']);
          summarySheet.addRow(['Average Handle Time', agentKPIs.avgHandleTime, '3-5 min']);
        } else {
          // Team-wide summary
          summarySheet.addRow([]);
          summarySheet.addRow(['Team Performance Summary']);
          summarySheet.addRow(['Metric', 'Value']);
          summarySheet.addRow(['Total Calls', teamTotalCalls]);
          summarySheet.addRow(['Calls Per Hour', teamCallsPerHour]);
          summarySheet.addRow(['Connects', teamConnects]);
          summarySheet.addRow(['Connect Rate', teamTotalCalls > 0 ? `${((teamConnects / teamTotalCalls) * 100).toFixed(1)}%` : '0%']);
          summarySheet.addRow(['Conversions', teamConversions]);
          summarySheet.addRow(['Conversion Rate', teamConnects > 0 ? `${((teamConversions / teamConnects) * 100).toFixed(1)}%` : '0%']);
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
        
        const sortedCalls = enrichedCallActivities
          .filter(call => selectedAgent === 'all' || call.user_id === selectedAgent)
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
          .slice(0, 1000);
        
        sortedCalls.forEach(call => {
          const callDate = new Date(call.start_time);
          callLogSheet.addRow([
            callDate.toLocaleDateString(),
            callDate.toLocaleTimeString(),
            call.profiles?.full_name || 'Unknown Agent',
            call.phone_number || 'N/A',
            call.lead_name || 'Unknown Lead',
            call.status || 'unknown',
            call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00',
            call.notes || 'No remarks'
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
          const summaryData: any[][] = [['Performance Report Summary'], [], ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)], ['Generated:', new Date().toLocaleDateString()]];
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
            callLogData.push([callDate.toLocaleDateString(), callDate.toLocaleTimeString(), call.profiles?.full_name || 'Unknown Agent', call.phone_number || 'N/A', call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', call.notes || 'No remarks']);
          });
          const xlsxCallLogSheet = XLSX.utils.aoa_to_sheet(callLogData);
          XLSX.utils.book_append_sheet(xlsxWorkbook, xlsxCallLogSheet, 'Call Log');
          const excelArray = XLSX.write(xlsxWorkbook, { type: 'array', bookType: 'xlsx', cellStyles: false, cellDates: true });
          blob = new Blob([new Uint8Array(excelArray)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        }
        fileName = `performance-report${agentSuffix}-${dateStr}.xlsx`;
        
        // Store Excel data as JSON for preview/editing (using XLSX for reading)
        const xlsxWorkbook = XLSX.utils.book_new();
        const summaryData: any[][] = [['Performance Report Summary'], [], ['Report Period:', dateRange.charAt(0).toUpperCase() + dateRange.slice(1)], ['Generated:', new Date().toLocaleDateString()]];
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
          callLogData.push([callDate.toLocaleDateString(), callDate.toLocaleTimeString(), call.profiles?.full_name || 'Unknown Agent', call.phone_number || 'N/A', call.lead_name || 'Unknown Lead', call.status || 'unknown', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}` : '0:00', call.notes || 'No remarks']);
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
          // Excel reports default to xlsx, but respect CSV if selected
          const actualFileType: 'docx' | 'xlsx' | 'pdf' | 'csv' = reportType === 'excel' && fileType !== 'csv' ? 'xlsx' : fileType;
          
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
            
            // For CSV files, also trigger immediate download for better user experience
            if (actualFileType === 'csv' && blob) {
              try {
                saveAs(blob, fileName);
                toast.success(`CSV report generated and downloaded!`, {
                  description: `File: ${fileName}`,
                  duration: 5000
                });
              } catch (downloadError) {
                console.error('Error downloading CSV file:', downloadError);
                toast.success(`Report generated successfully! View it in the Reports tab.`, {
                  description: `Format: ${actualFileType.toUpperCase()}`,
                  duration: 5000
                });
              }
            } else {
              toast.success(`Report generated successfully! View it in the Reports tab.`, {
                description: `Format: ${(reportType === 'excel' && fileType !== 'csv' ? 'xlsx' : fileType).toUpperCase()}`,
                duration: 5000
              });
            }
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
      const errorMessage = error?.message || error?.error || 'Unknown error occurred';
      toast.error(`Failed to generate report: ${errorMessage}`);
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
              // Allow CSV to be selected even for Excel reports
              // if (value === 'excel' && fileType !== 'csv') {
              //   setFileType('xlsx');
              // }
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
                ? 'AI-powered analysis with insights and recommendations (Word/PDF/CSV)'
                : 'Structured data report with detailed metrics and call logs (Excel/CSV)'}
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

          {/* File Type Selection (available for both Summary and Excel reports) */}
          {(reportType === 'summary' || reportType === 'excel') && (
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
                  {reportType === 'summary' && (
                    <>
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
                    </>
                  )}
                  {reportType === 'excel' && (
                    <SelectItem value="xlsx">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Excel File (.xlsx)</span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {reportType === 'summary' 
                  ? "Choose the format for your summary report. You'll be able to preview before downloading."
                  : 'Choose the format for your structured data report. CSV is recommended for Google Sheets compatibility.'}
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
