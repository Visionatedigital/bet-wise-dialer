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
    // Parse request body with error handling
    let dateRange = '30d';
    try {
      const body = await req.json();
      dateRange = body.dateRange || '30d';
    } catch (parseError) {
      console.warn('Failed to parse request body, using default dateRange:', parseError);
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({
          agents: [],
          insights: [],
          message: 'Server configuration error. Please contact support.'
        }),
        { 
          status: 200, // Return 200 with error message instead of 500
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
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

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({
          agents: [],
          insights: [],
          message: 'Failed to load agent data'
        }),
        { 
          status: 200, // Return 200 with empty data instead of 500
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({
          agents: [],
          insights: [],
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

    if (callsError) {
      console.error('Error fetching call activities:', callsError);
      // Return basic rankings with empty call data
      const rankedAgents = profiles.map((profile, index) => ({
        id: profile.id,
        name: profile.full_name || profile.email || 'Unknown Agent',
        calls: 0,
        connects: 0,
        conversions: 0,
        conversionRate: 0,
        avgHandleTime: 0,
        revenue: 0,
        rank: index + 1,
        score: 0,
        strengths: [],
        improvements: []
      }));
      
      return new Response(
        JSON.stringify({
          agents: rankedAgents,
          insights: ['Unable to load call data. Please try again later.'],
          message: null
        }),
        { 
          status: 200, // Return 200 with basic data instead of 500
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate metrics for each agent with error handling
    const agentMetrics = profiles.map(profile => {
      try {
        const agentCalls = (callActivities || []).filter((call: any) => call?.user_id === profile.id);
        const totalCalls = agentCalls.length;
        const connects = agentCalls.filter((call: any) => call?.status === 'connected' || call?.status === 'converted').length;
        const conversions = agentCalls.filter((call: any) => call?.status === 'converted').length;
        const totalRevenue = agentCalls.reduce((sum: number, call: any) => sum + (Number(call?.deposit_amount) || 0), 0);
        const totalDuration = agentCalls.reduce((sum: number, call: any) => sum + (Number(call?.duration_seconds) || 0), 0);
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
      } catch (error) {
        console.error(`Error calculating metrics for agent ${profile.id}:`, error);
        // Return zero metrics for this agent
        return {
          id: profile.id,
          name: profile.full_name || profile.email || 'Unknown Agent',
          calls: 0,
          connects: 0,
          conversions: 0,
          conversionRate: 0,
          avgHandleTime: 0,
          revenue: 0
        };
      }
    });

    // Filter out agents with no activity
    const activeAgents = agentMetrics.filter(agent => agent.calls > 0);

    console.log(`[analyze-agents] Found ${activeAgents.length} active agents out of ${agentMetrics.length} total agents`);

    if (activeAgents.length < 2) {
      console.log(`[analyze-agents] Insufficient agents: ${activeAgents.length} (minimum: 2)`);
      return new Response(
        JSON.stringify({
          agents: activeAgents.map((agent, index) => ({ ...agent, rank: index + 1, score: 0 })),
          insights: [],
          message: 'Not enough agent data for meaningful analysis. Need at least 2 agents with activity.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-agents] Analyzing ${activeAgents.length} agents with GPT-4o-mini`);

    // Analyze with GPT-4 (or fallback to GPT-3.5-turbo)
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.warn('OpenAI API key not configured, returning basic rankings');
      // Return basic rankings without AI analysis
      const rankedAgents = activeAgents
        .sort((a, b) => {
          // Sort by conversion rate (primary), then by calls (secondary)
          if (b.conversionRate !== a.conversionRate) {
            return b.conversionRate - a.conversionRate;
          }
          return b.calls - a.calls;
        })
        .map((agent, index) => ({
          ...agent,
          rank: index + 1,
          score: Math.max(0, Math.min(100, Math.round(agent.conversionRate * 0.4 + (agent.calls / 100) * 30 + (agent.revenue / 100000) * 20 + (100 - agent.avgHandleTime / 10) * 0.1))),
          strengths: [],
          improvements: []
        }));
      
      return new Response(
        JSON.stringify({
          agents: rankedAgents,
          insights: ['AI analysis unavailable. Rankings based on performance metrics.'],
          message: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use a valid model - gpt-4o-mini is cost-effective and fast
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
      
      // Return fallback rankings instead of throwing error
      const rankedAgents = activeAgents
        .sort((a, b) => {
          if (b.conversionRate !== a.conversionRate) {
            return b.conversionRate - a.conversionRate;
          }
          return b.calls - a.calls;
        })
        .map((agent, index) => ({
          ...agent,
          rank: index + 1,
          score: Math.max(0, Math.min(100, Math.round(agent.conversionRate * 0.4 + (agent.calls / 100) * 30 + (agent.revenue / 100000) * 20 + (100 - agent.avgHandleTime / 10) * 0.1))),
          strengths: [],
          improvements: []
        }));
      
      return new Response(
        JSON.stringify({
          agents: rankedAgents,
          insights: ['AI analysis temporarily unavailable. Rankings based on performance metrics.'],
          message: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response format from OpenAI API:', data);
      // Return fallback rankings instead of throwing
      const rankedAgents = activeAgents
        .sort((a, b) => {
          if (b.conversionRate !== a.conversionRate) {
            return b.conversionRate - a.conversionRate;
          }
          return b.calls - a.calls;
        })
        .map((agent, index) => ({
          ...agent,
          rank: index + 1,
          score: Math.max(0, Math.min(100, Math.round(agent.conversionRate * 0.4 + (agent.calls / 100) * 30 + (agent.revenue / 100000) * 20 + (100 - agent.avgHandleTime / 10) * 0.1))),
          strengths: [],
          improvements: []
        }));
      
      return new Response(
        JSON.stringify({
          agents: rankedAgents,
          insights: ['AI analysis temporarily unavailable. Rankings based on performance metrics.'],
          message: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const content = data.choices[0].message.content;

    console.log(`[analyze-agents] GPT analysis response received (${content.length} chars)`);

    // Parse the JSON response with better error handling
    let analysis;
    try {
      // Try to extract JSON from markdown code blocks or direct JSON
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
      
      console.log(`[analyze-agents] Attempting to parse JSON string (${jsonString.length} chars)`);
      analysis = JSON.parse(jsonString);
      
      // Validate the structure
      if (!analysis.rankings || !Array.isArray(analysis.rankings)) {
        throw new Error('Invalid analysis structure: missing rankings array');
      }
      
      // Ensure insights is an array
      if (!Array.isArray(analysis.insights)) {
        console.warn('[analyze-agents] Insights is not an array, converting:', typeof analysis.insights);
        analysis.insights = analysis.insights ? [analysis.insights] : [];
      }
      
      console.log(`[analyze-agents] Successfully parsed ${analysis.rankings.length} rankings and ${analysis.insights?.length || 0} insights`);
    } catch (parseError) {
      console.error('[analyze-agents] Failed to parse GPT response:', parseError);
      console.error('[analyze-agents] Raw content (first 500 chars):', content.substring(0, 500));
      
      // Return a fallback response with basic rankings
      const rankedAgents = activeAgents
        .sort((a, b) => {
          // Sort by conversion rate (primary), then by calls (secondary)
          if (b.conversionRate !== a.conversionRate) {
            return b.conversionRate - a.conversionRate;
          }
          return b.calls - a.calls;
        })
        .map((agent, index) => ({
          ...agent,
          rank: index + 1,
          score: Math.max(0, Math.min(100, Math.round(agent.conversionRate * 0.4 + (agent.calls / 100) * 30 + (agent.revenue / 100000) * 20 + (100 - agent.avgHandleTime / 10) * 0.1))),
          strengths: [],
          improvements: []
        }));
      
      return new Response(
        JSON.stringify({
          agents: rankedAgents,
          insights: ['AI analysis temporarily unavailable. Rankings based on performance metrics.'],
          message: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Merge rankings with agent data
    const rankedAgents = activeAgents.map(agent => {
      const ranking = analysis.rankings?.find((r: any) => r.agentId === agent.id) || {
        rank: 999,
        score: 0,
        strengths: [],
        improvements: []
      };
      return { ...agent, ...ranking };
    }).sort((a, b) => (a.rank || 999) - (b.rank || 999));

    const insights = Array.isArray(analysis.insights) ? analysis.insights : (analysis.insights ? [analysis.insights] : []);
    console.log(`[analyze-agents] Returning ${rankedAgents.length} ranked agents and ${insights.length} insights`);

    return new Response(
      JSON.stringify({
        agents: rankedAgents,
        insights: insights,
        message: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-agents function:', error);
    // Always return 200 with error message instead of 500 to prevent UI breaking
    return new Response(
      JSON.stringify({ 
        agents: [],
        insights: [],
        message: 'Agent analysis temporarily unavailable. Please try again later.'
      }),
      {
        status: 200, // Return 200 instead of 500 so UI doesn't break
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});