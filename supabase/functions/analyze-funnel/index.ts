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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { dateRange, campaignId } = await req.json();

    // Calculate date range
    let endDate = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
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
        endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
        break;
    }

    // Fetch call activities
    let query = supabaseClient
      .from('call_activities')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString());

    if (campaignId && campaignId !== 'all') {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: calls, error } = await query;

    if (error) throw error;

    // Calculate funnel metrics
    const totalCalls = calls?.length || 0;
    const connects = calls?.filter(c => c.status === 'connected' || c.status === 'converted').length || 0;
    const conversions = calls?.filter(c => c.status === 'converted').length || 0;
    
    // Assume we have a way to track "qualified" leads (e.g., calls over 2 minutes that connected)
    const qualified = calls?.filter(c => 
      (c.status === 'connected' || c.status === 'converted') && 
      (c.duration_seconds || 0) > 120
    ).length || 0;

    const funnelData = {
      dials: totalCalls,
      connects: connects,
      qualified: qualified,
      conversions: conversions,
      connectRate: totalCalls > 0 ? (connects / totalCalls * 100).toFixed(1) : 0,
      qualificationRate: connects > 0 ? (qualified / connects * 100).toFixed(1) : 0,
      conversionRate: qualified > 0 ? (conversions / qualified * 100).toFixed(1) : 0,
    };

    // Check if we have enough data
    if (totalCalls < 10) {
      return new Response(
        JSON.stringify({
          insights: null,
          message: "Not enough data to analyze. Continue making calls to unlock AI-powered insights and improvement opportunities.",
          funnelData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call OpenAI to analyze funnel data
    const systemPrompt = `You are a sales performance analyst specializing in call center metrics. Analyze the funnel data and provide actionable insights and improvement opportunities.

Format your response as a JSON array of insights. Each insight should have:
- type: "opportunity", "warning", or "insight"
- title: A clear, concise title
- description: 2-3 sentences explaining the insight and recommended action
- impact: "High", "Medium", or "Low"
- category: The category of insight (e.g., "Conversion Optimization", "Call Quality", "Process Improvement")

Focus on:
1. Drop-off rates between funnel stages
2. Specific improvement opportunities with estimated impact
3. Comparative benchmarks (industry average connect rate is ~70%, qualification rate is ~60%, conversion rate is ~25%)
4. Actionable recommendations`;

    const userPrompt = `Analyze this call funnel data and provide 3-4 key insights with improvement opportunities:

Funnel Metrics:
- Total Dials: ${funnelData.dials}
- Connects: ${funnelData.connects} (${funnelData.connectRate}% connect rate)
- Qualified: ${funnelData.qualified} (${funnelData.qualificationRate}% of connects)
- Conversions: ${funnelData.conversions} (${funnelData.conversionRate}% of qualified)

Time Period: ${dateRange}`;

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
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;

    // Try to parse JSON from the response
    let insights;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = analysisText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       analysisText.match(/\[[\s\S]*\]/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysisText;
      insights = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: return raw text
      insights = [{
        type: 'insight',
        title: 'AI Analysis',
        description: analysisText,
        impact: 'Medium',
        category: 'General'
      }];
    }

    return new Response(
      JSON.stringify({ insights, funnelData, message: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-funnel function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
