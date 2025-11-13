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

    // Format phone number
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    console.log(`[Start Conversation] User ${user.id} starting conversation with ${formattedPhone}`);

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

    // Create new conversation
    const { data: newConv, error: insertError } = await supabase
      .from('whatsapp_conversations')
      .insert({
        agent_id: user.id,
        contact_phone: formattedPhone,
        contact_name: formattedPhone,
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
