import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization') || '';

    // Parse body early to support public fallback
    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const { conversationId, phoneNumber, message, agentId } = body;

    let supabase;
    let actingAgentId: string | null = null;

    if (authHeader) {
      // Try to authenticate with user's JWT for RLS
      const userToken = authHeader.replace('Bearer ', '');
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
      if (user && !userError) {
        actingAgentId = user.id;
        console.log('Authenticated user:', actingAgentId);
      } else {
        console.warn('Auth failed, falling back to service role mode', userError);
      }
    }

    if (!actingAgentId) {
      // Public/test mode: require agentId and use service role to bypass RLS
      if (!agentId) {
        throw new Error('Unauthorized: provide a valid JWT or include agentId in request body');
      }
      actingAgentId = agentId;
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    if (!supabase) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    console.log('Send message request:', { conversationId, phoneNumber, message, actingAgentId });

    let conversation;

    if (conversationId) {
      // Get existing conversation
      const { data, error: convError } = await supabase
        .from('whatsapp_conversations')
        .select('agent_id, contact_phone')
        .eq('id', conversationId)
        .eq('agent_id', actingAgentId)
        .single();

      if (convError || !data) {
        throw new Error('Conversation not found');
      }
      conversation = { id: conversationId, ...data };
    } else if (phoneNumber) {
      // Look for existing conversation or create new one
      const { data: existing } = await supabase
        .from('whatsapp_conversations')
        .select('id, agent_id, contact_phone')
        .eq('agent_id', actingAgentId)
        .eq('contact_phone', phoneNumber)
        .single();

      if (existing) {
        conversation = existing;
      } else {
        // Create new conversation
        const { data: newConv, error: createError } = await supabase
          .from('whatsapp_conversations')
          .insert({
            agent_id: actingAgentId,
            contact_phone: phoneNumber,
            contact_name: phoneNumber, // Will be updated when they reply
          })
          .select()
          .single();

        if (createError || !newConv) {
          throw new Error('Failed to create conversation');
        }
        conversation = newConv;
      }
    } else {
      throw new Error('Either conversationId or phoneNumber required');
    }

    // Get agent's WhatsApp configuration
    const { data: agentConfig, error: configError } = await supabase
      .from('agent_whatsapp_config')
      .select('phone_number_id')
      .eq('user_id', actingAgentId)
      .eq('is_active', true)
      .single();

    if (configError || !agentConfig) {
      throw new Error('Agent WhatsApp configuration not found');
    }

    // Send message via WhatsApp Business API
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v21.0/${agentConfig.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: conversation.contact_phone,
          type: 'text',
          text: {
            body: message,
          },
        }),
      }
    );

    const whatsappData = await whatsappResponse.json();
    console.log('WhatsApp API response:', whatsappData);

    if (!whatsappResponse.ok) {
      throw new Error(`WhatsApp API error: ${JSON.stringify(whatsappData)}`);
    }

    const messageId = whatsappData.messages?.[0]?.id;

    // Save message to database
    const { data: savedMessage, error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        conversation_id: conversation.id,
        whatsapp_message_id: messageId,
        sender_type: 'agent',
        content: message,
        timestamp: new Date().toISOString(),
        status: 'sent',
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
    }

    // Update conversation
    await supabase
      .from('whatsapp_conversations')
      .update({
        last_message_text: message,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: savedMessage,
        whatsappMessageId: messageId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
