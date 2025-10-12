import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('AFRICASTALKING_API_KEY');
    const username = Deno.env.get('AFRICASTALKING_USERNAME');
    const phoneNumber = Deno.env.get('AFRICASTALKING_PHONE_NUMBER');

    if (!apiKey || !username || !phoneNumber) {
      throw new Error('Missing Africa\'s Talking credentials');
    }

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a unique client name for this user
    const clientName = `agent_${user.id.substring(0, 8)}`;

    console.log('[WebRTC] Requesting capability token for:', clientName);

    // Request capability token from Africa's Talking
    const response = await fetch('https://webrtc.africastalking.com/capability-token/request', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        clientName: clientName,
        phoneNumber: phoneNumber,
        incoming: true,
        outgoing: true,
        expire: '86400' // 24 hours
      }),
    });

    const responseText = await response.text();
    console.log('[WebRTC] Response status:', response.status);
    console.log('[WebRTC] Response body:', responseText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get capability token',
          details: responseText,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);

    return new Response(
      JSON.stringify({ 
        success: true,
        token: data.token,
        clientName: data.clientName,
        lifeTimeSec: data.lifeTimeSec
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[WebRTC] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
