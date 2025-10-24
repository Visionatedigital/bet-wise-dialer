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
      throw new Error('OPENAI_API_KEY is not configured');
    }

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

    // Fetch all agents
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, status')
      .eq('approved', true);

    if (profilesError) throw profilesError;

    // Fetch call activities for all agents
    const { data: calls, error: callsError } = await supabaseClient
      .from('call_activities')
      .select('*')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    if (callsError) throw callsError;

    // Calculate metrics per agent
    const agentMetrics = profiles.map(profile => {
      const agentCalls = calls?.filter(c => c.user_id === profile.id) || [];
      const totalCalls = agentCalls.length;
      const connects = agentCalls.filter(c => c.status === 'connected' || c.status === 'converted').length;
      const conversions = agentCalls.filter(c => c.status === 'converted').length;
      const totalRevenue = agentCalls.reduce((sum, c) => sum + (c.deposit_amount || 0), 0);
      const totalDuration = agentCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      const avgHandleTime = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
      const conversionRate = connects > 0 ? ((conversions / connects) * 100).toFixed(1) : '0.0';

      return {
        id: profile.id,
        name: profile.full_name || 'Unknown Agent',
        status: profile.status || 'offline',
        calls: totalCalls,
        connects: connects,
        conversions: conversions,
        conversionRate: parseFloat(conversionRate),
        avgHandleTime: avgHandleTime,
        revenue: totalRevenue,
      };
    });

    // Filter active agents
    const activeAgents = agentMetrics.filter(a => a.calls > 0);

    if (activeAgents.length < 2) {
      return new Response(
        JSON.stringify({
          agents: agentMetrics,
          summary: "Not enough data to generate detailed AI insights. Continue tracking performance to unlock comprehensive analytics.",
          insights: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sort by performance score
    const rankedAgents = activeAgents.sort((a, b) => {
      const scoreA = (a.conversions * 100) + (a.connects * 10) + a.calls;
      const scoreB = (b.conversions * 100) + (b.connects * 10) + b.calls;
      return scoreB - scoreA;
    });

    // Calculate team averages
    const totalCalls = rankedAgents.reduce((sum, a) => sum + a.calls, 0);
    const totalConversions = rankedAgents.reduce((sum, a) => sum + a.conversions, 0);
    const totalRevenue = rankedAgents.reduce((sum, a) => sum + a.revenue, 0);
    const avgCalls = Math.round(totalCalls / rankedAgents.length);
    const avgConversions = Math.round(totalConversions / rankedAgents.length);
    const avgRevenue = Math.round(totalRevenue / rankedAgents.length);

    // Call OpenAI for analysis
    const systemPrompt = `You are a sales performance analyst for a telemarketing team. Analyze agent performance data and provide actionable insights, recommendations, and identify top performers and those who need coaching.

Format your response as JSON:
{
  "summary": "2-3 sentence executive summary of team performance",
  "insights": [
    {
      "type": "success" | "warning" | "opportunity",
      "title": "Clear title",
      "description": "Actionable insight with specific recommendations",
      "impact": "High" | "Medium" | "Low",
      "agents": ["agent names affected"]
    }
  ]
}`;

    const userPrompt = `Analyze this telemarketing team performance data:

TIME PERIOD: ${dateRange}

TEAM METRICS:
- Total Agents: ${rankedAgents.length}
- Total Calls: ${totalCalls}
- Total Conversions: ${totalConversions}
- Total Revenue: UGX ${totalRevenue.toLocaleString()}
- Team Avg Calls/Agent: ${avgCalls}
- Team Avg Conversions/Agent: ${avgConversions}
- Team Avg Revenue/Agent: UGX ${avgRevenue.toLocaleString()}

TOP 3 PERFORMERS:
${rankedAgents.slice(0, 3).map((a, i) => 
  `${i + 1}. ${a.name}: ${a.calls} calls, ${a.conversions} conversions (${a.conversionRate}%), UGX ${a.revenue.toLocaleString()}, ${a.avgHandleTime}s avg handle time`
).join('\n')}

BOTTOM 3 PERFORMERS:
${rankedAgents.slice(-3).reverse().map((a, i) => 
  `${i + 1}. ${a.name}: ${a.calls} calls, ${a.conversions} conversions (${a.conversionRate}%), UGX ${a.revenue.toLocaleString()}, ${a.avgHandleTime}s avg handle time`
).join('\n')}

Provide:
1. Overall team performance assessment
2. Identify agents exceeding KPIs and what they're doing right
3. Identify agents below KPIs and specific coaching recommendations
4. Patterns in high-performing vs low-performing agents
5. Actionable recommendations to improve team metrics`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    let analysis;
    try {
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       analysisText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysisText;
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      analysis = {
        summary: analysisText,
        insights: []
      };
    }

    return new Response(
      JSON.stringify({
        agents: agentMetrics,
        topPerformers: rankedAgents.slice(0, 3),
        summary: analysis.summary || '',
        insights: analysis.insights || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-performance function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
