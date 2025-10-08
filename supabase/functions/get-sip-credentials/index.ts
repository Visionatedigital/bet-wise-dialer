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
    const SIP_USERNAME = Deno.env.get('AFRICASTALKING_SIP_USERNAME');
    const SIP_PASSWORD = Deno.env.get('AFRICASTALKING_SIP_PASSWORD');

    if (!SIP_USERNAME || !SIP_PASSWORD) {
      throw new Error('SIP credentials not configured');
    }

    return new Response(
      JSON.stringify({ 
        username: SIP_USERNAME,
        password: SIP_PASSWORD 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching SIP credentials:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
