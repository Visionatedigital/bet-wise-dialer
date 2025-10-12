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
    console.log('========================================');
    console.log('[WebRTC-Token] 📡 Token request received');
    
    const apiKey = Deno.env.get('AFRICASTALKING_API_KEY');
    const username = Deno.env.get('AFRICASTALKING_USERNAME');
    const phoneNumber = Deno.env.get('AFRICASTALKING_PHONE_NUMBER');

    console.log('[WebRTC-Token] Checking credentials...');
    console.log('[WebRTC-Token] Has API Key:', !!apiKey);
    console.log('[WebRTC-Token] Has Username:', !!username);
    console.log('[WebRTC-Token] Has Phone Number:', !!phoneNumber);

    if (!apiKey || !username || !phoneNumber) {
      console.error('[WebRTC-Token] ❌ Missing credentials');
      throw new Error('Missing Africa\'s Talking credentials');
    }

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[WebRTC-Token] ❌ No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[WebRTC-Token] ✅ Auth header present');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    console.log('[WebRTC-Token] 🔍 Validating user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[WebRTC-Token] ❌ User validation failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a unique client name for this user
    const clientName = `agent_${user.id.substring(0, 8)}`;
    console.log('[WebRTC-Token] ✅ User validated');
    console.log('[WebRTC-Token] User ID:', user.id);
    console.log('[WebRTC-Token] Client name:', clientName);

    // Request capability token from Africa's Talking
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log('[WebRTC-Token] 📞 Requesting capability token from Africa\'s Talking...');
    console.log('[WebRTC-Token] Phone number:', formattedPhone);
    console.log('[WebRTC-Token] Username:', username);
    
    const requestBody = {
      username: username,
      clientName: clientName,
      phoneNumber: formattedPhone,
      incoming: "true",
      outgoing: "true"
    };
    console.log('[WebRTC-Token] Request body:', requestBody);
    
    const response = await fetch('https://webrtc.africastalking.com/capability-token/request', {
      method: 'POST',
      headers: {
        'apiKey': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('[WebRTC-Token] Response status:', response.status);
    console.log('[WebRTC-Token] Response body:', responseText);

    if (!response.ok) {
      console.error('[WebRTC-Token] ❌ Africa\'s Talking API error');
      console.error('[WebRTC-Token] Status:', response.status);
      console.error('[WebRTC-Token] Body:', responseText);
      console.log('========================================');
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
    console.log('[WebRTC-Token] ✅ Token received successfully');
    console.log('[WebRTC-Token] Token (first 30 chars):', data.token?.substring(0, 30) + '...');
    console.log('[WebRTC-Token] Client name:', data.clientName);
    console.log('[WebRTC-Token] Lifetime:', data.lifeTimeSec);
    console.log('========================================');

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
    console.error('========================================');
    console.error('[WebRTC-Token] ❌❌❌ ERROR ❌❌❌');
    console.error('[WebRTC-Token] Error:', error);
    console.error('[WebRTC-Token] Error message:', error instanceof Error ? error.message : 'Unknown');
    console.error('[WebRTC-Token] Stack:', error instanceof Error ? error.stack : 'No stack');
    console.log('========================================');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
