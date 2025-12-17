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
    console.log('[SIP-Credentials] 👤 User ID:', user.id);

    // Determine which SIP credentials to use
    // Load balance evenly across two SIP phones using user_id for consistent routing
    let SIP_USERNAME: string | undefined;
    let SIP_PASSWORD: string | undefined;
    let phoneNumber = 1;

    // Use the user's own ID for load balancing (more reliable than manager_id)
    // This ensures each user consistently uses the same SIP phone
    const userId = user.id.toString();
    
    // Hash the user ID to get a number for load balancing
    // Use multiple characters from the UUID for better distribution
    const hashChars = userId.replace(/-/g, '').substring(0, 8);
    const hashValue = parseInt(hashChars, 16);
    const usePhone2 = hashValue % 2 === 1; // Odd = phone 2, Even = phone 1

    console.log('[SIP-Credentials] 🔢 Hash value:', hashValue, '| Use Phone 2:', usePhone2);

    // Check if both phones are configured
    const phone1Username = Deno.env.get('AFRICASTALKING_SIP_USERNAME');
    const phone1Password = Deno.env.get('AFRICASTALKING_SIP_PASSWORD');
    const phone2Username = Deno.env.get('AFRICASTALKING_SIP_USERNAME_2');
    const phone2Password = Deno.env.get('AFRICASTALKING_SIP_PASSWORD_2');

    const hasPhone1 = phone1Username && phone1Password;
    const hasPhone2 = phone2Username && phone2Password;

    console.log('[SIP-Credentials] 📱 Phone 1 configured:', hasPhone1 ? 'Yes' : 'No');
    console.log('[SIP-Credentials] 📱 Phone 2 configured:', hasPhone2 ? 'Yes' : 'No');

    if (usePhone2 && hasPhone2) {
      // Use phone 2
      SIP_USERNAME = phone2Username;
      SIP_PASSWORD = phone2Password;
        phoneNumber = 2;
    } else if (!usePhone2 && hasPhone1) {
      // Use phone 1
      SIP_USERNAME = phone1Username;
      SIP_PASSWORD = phone1Password;
        phoneNumber = 1;
    } else if (hasPhone1) {
      // Fallback to phone 1 if phone 2 not configured
      SIP_USERNAME = phone1Username;
      SIP_PASSWORD = phone1Password;
      phoneNumber = 1;
      console.log('[SIP-Credentials] ⚠️ Phone 2 not configured, falling back to Phone 1');
    } else if (hasPhone2) {
      // Fallback to phone 2 if phone 1 not configured
      SIP_USERNAME = phone2Username;
      SIP_PASSWORD = phone2Password;
      phoneNumber = 2;
      console.log('[SIP-Credentials] ⚠️ Phone 1 not configured, falling back to Phone 2');
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
