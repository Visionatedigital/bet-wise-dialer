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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { callActivities, dateRange, verbosity, focusArea, agentContext, teamMetrics } = await req.json();

    // Validate input
    if (!callActivities) {
      return new Response(
        JSON.stringify({ error: 'callActivities is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(callActivities)) {
      return new Response(
        JSON.stringify({ error: 'callActivities must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callActivities.length === 0) {
      return new Response(
        JSON.stringify({ report: "No call activities found for the selected period." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze the data
    const totalCalls = callActivities.length;
    const uniqueAgents = [...new Set(callActivities.map((c: any) => c.profiles?.full_name).filter(Boolean))];
    const uniqueCampaigns = [...new Set(callActivities.map((c: any) => c.campaigns?.name).filter(Boolean))];
    
    // Aggregate call statuses
    const statusCounts: Record<string, number> = {};
    callActivities.forEach((call: any) => {
      const status = call.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Analyze notes patterns
    const notesAnalysis: Record<string, number> = {};
    callActivities.forEach((call: any) => {
      if (call.notes) {
        const lowerNotes = call.notes.toLowerCase();
        // Common patterns
        if (lowerNotes.includes('switched off') || lowerNotes.includes('off')) {
          notesAnalysis['Switched Off'] = (notesAnalysis['Switched Off'] || 0) + 1;
        }
        if (lowerNotes.includes('promised') || lowerNotes.includes('will deposit')) {
          notesAnalysis['Promised to Deposit'] = (notesAnalysis['Promised to Deposit'] || 0) + 1;
        }
        if (lowerNotes.includes('not interested') || lowerNotes.includes('no interest')) {
          notesAnalysis['Not Interested'] = (notesAnalysis['Not Interested'] || 0) + 1;
        }
        if (lowerNotes.includes('callback') || lowerNotes.includes('call back')) {
          notesAnalysis['Requested Callback'] = (notesAnalysis['Requested Callback'] || 0) + 1;
        }
        if (lowerNotes.includes('busy')) {
          notesAnalysis['Busy'] = (notesAnalysis['Busy'] || 0) + 1;
        }
      }
    });

    // Calculate metrics
    // Only count calls that actually rang and were answered (duration > 0 OR status is converted)
    const connects = callActivities.filter((call: any) => {
      if (call.status === 'converted') return true;
      if (call.status === 'connected') {
        return (Number(call.duration_seconds) || 0) > 0;
      }
      return false;
    }).length;
    const conversions = statusCounts['converted'] || 0;
    const totalDeposits = callActivities.reduce((sum: number, call: any) => 
      sum + (Number(call.deposit_amount) || 0), 0
    );
    const avgDuration = callActivities.reduce((sum: number, call: any) => 
      sum + (Number(call.duration_seconds) || 0), 0
    ) / totalCalls;

    // Build data summary for AI
    let dataSummary = '';
    
    if (agentContext) {
      // Agent-specific report
      dataSummary = `
Agent Performance Report for ${agentContext.agentName}:
- Period: ${dateRange}
- Agent Email: ${agentContext.email}

Key Performance Indicators (KPIs):
- Total Calls Made: ${agentContext.totalCalls} (Target: 60 calls/day)
- Calls Per Hour: ${agentContext.callsPerHour || (agentContext.totalCalls / (8 * (dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : dateRange === 'quarter' ? 90 : 1))).toFixed(1)} (Target: 7.5 calls/hour)
- Connects: ${agentContext.connects} (Target: 40 connects/day)
- Connect Rate: ${agentContext.connectRate}% (Target: 70%)
- Conversions: ${agentContext.conversions} (Target: 12 conversions/day)
- Conversion Rate (Conversation Rate): ${agentContext.conversionRate}% (Target: 25%)
- Total Revenue Generated: UGX ${agentContext.totalRevenue.toLocaleString()}
- Average Handle Time: ${Math.floor(agentContext.avgHandleTime / 60)}:${(agentContext.avgHandleTime % 60).toString().padStart(2, '0')} (Target: 3-5 minutes)

Call Outcomes:
${Object.entries(statusCounts).map(([status, count]) => 
  `- ${status}: ${count} (${((count / totalCalls) * 100).toFixed(1)}%)`
).join('\n')}

Call Notes Analysis:
${Object.entries(notesAnalysis).map(([pattern, count]) => 
  `- ${pattern}: ${count} calls (${((count / totalCalls) * 100).toFixed(1)}%)`
).join('\n')}

Performance Assessment:
- ${agentContext.totalCalls >= 60 ? '✓' : '⚠'} Call Volume: ${agentContext.totalCalls >= 60 ? 'Exceeded' : 'Below'} daily target (${agentContext.totalCalls}/60)
- ${agentContext.connectRate >= 70 ? '✓' : '⚠'} Connect Rate: ${agentContext.connectRate >= 70 ? 'Excellent' : agentContext.connectRate >= 50 ? 'Moderate' : 'Needs Improvement'} (${agentContext.connectRate}% vs 70% target)
- ${agentContext.conversionRate >= 25 ? '✓' : '⚠'} Conversion Rate: ${agentContext.conversionRate >= 25 ? 'Strong' : agentContext.conversionRate >= 15 ? 'Moderate' : 'Needs Coaching'} (${agentContext.conversionRate}% vs 25% target)
`;
    } else {
      // Team-wide report
      dataSummary = `
Call Center Performance Data:
- Period: ${dateRange}
- Total Calls: ${totalCalls}
- Unique Agents: ${uniqueAgents.length} (${uniqueAgents.join(', ')})
- Campaigns: ${uniqueCampaigns.length} (${uniqueCampaigns.join(', ')})

Call Outcomes:
${Object.entries(statusCounts).map(([status, count]) => 
  `- ${status}: ${count} (${((count / totalCalls) * 100).toFixed(1)}%)`
).join('\n')}

Key Metrics:
- Total Calls: ${totalCalls}
- Calls Per Hour: ${teamMetrics?.callsPerHour || ((totalCalls / (8 * (dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : dateRange === 'quarter' ? 90 : 1))).toFixed(1))} (Target: 7.5 calls/hour)
- Connects: ${connects}
- Connect Rate: ${totalCalls > 0 ? ((connects / totalCalls) * 100).toFixed(1) : '0.0'}%
- Conversions: ${conversions}
- Conversion Rate (Conversation Rate): ${connects > 0 ? ((conversions / connects) * 100).toFixed(1) : '0.0'}%
- Total Deposits: UGX ${totalDeposits.toLocaleString()}
- Average Handle Time: ${teamMetrics?.avgHandleTime ? `${Math.floor(teamMetrics.avgHandleTime / 60)}:${(teamMetrics.avgHandleTime % 60).toString().padStart(2, '0')}` : `${Math.round(avgDuration)} seconds`} (Target: 3-5 minutes)

Call Notes Analysis:
${Object.entries(notesAnalysis).map(([pattern, count]) => 
  `- ${pattern}: ${count} calls (${((count / totalCalls) * 100).toFixed(1)}%)`
).join('\n')}
`;
    }

    // Build AI prompt based on verbosity and focus
    let systemPrompt = "You are a call center performance analyst. Analyze the data and provide actionable insights.";
    
    let verbosityInstruction = "";
    if (verbosity === "concise") {
      verbosityInstruction = "Keep the report brief and highlight only the most critical insights (2-3 paragraphs).";
    } else if (verbosity === "balanced") {
      verbosityInstruction = "Provide a balanced report with key insights and actionable recommendations (4-5 paragraphs).";
    } else {
      verbosityInstruction = "Provide a comprehensive analysis with detailed insights, trends, and specific recommendations for each area (6-8 paragraphs).";
    }

    let focusInstruction = "";
    if (focusArea === "conversion") {
      focusInstruction = "Focus primarily on conversion rates, deposit values, and opportunities to improve sales outcomes.";
    } else if (focusArea === "efficiency") {
      focusInstruction = "Focus on call efficiency metrics like duration, connect rates, and agent productivity.";
    } else if (focusArea === "quality") {
      focusInstruction = "Focus on call quality indicators from notes, common objections, and customer interaction patterns.";
    } else {
      focusInstruction = "Provide balanced analysis across conversion, efficiency, and quality metrics.";
    }

    let userPrompt = '';
    
    if (agentContext) {
      userPrompt = `${dataSummary}

${verbosityInstruction}
${focusInstruction}

Please provide an agent-specific performance report with:
1. Executive Summary - Overall performance assessment
2. KPI Performance Analysis - Detailed breakdown of each KPI vs targets
3. Strengths - What the agent is doing well
4. Areas for Improvement - Specific metrics that need attention
5. Actionable Coaching Recommendations - Concrete steps to improve performance
6. Goal Setting - Suggested targets for next period

Focus on providing personalized, constructive feedback that helps the agent understand their performance and how to improve. Be specific about which KPIs need attention and why.`;
    } else {
      userPrompt = `${dataSummary}

${verbosityInstruction}
${focusInstruction}

Please provide:
1. Executive Summary
2. Key Performance Highlights
3. Notable Patterns from Call Notes
4. Areas of Concern
5. Specific Actionable Recommendations

Format the report in clear sections with bullet points where appropriate.`;
    }

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: verbosity === "detailed" ? 2000 : verbosity === "balanced" ? 1200 : 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      let errorMessage = 'Failed to generate AI insights';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // If parsing fails, use the error text directly
        errorMessage = errorText || errorMessage;
      }
      throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response structure:', JSON.stringify(data));
      throw new Error('Invalid response from OpenAI API');
    }
    const report = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-ai-report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    console.error('Error details:', errorDetails);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: process.env.DENO_ENV === 'development' ? errorDetails : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
