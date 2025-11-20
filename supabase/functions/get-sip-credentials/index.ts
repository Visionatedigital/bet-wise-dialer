import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    console.log('[SIP-Credentials] 📡 Credentials request received');
    
    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create Supabase client with service role to query profiles
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[SIP-Credentials] ❌ Authentication failed:', authError);
      throw new Error('Authentication failed');
    }

    console.log('[SIP-Credentials] 👤 User authenticated:', user.id);

    // Get user's profile to check manager_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('manager_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[SIP-Credentials] ❌ Failed to fetch profile:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    console.log('[SIP-Credentials] 📋 Manager ID:', profile?.manager_id || 'None');

    // Determine which SIP credentials to use based on manager_id
    // Split agents evenly across two SIP phones by using manager_id
    let SIP_USERNAME: string | undefined;
    let SIP_PASSWORD: string | undefined;
    let phoneNumber = 1;

    if (profile?.manager_id) {
      // Use the first character of manager_id UUID to determine which phone
      // This provides a deterministic split: 0-7 = phone 1, 8-f = phone 2
      const firstChar = profile.manager_id.toString().charAt(0).toLowerCase();
      const usePhone2 = parseInt(firstChar, 16) >= 8;

      if (usePhone2) {
        SIP_USERNAME = Deno.env.get('AFRICASTALKING_SIP_USERNAME_2');
        SIP_PASSWORD = Deno.env.get('AFRICASTALKING_SIP_PASSWORD_2');
        phoneNumber = 2;
      } else {
        SIP_USERNAME = Deno.env.get('AFRICASTALKING_SIP_USERNAME');
        SIP_PASSWORD = Deno.env.get('AFRICASTALKING_SIP_PASSWORD');
        phoneNumber = 1;
      }
    } else {
      // No manager assigned, use first phone as fallback
      SIP_USERNAME = Deno.env.get('AFRICASTALKING_SIP_USERNAME');
      SIP_PASSWORD = Deno.env.get('AFRICASTALKING_SIP_PASSWORD');
      phoneNumber = 1;
    }

    if (!SIP_USERNAME || !SIP_PASSWORD) {
      console.error('[SIP-Credentials] ❌ SIP credentials not configured for phone', phoneNumber);
      throw new Error('SIP credentials not configured');
    }

    console.log('[SIP-Credentials] ✅ Using SIP Phone', phoneNumber);
    console.log('[SIP-Credentials] Username format:', SIP_USERNAME?.includes('@') ? 'Full format' : 'Short format');
    console.log('[SIP-Credentials] Returning credentials...');
    console.log('========================================');

    return new Response(
      JSON.stringify({ 
        username: SIP_USERNAME,
        password: SIP_PASSWORD,
        phoneNumber 
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
