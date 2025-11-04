import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { dateRange } = await req.json();

    // Calculate date range
    let endDate = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case "quarter":
        const currentQuarter = Math.floor(endDate.getMonth() / 3);
        startDate = new Date(endDate.getFullYear(), currentQuarter * 3, 1);
        break;
    }

    // Fetch performance data
    const { data: calls, error: callsError } = await supabaseClient
      .from('call_activities')
      .select(`
        *,
        profiles:user_id (full_name)
      `)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    if (callsError) throw callsError;

    // Generate HTML report
    const totalCalls = calls?.length || 0;
    const totalConnects = calls?.filter(c => c.status === 'connected' || c.status === 'converted').length || 0;
    const totalConversions = calls?.filter(c => c.status === 'converted').length || 0;
    const totalRevenue = calls?.reduce((sum, c) => sum + (c.deposit_amount || 0), 0) || 0;
    const connectRate = totalCalls > 0 ? ((totalConnects / totalCalls) * 100).toFixed(1) : '0.0';
    const conversionRate = totalConnects > 0 ? ((totalConversions / totalConnects) * 100).toFixed(1) : '0.0';

    // Group by agent
    const agentStats = new Map();
    calls?.forEach(call => {
      const agentName = call.profiles?.full_name || 'Unknown';
      if (!agentStats.has(agentName)) {
        agentStats.set(agentName, {
          calls: 0,
          connects: 0,
          conversions: 0,
          revenue: 0
        });
      }
      const stats = agentStats.get(agentName);
      stats.calls++;
      if (call.status === 'connected' || call.status === 'converted') stats.connects++;
      if (call.status === 'converted') stats.conversions++;
      stats.revenue += call.deposit_amount || 0;
    });

    const agentRows = Array.from(agentStats.entries())
      .map(([name, stats]) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${name}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${stats.calls}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${stats.connects}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${stats.conversions}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">UGX ${stats.revenue.toLocaleString()}</td>
        </tr>
      `).join('');

    // Generate call notes section with phone numbers
    const callNotesRows = calls
      ?.filter(call => call.notes && call.notes.trim() !== '')
      .map(call => {
        const agentName = call.profiles?.full_name || 'Unknown';
        const formattedDate = new Date(call.start_time).toLocaleString();
        const status = call.status || 'Unknown';
        const statusColor = status === 'converted' ? '#22c55e' : status === 'connected' ? '#3b82f6' : '#64748b';
        
        return `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${formattedDate}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${agentName}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${call.phone_number || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${call.lead_name || 'N/A'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">
              <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                ${status}
              </span>
            </td>
            <td style="padding: 8px; border: 1px solid #ddd; max-width: 300px;">${call.notes}</td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="6" style="padding: 8px; text-align: center; color: #666;">No call notes found for this period</td></tr>';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Performance Report - ${dateRange}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; border-bottom: 3px solid #4F46E5; padding-bottom: 10px; }
    h2 { color: #4F46E5; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background-color: #4F46E5; color: white; padding: 12px; text-align: left; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-label { font-size: 14px; color: #666; }
    .metric-value { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>Call Center Performance Report</h1>
  <p><strong>Report Period:</strong> ${dateRange} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})</p>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

  <div class="summary">
    <h2>Executive Summary</h2>
    <div class="metric">
      <div class="metric-label">Total Calls</div>
      <div class="metric-value">${totalCalls}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Connects</div>
      <div class="metric-value">${totalConnects}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Conversions</div>
      <div class="metric-value">${totalConversions}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Total Revenue</div>
      <div class="metric-value">UGX ${totalRevenue.toLocaleString()}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Connect Rate</div>
      <div class="metric-value">${connectRate}%</div>
    </div>
    <div class="metric">
      <div class="metric-label">Conversion Rate</div>
      <div class="metric-value">${conversionRate}%</div>
    </div>
  </div>

  <h2>Agent Performance Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Agent Name</th>
        <th style="text-align: center;">Calls</th>
        <th style="text-align: center;">Connects</th>
        <th style="text-align: center;">Conversions</th>
        <th style="text-align: right;">Revenue</th>
      </tr>
    </thead>
    <tbody>
      ${agentRows}
    </tbody>
  </table>

  <h2>Detailed Call Notes</h2>
  <table>
    <thead>
      <tr>
        <th>Date & Time</th>
        <th>Agent</th>
        <th>Phone Number</th>
        <th>Lead Name</th>
        <th>Status</th>
        <th style="width: 300px;">Call Notes</th>
      </tr>
    </thead>
    <tbody>
      ${callNotesRows}
    </tbody>
  </table>

  <div class="footer">
    <p>This report was automatically generated by BetSure Call Center System</p>
    <p>For questions or concerns, please contact your system administrator</p>
  </div>
</body>
</html>`;

    return new Response(
      html,
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="performance-report-${dateRange}-${Date.now()}.html"`
        } 
      }
    );

  } catch (error) {
    console.error('Error in export-report function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
