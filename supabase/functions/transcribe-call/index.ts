import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callId, transcript } = await req.json();
    
    if (!callId || !transcript) {
      throw new Error('Call ID and transcript are required');
    }

    console.log('Analyzing call transcript for call:', callId);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Analyze the transcript with GPT-5 to generate key moments and coaching suggestions
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
            content: `You are an expert sales call analyst for a sports betting company in Uganda. Analyze call transcripts and provide:
1. Key moments (with timestamps in MM:SS format)
2. AI coaching suggestions for improvement

Be specific, actionable, and culturally aware of the Ugandan market.`
          },
          {
            role: 'user',
            content: `Analyze this call transcript and provide insights:

${transcript}

Please provide:
1. Key moments (3-5 critical points with timestamps and types: objection, interest, close, information, callback)
2. Coaching suggestions (3-5 specific, actionable recommendations)

Format your response as JSON with this structure:
{
  "keyMoments": [
    {"time": "MM:SS", "type": "objection|interest|close|information|callback", "text": "description"}
  ],
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`
          }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('GPT-5 analysis response:', content);

    // Parse the JSON response
    let analysis;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      analysis = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', parseError);
      throw new Error('Failed to parse AI analysis');
    }

    return new Response(
      JSON.stringify({
        keyMoments: analysis.keyMoments || [],
        suggestions: analysis.suggestions || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in transcribe-call function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});