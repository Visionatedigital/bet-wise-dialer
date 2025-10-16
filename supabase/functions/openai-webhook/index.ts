import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify OpenAI webhook signature
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedSignature = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return signature === expectedSignature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[OpenAI Webhook] Received request');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bodyText = await req.text();
    const signature = req.headers.get('x-openai-signature');
    const webhookSecret = Deno.env.get('OPENAI_WEBHOOK_SECRET');

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      const isValid = await verifySignature(bodyText, signature, webhookSecret);
      if (!isValid) {
        console.error('[OpenAI Webhook] Invalid signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = JSON.parse(bodyText);
    console.log('[OpenAI Webhook] Event:', payload.type);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle OpenAI Realtime API events
    switch (payload.type) {
      case 'session.created':
        console.log('[OpenAI Webhook] Session created:', payload.session);
        break;

      case 'conversation.item.created':
        console.log('[OpenAI Webhook] Item created:', payload.item);
        // Store transcript in database if needed
        if (payload.item?.content) {
          const sessionId = payload.session_id;
          // You can store this in call_activities or a new transcripts table
        }
        break;

      case 'response.audio_transcript.delta':
        console.log('[OpenAI Webhook] Transcript delta:', payload.delta);
        break;

      case 'response.audio_transcript.done':
        console.log('[OpenAI Webhook] Transcript complete:', payload.transcript);
        break;

      case 'response.done':
        console.log('[OpenAI Webhook] Response complete');
        break;

      case 'error':
        console.error('[OpenAI Webhook] Error event:', payload.error);
        break;

      default:
        console.log('[OpenAI Webhook] Unhandled event:', payload.type);
    }

    return new Response(JSON.stringify({ 
      success: true,
      received: payload.type 
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
