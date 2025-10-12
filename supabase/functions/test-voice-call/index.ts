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
    const { phoneNumber } = await req.json();
    
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Get credentials from environment
    const apiKey = Deno.env.get('AFRICASTALKING_API_KEY')!;
    const username = Deno.env.get('AFRICASTALKING_USERNAME')!;
    const fromNumber = Deno.env.get('AFRICASTALKING_PHONE_NUMBER')!;
    
    if (!apiKey || !username || !fromNumber) {
      throw new Error('Africa\'s Talking credentials not configured. Missing: ' + 
        (!apiKey ? 'API_KEY ' : '') + 
        (!username ? 'USERNAME ' : '') + 
        (!fromNumber ? 'PHONE_NUMBER' : ''));
    }

    const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '***masked***';

    console.log('[AT] Making call to:', phoneNumber);
    console.log('[AT] Using username:', username);
    console.log('[AT] From number:', fromNumber);
    console.log('[AT] API key (masked):', maskedKey);

    // Format phone number (ensure it starts with +)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    // Africa's Talking only has one voice endpoint
    // Sandbox vs Production is determined by API key, not URL
    const baseUrl = 'https://voice.africastalking.com';

    console.log('[AT] Attempting call via:', `${baseUrl}/call`);
    
    const response = await fetch(`${baseUrl}/call`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': apiKey,
      },
      body: new URLSearchParams({
        'username': username,
        'to': formattedPhone,
        'from': fromNumber,
      }).toString(),
    });

    const responseText = await response.text();
    let responseData: any;
    try { responseData = JSON.parse(responseText); } catch { responseData = { rawResponse: responseText }; }

    console.log('[AT] Response status:', response.status);
    console.log('[AT] Response body:', responseText);

    if (!response.ok) {
      const errorHint = response.status === 401 
        ? 'Authentication failed. Verify your AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME are correct and match the same environment (sandbox/production).'
        : 'Call failed';
        
      return new Response(
        JSON.stringify({ 
          error: errorHint,
          details: responseData,
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Call initiated successfully',
        data: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error making call:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
