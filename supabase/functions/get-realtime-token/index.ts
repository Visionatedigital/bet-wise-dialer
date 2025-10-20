import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    console.log('[Realtime Token] Requesting ephemeral token from OpenAI...');

    // Request an ephemeral token from OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: `You are an AI assistant helping a call center agent at Betsure Uganda. 
Your role is to:
1. Listen to the conversation and provide real-time suggestions
2. Detect customer sentiment and intent
3. Suggest next best actions based on what you hear
4. Alert about compliance requirements (data protection, responsible gaming, call recording consent)
5. Provide quick answers to common questions about bonuses, deposits, withdrawals
6. Warn if the agent is going off-script or missing key talking points

Provide concise, actionable suggestions. Focus on helping the agent close the sale while staying compliant.`
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Realtime Token] OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Realtime Token] Session created successfully');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Realtime Token] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
