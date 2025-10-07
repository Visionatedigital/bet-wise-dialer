import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, leadName } = await req.json();

    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    const AFRICASTALKING_API_KEY = Deno.env.get('AFRICASTALKING_API_KEY');
    const AFRICASTALKING_USERNAME = Deno.env.get('AFRICASTALKING_USERNAME');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    console.log('Debug - Username exists:', !!AFRICASTALKING_USERNAME);
    console.log('Debug - API Key exists:', !!AFRICASTALKING_API_KEY);
    console.log('Debug - Username value:', AFRICASTALKING_USERNAME);
    console.log('Debug - API Key prefix:', AFRICASTALKING_API_KEY?.substring(0, 8) + '...');

    if (!AFRICASTALKING_API_KEY || !AFRICASTALKING_USERNAME) {
      throw new Error('Africa\'s Talking credentials not configured');
    }

    // Format phone number (ensure it starts with +)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    // Prepare the call request
    const callbackUrl = `${SUPABASE_URL}/functions/v1/voice-callback`;
    
    const params = new URLSearchParams({
      username: AFRICASTALKING_USERNAME,
      to: formattedPhone,
      from: '+256323200928',
      callStartUrl: callbackUrl,
    });

    console.log('Initiating call to:', formattedPhone);

    // Make the API call to Africa's Talking
    const response = await fetch('https://voice.africastalking.com/call', {
      method: 'POST',
      headers: {
        'ApiKey': AFRICASTALKING_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const responseText = await response.text();
    console.log('Africa\'s Talking response:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response:', responseText);
      throw new Error(`Invalid response from Africa's Talking: ${responseText}`);
    }

    if (!response.ok) {
      throw new Error(result.message || 'Failed to initiate call');
    }

    // Store call activity in database
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('call_activities').insert({
          user_id: user.id,
          phone_number: formattedPhone,
          lead_name: leadName,
          call_type: 'outbound',
          status: 'queued',
          start_time: new Date().toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Call initiated successfully',
        data: result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error making call:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
