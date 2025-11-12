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
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request data
    const { conversationId, message } = await req.json();
    
    console.log('Send message request:', { conversationId, message });

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select('agent_id, contact_phone')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      throw new Error('Conversation not found');
    }

    // Get agent's WhatsApp configuration
    const { data: agentConfig, error: configError } = await supabase
      .from('agent_whatsapp_config')
      .select('phone_number_id')
      .eq('user_id', conversation.agent_id)
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
        conversation_id: conversationId,
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
      .eq('id', conversationId);

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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
