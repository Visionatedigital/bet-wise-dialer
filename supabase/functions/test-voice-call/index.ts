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

    const prodBase = 'https://voice.africastalking.com';
    const sandboxBase = 'https://voice.sandbox.africastalking.com';

    // Use hint if provided via secret, otherwise infer from username
    const envHint = Deno.env.get('AFRICASTALKING_ENV')?.toLowerCase();
    let baseUrl = (username === 'sandbox' || envHint === 'sandbox') ? sandboxBase : prodBase;

    async function attemptCall(base: string) {
      console.log('[AT] Attempting call via:', `${base}/call`);
      const response = await fetch(`${base}/call`, {
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

      console.log('[AT] Response status:', response.status, 'base:', base);
      console.log('[AT] Response body:', responseText);
      return { response, responseData, base };
    }

    // First try with chosen base
    let res = await attemptCall(baseUrl);

    // If 401, try the other base automatically
    if (res.response.status === 401) {
      const fallbackBase = baseUrl === prodBase ? sandboxBase : prodBase;
      console.warn('[AT] 401 Unauthorized. Retrying with:', fallbackBase);
      const retry = await attemptCall(fallbackBase);
      if (retry.response.ok) {
        res = retry;
      } else {
        return new Response(
          JSON.stringify({
            error: 'Authentication failed',
            firstAttempt: { status: res.response.status, body: res.responseData, base: res.base },
            secondAttempt: { status: retry.response.status, body: retry.responseData, base: retry.base },
            hint: 'Check that API key and username belong to the same environment (sandbox vs production).'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!res.response.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Call failed', 
          details: res.responseData,
          status: res.response.status,
          base: res.base
        }),
        { status: res.response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Call initiated',
        data: res.responseData,
        base: res.base
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
