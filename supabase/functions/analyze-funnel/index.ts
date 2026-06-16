import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[analyze-funnel] Function invoked, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[analyze-funnel] Starting request processing...');
    
    // Parse request body with error handling
    let dateRange = '30d';
    let campaignId = null;
    let managerId = null;
    try {
      const body = await req.json();
      dateRange = body.dateRange || '30d';
      campaignId = body.campaignId || null;
      managerId = body.managerId || null;
      console.log('[analyze-funnel] Request params:', { dateRange, campaignId, managerId });
    } catch (parseError) {
      console.warn('[analyze-funnel] Failed to parse request body, using defaults:', parseError);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing');
      return new Response(
        JSON.stringify({
          insights: null,
          message: 'Server configuration error. Please contact support.',
          funnelData: {
            dials: 0,
            connects: 0,
            qualified: 0,
            conversions: 0,
            connectRate: "0",
            qualificationRate: "0",
            conversionRate: "0"
          }
        }),
        { 
          status: 200, // Return 200 instead of 500
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use service role key for admin access
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('[analyze-funnel] Supabase client created, managerId:', managerId);
    
    // If managerId is provided, we'll use it to filter team data
    // If not provided, we'll fetch all data (for admin users)
    // The frontend should always pass managerId for managers

    // Calculate date range
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    switch (dateRange) {
      case "today":
        break;
      case "yesterday":
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "last-month":
        startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "quarter":
        startDate.setDate(startDate.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    // Determine which users' data to fetch
    let userIds: string[] = [];
    
    if (managerId) {
      // Check if managerId is actually a manager or an agent
      // First, try to fetch team agents for this manager
      const { data: teamAgents, error: teamError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('manager_id', managerId)
        .eq('approved', true);
      
      if (teamError) {
        console.error('[analyze-funnel] Error fetching team agents:', teamError);
        return new Response(
          JSON.stringify({
            insights: null,
            message: "Failed to load team data",
            funnelData: {
              dials: 0,
              connects: 0,
              qualified: 0,
              conversions: 0,
              connectRate: "0",
              qualificationRate: "0",
              conversionRate: "0"
            }
          }),
          { 
            status: 200, // Return 200 instead of 500
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      userIds = teamAgents?.map((a: any) => a.id) || [];
      console.log('[analyze-funnel] Found', userIds.length, 'team agents for manager');
      
      // If no team agents found, check if managerId is actually an agent (not a manager)
      // In this case, use the managerId itself as the userId
      if (userIds.length === 0) {
        // Check if this user exists and is an agent
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('id')
          .eq('id', managerId)
          .single();
        
        if (userProfile) {
          // This is an agent viewing their own data
          userIds = [managerId];
          console.log('[analyze-funnel] managerId is an agent, using their own ID:', managerId);
        } else {
          console.log('[analyze-funnel] No team agents found and user not found');
          return new Response(
            JSON.stringify({
              insights: null,
              message: "No agents assigned to your team. Assign agents to see team performance insights.",
              funnelData: {
                dials: 0,
                connects: 0,
                qualified: 0,
                conversions: 0,
                connectRate: "0",
                qualificationRate: "0",
                conversionRate: "0"
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // No managerId provided - return error
      console.log('[analyze-funnel] No managerId provided');
      return new Response(
        JSON.stringify({
          insights: null,
          message: "Manager ID required. Please contact support if this error persists.",
          funnelData: {
            dials: 0,
            connects: 0,
            qualified: 0,
            conversions: 0,
            connectRate: "0",
            qualificationRate: "0",
            conversionRate: "0"
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch call activities - use range to get ALL calls, not just first 1000
    let query = supabaseClient
      .from('call_activities')
      .select('*')
      .in('user_id', userIds)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .range(0, 9999); // Bypass default 500-row PostgREST cap

    if (campaignId && campaignId !== 'all') {
      query = query.eq('campaign_id', campaignId);
    }
    
    // Apply range limit AFTER all filters to ensure we get ALL matching records
    query = query.range(0, 99999); // Fetch up to 100,000 records to include ALL calls

    const { data: calls, error: callsError } = await query;

    if (callsError) {
      console.error('[analyze-funnel] Error fetching call activities:', callsError);
      return new Response(
        JSON.stringify({
          insights: null,
          message: "Failed to load call data",
          funnelData: {
            dials: 0,
            connects: 0,
            qualified: 0,
            conversions: 0,
            connectRate: "0",
            qualificationRate: "0",
            conversionRate: "0"
          }
        }),
        { 
          status: 200, // Return 200 instead of 500
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate funnel metrics with error handling
    const totalCalls = calls?.length || 0;
    // Connects = calls that actually rang and were answered (duration > 0 OR status is converted)
    const connects = calls?.filter((c: any) => 
      c?.status === 'converted' || (c?.status === 'connected' && (Number(c?.duration_seconds) || 0) > 0)
    ).length || 0;
    const conversions = calls?.filter((c: any) => c?.status === 'converted').length || 0;
    
    // Qualified = calls that actually rang, were answered, and lasted more than 2 minutes
    const qualified = calls?.filter((c: any) => {
      const isConnected = c?.status === 'converted' || 
        (c?.status === 'connected' && (Number(c?.duration_seconds) || 0) > 0);
      return isConnected && (Number(c?.duration_seconds) || 0) > 120;
    }).length || 0;

    const funnelData = {
      dials: totalCalls,
      connects: connects,
      qualified: qualified,
      conversions: conversions,
      connectRate: totalCalls > 0 ? (connects / totalCalls * 100).toFixed(1) : 0,
      qualificationRate: connects > 0 ? (qualified / connects * 100).toFixed(1) : 0,
      conversionRate: qualified > 0 ? (conversions / qualified * 100).toFixed(1) : 0,
    };

    console.log(`[analyze-funnel] Data summary: ${totalCalls} calls, ${connects} connects, ${conversions} conversions, dateRange: ${dateRange}, managerId: ${managerId || 'none'}`);

    // Lower threshold to 5 calls for insights (was 10)
    if (totalCalls < 5) {
      console.log(`[analyze-funnel] Insufficient data: ${totalCalls} calls (minimum: 5)`);
      return new Response(
        JSON.stringify({
          insights: null,
          message: "Not enough data to analyze. Continue making calls to unlock AI-powered insights and improvement opportunities.",
          funnelData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.warn('[analyze-funnel] ❌ OpenAI API key not configured in environment variables');
      console.warn('[analyze-funnel] Available env vars:', Object.keys(Deno.env.toObject()).filter(k => k.includes('OPENAI') || k.includes('SUPABASE')));
      return new Response(
        JSON.stringify({
          insights: null,
          message: "AI analysis unavailable. Basic funnel metrics shown above.",
          funnelData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[analyze-funnel] ✅ OpenAI API key found (length: ${openAIApiKey.length}, starts with: ${openAIApiKey.substring(0, 7)})`);
    console.log(`[analyze-funnel] Calling OpenAI API with ${totalCalls} calls data`);

    // Call OpenAI to analyze funnel data
    const systemPrompt = `You are a sales performance analyst specializing in call center metrics. Analyze the funnel data and provide actionable insights and improvement opportunities.

Format your response as a JSON object with an "insights" key containing an array. Each insight should have:
- type: "opportunity", "warning", or "insight"
- title: A clear, concise title
- description: 2-3 sentences explaining the insight and recommended action
- impact: "High", "Medium", or "Low"
- category: The category of insight (e.g., "Conversion Optimization", "Call Quality", "Process Improvement")

Focus on:
1. Drop-off rates between funnel stages
2. Specific improvement opportunities with estimated impact
3. Comparative benchmarks (industry average connect rate is ~70%, qualification rate is ~60%, conversion rate is ~25%)
4. Actionable recommendations

IMPORTANT: Return ONLY valid JSON object with this exact structure: {"insights": [...]}, no markdown formatting, no code blocks.`;

    const userPrompt = `Analyze this call funnel data and provide 3-4 key insights with improvement opportunities:

Funnel Metrics:
- Total Dials: ${funnelData.dials}
- Connects: ${funnelData.connects} (${funnelData.connectRate}% connect rate)
- Qualified: ${funnelData.qualified} (${funnelData.qualificationRate}% of connects)
- Conversions: ${funnelData.conversions} (${funnelData.conversionRate}% of qualified)

Time Period: ${dateRange}

Return a JSON object with this structure: {"insights": [array of insights]}, no markdown, no code blocks.`;

    try {
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
          response_format: { type: 'json_object' }, // Force JSON response
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[analyze-funnel] ❌ OpenAI API call failed:', response.status, response.statusText);
        console.error('[analyze-funnel] Error details:', errorText);
        // Return funnel data without AI insights instead of throwing
        return new Response(
          JSON.stringify({
            insights: null,
            message: "AI analysis temporarily unavailable. Basic funnel metrics shown above.",
            funnelData
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[analyze-funnel] ✅ OpenAI API call successful');

      const data = await response.json();
      console.log('[analyze-funnel] OpenAI response structure:', {
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        hasMessage: !!data.choices?.[0]?.message,
        hasContent: !!data.choices?.[0]?.message?.content
      });
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('[analyze-funnel] Invalid response format from OpenAI API:', JSON.stringify(data, null, 2));
        // Return funnel data without AI insights
        return new Response(
          JSON.stringify({
            insights: null,
            message: "AI analysis temporarily unavailable. Basic funnel metrics shown above.",
            funnelData
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const analysisText = data.choices[0].message.content;
      console.log(`[analyze-funnel] Received OpenAI response (${analysisText.length} chars), preview:`, analysisText.substring(0, 200));

      // Try to parse JSON from the response
      let insights;
      try {
        // First try parsing directly (if response_format: json_object was used)
        let jsonText = analysisText.trim();
        
        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
          const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
          }
        }
        
        // Try parsing as JSON object first (if response_format was json_object)
        let parsed = JSON.parse(jsonText);
        
        // If it's an object with an "insights" key, extract that
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (parsed.insights && Array.isArray(parsed.insights)) {
            insights = parsed.insights;
          } else if (parsed.insight && Array.isArray(parsed.insight)) {
            insights = parsed.insight;
          } else {
            // Convert object to array
            insights = [parsed];
          }
        } else if (Array.isArray(parsed)) {
          insights = parsed;
        } else {
          insights = [parsed];
        }
        
        // Ensure insights is an array
        if (!Array.isArray(insights)) {
          console.warn('[analyze-funnel] Insights is not an array, converting:', typeof insights);
          insights = [insights];
        }
        
        // Validate insight structure
        insights = insights.map((insight: any) => {
          if (!insight.type) insight.type = 'insight';
          if (!insight.title) insight.title = 'Performance Insight';
          if (!insight.description) insight.description = insight.content || 'No description available';
          if (!insight.impact) insight.impact = 'Medium';
          if (!insight.category) insight.category = 'General';
          return insight;
        });
        
        console.log(`[analyze-funnel] Successfully parsed ${insights.length} insights`);
      } catch (parseError) {
        console.error('[analyze-funnel] Failed to parse AI response as JSON:', parseError);
        console.error('[analyze-funnel] Raw text (first 500 chars):', analysisText.substring(0, 500));
        
        // Try to extract insights from text format
        try {
          // Look for array pattern in text
          const arrayMatch = analysisText.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            insights = JSON.parse(arrayMatch[0]);
            console.log('[analyze-funnel] Extracted insights from text pattern');
          } else {
            throw new Error('No JSON array found in response');
          }
        } catch (secondParseError) {
          console.error('[analyze-funnel] Second parse attempt also failed:', secondParseError);
          // Fallback: return raw text as a single insight
          insights = [{
            type: 'insight',
            title: 'AI Analysis',
            description: analysisText.substring(0, 500),
            impact: 'Medium',
            category: 'General'
          }];
        }
      }

      console.log(`[analyze-funnel] Returning ${insights?.length || 0} insights`);
      return new Response(
        JSON.stringify({ insights, funnelData, message: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      console.error('[analyze-funnel] ❌ Exception during OpenAI API call:', fetchError);
      console.error('[analyze-funnel] Error details:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      return new Response(
        JSON.stringify({
          insights: null,
          message: "AI analysis temporarily unavailable. Basic funnel metrics shown above.",
          funnelData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[analyze-funnel] ❌ Unhandled error in function:', error);
    console.error('[analyze-funnel] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[analyze-funnel] Error name:', error instanceof Error ? error.name : typeof error);
    // Always return 200 with error message instead of 500 to prevent UI breaking
    return new Response(
      JSON.stringify({ 
        insights: null,
        message: "Analysis temporarily unavailable. Please try again later.",
        funnelData: {
          dials: 0,
          connects: 0,
          qualified: 0,
          conversions: 0,
          connectRate: "0",
          qualificationRate: "0",
          conversionRate: "0"
        }
      }),
      { 
        status: 200, // Return 200 instead of 500
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
