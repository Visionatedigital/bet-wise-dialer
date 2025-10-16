import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[OpenAI Webhook] Received request');
    console.log('[OpenAI Webhook] Method:', req.method);
    console.log('[OpenAI Webhook] Headers:', Object.fromEntries(req.headers.entries()));

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the webhook payload
    const payload = await req.json();
    console.log('[OpenAI Webhook] Payload:', JSON.stringify(payload, null, 2));

    // Process the webhook event based on type
    const eventType = payload.type || payload.event;
    console.log('[OpenAI Webhook] Event type:', eventType);

    // Here you can add logic to:
    // - Store transcripts in Supabase
    // - Trigger AI analysis
    // - Update call records
    // - Send notifications

    switch (eventType) {
      case 'transcript.chunk':
        console.log('[OpenAI Webhook] Transcript chunk received:', payload.text);
        break;
      case 'call.completed':
        console.log('[OpenAI Webhook] Call completed:', payload.call_id);
        break;
      case 'analysis.ready':
        console.log('[OpenAI Webhook] Analysis ready:', payload.analysis);
        break;
      default:
        console.log('[OpenAI Webhook] Unknown event type:', eventType);
    }

    // Return success response
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Webhook received',
      event_type: eventType 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[OpenAI Webhook] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
