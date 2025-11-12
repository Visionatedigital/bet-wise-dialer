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
    const verifyToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle webhook verification
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { status: 200 });
      } else {
        console.error('Verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // Handle incoming messages
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Webhook received:', JSON.stringify(body, null, 2));

      // Process webhook data
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) {
        return new Response(JSON.stringify({ status: 'no_value' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Handle incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          const fromPhone = message.from;
          const messageText = message.text?.body || '';
          const messageId = message.id;
          const timestamp = new Date(parseInt(message.timestamp) * 1000);

          console.log('Processing message:', { fromPhone, messageText, messageId });

          // Find agent configuration for this phone number
          const phoneNumberId = value.metadata?.phone_number_id;
          const { data: agentConfig } = await supabase
            .from('agent_whatsapp_config')
            .select('user_id')
            .eq('phone_number_id', phoneNumberId)
            .eq('is_active', true)
            .single();

          if (!agentConfig) {
            console.error('No agent found for phone_number_id:', phoneNumberId);
            continue;
          }

          // Get or create conversation
          let { data: conversation } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .eq('agent_id', agentConfig.user_id)
            .eq('contact_phone', fromPhone)
            .single();

          if (!conversation) {
            // Create new conversation
            const contactName = value.contacts?.[0]?.profile?.name || fromPhone;
            const { data: newConversation, error: convError } = await supabase
              .from('whatsapp_conversations')
              .insert({
                agent_id: agentConfig.user_id,
                contact_phone: fromPhone,
                contact_name: contactName,
                last_message_text: messageText,
                last_message_at: timestamp,
                unread_count: 1,
              })
              .select()
              .single();

            if (convError || !newConversation) {
              console.error('Error creating conversation:', convError);
              continue;
            }
            conversation = newConversation;
          } else {
            // Update existing conversation
            await supabase
              .from('whatsapp_conversations')
              .update({
                last_message_text: messageText,
                last_message_at: timestamp,
                unread_count: supabase.rpc('increment', { x: 1 }),
              })
              .eq('id', conversation.id);
          }

          // Ensure conversation exists before inserting message
          if (!conversation) {
            console.error('No conversation available');
            continue;
          }

          // Insert message
          const { error: messageError } = await supabase
            .from('whatsapp_messages')
            .insert({
              conversation_id: conversation.id,
              whatsapp_message_id: messageId,
              sender_type: 'user',
              content: messageText,
              timestamp: timestamp,
              status: 'delivered',
            });

          if (messageError) {
            console.error('Error inserting message:', messageError);
          }
        }
      }

      // Handle status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          const messageId = status.id;
          const statusValue = status.status; // sent, delivered, read

          console.log('Status update:', { messageId, statusValue });

          // Update message status
          await supabase
            .from('whatsapp_messages')
            .update({ status: statusValue })
            .eq('whatsapp_message_id', messageId);
        }
      }

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
