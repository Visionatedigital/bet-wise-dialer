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
    
    // Manager-based phone number mapping
    const PHILIMON_MANAGER_ID = 'a99ff448-86f3-411a-91d1-d86d8a7572bc';
    const OLIVIOUS_MANAGER_ID = '244ebc76-658d-43e7-903e-d7b13d2900e0';
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization') || '';

    // Parse body early to support public fallback
    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const { conversationId, phoneNumber, message, agentId, mediaUrl, mediaType, templateName, templateLanguage, templateParams } = body;

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

    console.log('Send message request:', { conversationId, phoneNumber, message, actingAgentId, mediaUrl });

    let phoneNumberId: string;
    let accessToken: string;

    // Validate message content (allow empty if media is present)
    if ((!message || message.trim().length === 0) && !mediaUrl) {
      console.error('Empty message and no media provided');
      throw new Error('Message content or media is required');
    }

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
      // Normalize phone number - add + prefix if missing
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      
      // Look for existing conversation or create new one
      const { data: existing } = await supabase
        .from('whatsapp_conversations')
        .select('id, agent_id, contact_phone')
        .eq('agent_id', actingAgentId)
        .eq('contact_phone', formattedPhone)
        .single();

      if (existing) {
        conversation = existing;
      } else {
        // Create new conversation
        const { data: newConv, error: createError } = await supabase
          .from('whatsapp_conversations')
          .insert({
            agent_id: actingAgentId,
            contact_phone: formattedPhone,
            contact_name: formattedPhone, // Will be updated when they reply
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

    // Check 24-hour customer care window based on last inbound user message
    let requiresTemplate = false;
    try {
      const { data: lastInbound } = await supabase
        .from('whatsapp_messages')
        .select('timestamp')
        .eq('conversation_id', conversation.id)
        .eq('sender_type', 'user')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (lastInbound?.timestamp) {
        const lastInboundAt = new Date(lastInbound.timestamp as unknown as string).getTime();
        requiresTemplate = (Date.now() - lastInboundAt) > 24 * 60 * 60 * 1000;
      } else {
        // No inbound message from user = must use template (can't send free-form to new numbers)
        requiresTemplate = true;
      }
    } catch (e) {
      console.warn('Could not determine last inbound timestamp, requiring template', e);
      requiresTemplate = true;
    }

    if (requiresTemplate && !templateName) {
      return new Response(
        JSON.stringify({
          error: 'WHATSAPP_24H_WINDOW',
          message: 'Cannot send message: Customer has not replied yet or last reply was more than 24h ago. Send a WhatsApp template message to start/re-engage.',
          details: { conversationId: conversation.id }
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine phone_number_id and access token
    const PHONE_NUMBER_ID_1 = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
    const PHONE_NUMBER_ID_2 = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID_2')!;
    const ACCESS_TOKEN_1 = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!;
    const ACCESS_TOKEN_2 = Deno.env.get('WHATSAPP_ACCESS_TOKEN_2')!;

    // Check if conversation has phone_number_id stored
    const { data: convWithPhone } = await supabase
      .from('whatsapp_conversations')
      .select('phone_number_id')
      .eq('id', conversation.id)
      .single();

    if (convWithPhone?.phone_number_id) {
      // Use the stored phone_number_id
      phoneNumberId = convWithPhone.phone_number_id;
      accessToken = phoneNumberId === PHONE_NUMBER_ID_1 ? ACCESS_TOKEN_1 : ACCESS_TOKEN_2;
      console.log(`Using stored phone number: ${phoneNumberId === PHONE_NUMBER_ID_1 ? '1' : '2'}`);
    } else {
      // Determine from agent's manager
      const { data: agentProfile } = await supabase
        .from('profiles')
        .select('manager_id')
        .eq('id', actingAgentId)
        .single();

      if (agentProfile?.manager_id === PHILIMON_MANAGER_ID || actingAgentId === PHILIMON_MANAGER_ID) {
        phoneNumberId = PHONE_NUMBER_ID_1;
        accessToken = ACCESS_TOKEN_1;
        console.log('Using phone number 1 for Philimon team');
      } else if (agentProfile?.manager_id === OLIVIOUS_MANAGER_ID || actingAgentId === OLIVIOUS_MANAGER_ID) {
        phoneNumberId = PHONE_NUMBER_ID_2;
        accessToken = ACCESS_TOKEN_2;
        console.log('Using phone number 2 for Olivious team');
      } else {
        // Default to first phone number
        phoneNumberId = PHONE_NUMBER_ID_1;
        accessToken = ACCESS_TOKEN_1;
        console.log('Using default phone number 1');
      }

      // Update conversation with phone_number_id
      await supabase
        .from('whatsapp_conversations')
        .update({
          phone_number_id: phoneNumberId,
          display_phone_number: phoneNumberId === PHONE_NUMBER_ID_1 ? '256792170575' : '256792170572'
        })
        .eq('id', conversation.id);
    }

    // Send message via WhatsApp Business API
    // Strip + from phone number to match Meta's format
    const cleanPhone = conversation.contact_phone.replace(/^\+/, '');
    
    let whatsappPayload: any = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
    };

    // If a template is specified (or required), send as a template message
    if (templateName) {
      whatsappPayload.type = 'template';
      whatsappPayload.template = {
        name: templateName,
        language: { code: templateLanguage || 'en' },
        components: Array.isArray(templateParams) && templateParams.length > 0
          ? [
              {
                type: 'body',
                parameters: templateParams.map((p: string) => ({ type: 'text', text: String(p) }))
              }
            ]
          : undefined,
      };
    } else if (mediaUrl && mediaType) {
      // Media message
      const mediaTypeCategory = mediaType.startsWith('image/') ? 'image' : 
                               mediaType.startsWith('video/') ? 'video' :
                               mediaType.startsWith('audio/') ? 'audio' : 'document';
      whatsappPayload.type = mediaTypeCategory;
      whatsappPayload[mediaTypeCategory] = {
        link: mediaUrl,
        caption: message || ''
      };
    } else {
      // Text only message
      whatsappPayload.type = 'text';
      whatsappPayload.text = {
        preview_url: false,
        body: message,
      };
    }
    
    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(whatsappPayload),
      }
    );

    const whatsappData = await whatsappResponse.json();
    console.log('WhatsApp API response:', whatsappData);

    if (!whatsappResponse.ok) {
      const code = (whatsappData && (whatsappData.error?.code || whatsappData.errors?.[0]?.code)) || null;
      if (code === 131047) {
        return new Response(
          JSON.stringify({
            error: 'WHATSAPP_24H_WINDOW',
            message: 'Customer last replied more than 24h ago. Send a WhatsApp template to re-engage.',
            details: { conversationId: conversation.id }
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
        content: templateName ? `Template: ${templateName}` : (message || '📎 Media'),
        media_url: mediaUrl || null,
        media_type: mediaType || null,
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
