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
    console.log('========================================');
    console.log('[WebRTC-Token] 📡 Token request received');
    
    const SIP_USERNAME = Deno.env.get('AFRICASTALKING_SIP_USERNAME');
    const SIP_PASSWORD = Deno.env.get('AFRICASTALKING_SIP_PASSWORD');

    if (!SIP_USERNAME || !SIP_PASSWORD) {
      console.error('[WebRTC-Token] ❌ SIP credentials not configured');
      throw new Error('SIP credentials not configured');
    }

    console.log('[WebRTC-Token] ✅ Credentials found');
    console.log('[WebRTC-Token] Username format:', SIP_USERNAME?.includes('@') ? 'Full format' : 'Short format');
    console.log('[WebRTC-Token] Returning credentials...');
    console.log('========================================');

    return new Response(
      JSON.stringify({ 
        username: SIP_USERNAME,
        password: SIP_PASSWORD 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('========================================');
    console.error('[WebRTC-Token] ❌❌❌ ERROR ❌❌❌');
    console.error('[WebRTC-Token] Error:', error);
    console.error('========================================');
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
