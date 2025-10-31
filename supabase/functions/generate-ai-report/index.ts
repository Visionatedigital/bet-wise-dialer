import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callActivities, dateRange, verbosity, focusArea } = await req.json();

    if (!callActivities || callActivities.length === 0) {
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
    const conversions = statusCounts['converted'] || 0;
    const connects = statusCounts['connected'] || 0;
    const totalDeposits = callActivities.reduce((sum: number, call: any) => 
      sum + (Number(call.deposit_amount) || 0), 0
    );
    const avgDuration = callActivities.reduce((sum: number, call: any) => 
      sum + (Number(call.duration_seconds) || 0), 0
    ) / totalCalls;

    // Build data summary for AI
    const dataSummary = `
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
- Conversions: ${conversions}
- Conversion Rate: ${((conversions / totalCalls) * 100).toFixed(1)}%
- Total Deposits: UGX ${totalDeposits.toLocaleString()}
- Average Call Duration: ${Math.round(avgDuration)} seconds

Call Notes Analysis:
${Object.entries(notesAnalysis).map(([pattern, count]) => 
  `- ${pattern}: ${count} calls (${((count / totalCalls) * 100).toFixed(1)}%)`
).join('\n')}
`;

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

    const userPrompt = `${dataSummary}

${verbosityInstruction}
${focusInstruction}

Please provide:
1. Executive Summary
2. Key Performance Highlights
3. Notable Patterns from Call Notes
4. Areas of Concern
5. Specific Actionable Recommendations

Format the report in clear sections with bullet points where appropriate.`;

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
      throw new Error('Failed to generate AI insights');
    }

    const data = await response.json();
    const report = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-ai-report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
