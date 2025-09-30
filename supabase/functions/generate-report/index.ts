import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startDate, endDate, includeAgents, includeMetrics, includeQueues } = await req.json();
    
    console.log('Generating report for:', { startDate, endDate, includeAgents, includeMetrics, includeQueues });

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch data based on selections
    let reportData: any = {};

    if (includeMetrics) {
      const { data: callActivities } = await supabase
        .from('call_activities')
        .select('status, duration_seconds, start_time, deposit_amount')
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`);
      
      reportData.metrics = {
        totalCalls: callActivities?.length || 0,
        answered: callActivities?.filter(c => c.status === 'connected' || c.status === 'converted').length || 0,
        conversions: callActivities?.filter(c => c.status === 'converted').length || 0,
        totalDeposits: callActivities?.reduce((sum, c) => sum + (c.deposit_amount || 0), 0) || 0,
        avgHandleTime: callActivities && callActivities.length > 0 
          ? Math.floor(callActivities.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callActivities.length)
          : 0,
      };
    }

    if (includeAgents) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('full_name, email');
      
      const { data: callActivities } = await supabase
        .from('call_activities')
        .select('user_id, duration_seconds, status')
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`);

      reportData.agents = profiles?.map((profile: any) => {
        const agentCalls = callActivities?.filter((c: any) => c.user_id === profile.id) || [];
        return {
          name: profile.full_name || profile.email,
          totalCalls: agentCalls.length,
          conversions: agentCalls.filter((c: any) => c.status === 'converted').length,
          totalDuration: agentCalls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0),
        };
      }) || [];
    }

    if (includeQueues) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('name, status, total_calls, total_conversions, total_deposits');
      
      reportData.campaigns = campaigns || [];
    }

    // Create prompt for GPT-5
    const prompt = `You are a professional call center analyst. Generate a comprehensive report based on the following data for the period from ${startDate} to ${endDate}:

${JSON.stringify(reportData, null, 2)}

Create a well-formatted, professional report with the following sections:
1. Executive Summary - Key highlights and overall performance
2. ${includeMetrics ? 'Performance Metrics - Detailed analysis of call metrics, conversion rates, and handle times' : ''}
3. ${includeAgents ? 'Agent Performance - Individual agent statistics and performance analysis' : ''}
4. ${includeQueues ? 'Campaign Analysis - Campaign-wise breakdown and insights' : ''}
5. Recommendations - Actionable insights and recommendations for improvement

Format the report with clear headings, bullet points, and paragraphs. Make it professional and easy to read.`;

    console.log('Calling OpenAI GPT-5...');

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
            content: 'You are a professional call center analyst who creates detailed, actionable reports.'
          },
          { role: 'user', content: prompt }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const report = data.choices[0].message.content;

    console.log('Report generated successfully');

    return new Response(
      JSON.stringify({ report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-report function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
