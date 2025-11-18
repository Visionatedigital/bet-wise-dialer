import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Start Conversation] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No auth header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user from JWT explicitly
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      console.error('[Start Conversation] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phoneNumber } = await req.json();

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number - normalize to international format without spaces
    let formattedPhone = phoneNumber.trim().replace(/\s+/g, ''); // Remove all spaces
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }
    console.log(`[Start Conversation] User ${user.id} starting conversation with ${formattedPhone}`);

    // Get user's profile to determine which phone number to use
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: agentProfile } = await supabaseService
      .from('profiles')
      .select('manager_id')
      .eq('id', user.id)
      .single();

    // Manager-based phone number mapping
    const PHILIMON_MANAGER_ID = 'a99ff448-86f3-411a-91d1-d86d8a7572bc';
    const OLIVIOUS_MANAGER_ID = '244ebc76-658d-43e7-903e-d7b13d2900e0';
    
    let phoneNumberId: string;
    let displayPhoneNumber: string;
    
    if (agentProfile?.manager_id === PHILIMON_MANAGER_ID || user.id === PHILIMON_MANAGER_ID) {
      phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
      displayPhoneNumber = '256792170575';
    } else if (agentProfile?.manager_id === OLIVIOUS_MANAGER_ID || user.id === OLIVIOUS_MANAGER_ID) {
      phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID_2')!;
      displayPhoneNumber = '256792170572';
    } else {
      // Default to first phone number
      phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
      displayPhoneNumber = '256792170575';
    }

    // Check if conversation already exists
    const { data: existing, error: checkError } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('agent_id', user.id)
      .eq('contact_phone', formattedPhone)
      .maybeSingle();

    if (checkError) {
      console.error('[Start Conversation] Error checking existing:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing conversation', details: checkError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existing) {
      console.log(`[Start Conversation] Conversation already exists: ${existing.id}`);
      return new Response(
        JSON.stringify({ conversationId: existing.id, isNew: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new conversation with phone_number_id
    const { data: newConv, error: insertError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        agent_id: user.id,
        contact_phone: formattedPhone,
        contact_name: formattedPhone,
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Start Conversation] Error creating conversation:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create conversation', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Start Conversation] Created new conversation: ${newConv.id}`);

    return new Response(
      JSON.stringify({ conversationId: newConv.id, isNew: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Start Conversation] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
