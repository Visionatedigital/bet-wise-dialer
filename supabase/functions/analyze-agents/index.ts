import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dateRange } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date range
    let startDate = new Date();
    const endDate = new Date();
    
    switch (dateRange) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        break;
      case "last-month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
        break;
    }

    console.log('Fetching agent performance data for date range:', dateRange);

    // Fetch all profiles (agents)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email');

    if (profilesError) throw profilesError;

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({
          agents: [],
          analysis: null,
          message: 'No agents found in the system'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch call activities for all agents in date range
    const { data: callActivities, error: callsError } = await supabase
      .from('call_activities')
      .select('*')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    if (callsError) throw callsError;

    // Calculate metrics for each agent
    const agentMetrics = profiles.map(profile => {
      const agentCalls = callActivities?.filter(call => call.user_id === profile.id) || [];
      const totalCalls = agentCalls.length;
      const connects = agentCalls.filter(call => call.status === 'connected' || call.status === 'converted').length;
      const conversions = agentCalls.filter(call => call.status === 'converted').length;
      const totalRevenue = agentCalls.reduce((sum, call) => sum + (Number(call.deposit_amount) || 0), 0);
      const totalDuration = agentCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0);
      const avgHandleTime = totalCalls > 0 ? Math.floor(totalDuration / totalCalls) : 0;
      const conversionRate = connects > 0 ? ((conversions / connects) * 100) : 0;

      return {
        id: profile.id,
        name: profile.full_name || profile.email || 'Unknown Agent',
        calls: totalCalls,
        connects,
        conversions,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        avgHandleTime,
        revenue: totalRevenue
      };
    });

    // Filter out agents with no activity
    const activeAgents = agentMetrics.filter(agent => agent.calls > 0);

    if (activeAgents.length < 2) {
      return new Response(
        JSON.stringify({
          agents: activeAgents.map((agent, index) => ({ ...agent, rank: index + 1, score: 0 })),
          analysis: null,
          message: 'Not enough agent data for meaningful analysis. Need at least 2 agents with activity.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing', activeAgents.length, 'agents with GPT-5');

    // Analyze with GPT-5
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are an expert sales performance analyst. Analyze agent performance data and provide rankings with scores (0-100) based on multiple factors: conversion rate, total calls, revenue generated, and call handling efficiency. Provide actionable insights.`
          },
          {
            role: 'user',
            content: `Analyze these ${activeAgents.length} sales agents and rank them. Consider conversion rate (weight: 40%), total calls/activity (weight: 30%), revenue (weight: 20%), and efficiency/avg handle time (weight: 10%).

Agent Data:
${JSON.stringify(activeAgents, null, 2)}

Return your analysis in this JSON format:
{
  "rankings": [
    {
      "agentId": "agent-id",
      "rank": 1,
      "score": 95,
      "strengths": ["High conversion rate", "Consistent activity"],
      "improvements": ["Could increase call volume"]
    }
  ],
  "insights": ["Overall team insight 1", "Overall team insight 2"]
}`
          }
        ],
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log('GPT-5 analysis response received');

    // Parse the JSON response
    let analysis;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      analysis = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', parseError);
      throw new Error('Failed to parse AI analysis');
    }

    // Merge rankings with agent data
    const rankedAgents = activeAgents.map(agent => {
      const ranking = analysis.rankings.find((r: any) => r.agentId === agent.id) || {
        rank: 999,
        score: 0,
        strengths: [],
        improvements: []
      };
      return { ...agent, ...ranking };
    }).sort((a, b) => a.rank - b.rank);

    return new Response(
      JSON.stringify({
        agents: rankedAgents,
        insights: analysis.insights || [],
        message: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-agents function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});