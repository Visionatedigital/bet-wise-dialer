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
    
    // Manager-based phone number mapping
    const PHILIMON_MANAGER_ID = 'a99ff448-86f3-411a-91d1-d86d8a7572bc';
    const OLIVIOUS_MANAGER_ID = '244ebc76-658d-43e7-903e-d7b13d2900e0';
    const PHONE_NUMBER_ID_1 = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!;
    const PHONE_NUMBER_ID_2 = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID_2')!;
    
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
          let fromPhone = message.from;
          // Normalize phone number - add + prefix if missing
          if (!fromPhone.startsWith('+')) {
            fromPhone = '+' + fromPhone;
          }
          
          let messageText = message.text?.body || '';
          let mediaUrl = null;
          let mediaType = null;
          
          // Handle audio/voice messages
          if (message.type === 'audio' && message.audio) {
            const mediaId = message.audio.id;
            const mimeType = message.audio.mime_type;
            
            console.log('Processing audio message:', { mediaId, mimeType });
            
            try {
              // Get WhatsApp access token
              const phoneNumberId = value.metadata?.phone_number_id;
              const accessToken = phoneNumberId === PHONE_NUMBER_ID_1 
                ? Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
                : Deno.env.get('WHATSAPP_ACCESS_TOKEN_2')!;
              
              // Step 1: Get media URL from WhatsApp
              const mediaInfoResponse = await fetch(
                `https://graph.facebook.com/v22.0/${mediaId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );
              
              const mediaInfo = await mediaInfoResponse.json();
              console.log('Media info:', mediaInfo);
              
              if (!mediaInfo.url) {
                throw new Error('No media URL in response');
              }
              
              // Step 2: Download media file
              const mediaDownloadResponse = await fetch(mediaInfo.url, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              });
              
              if (!mediaDownloadResponse.ok) {
                throw new Error(`Failed to download media: ${mediaDownloadResponse.status}`);
              }
              
              const mediaBlob = await mediaDownloadResponse.blob();
              console.log('Downloaded media, size:', mediaBlob.size);
              
              // Step 3: Upload to Supabase storage
              const fileExt = mimeType?.includes('ogg') ? 'ogg' : mimeType?.includes('mp4') ? 'm4a' : 'opus';
              const fileName = `incoming/${Date.now()}-${mediaId}.${fileExt}`;
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('whatsapp-media')
                .upload(fileName, mediaBlob, {
                  contentType: mimeType || 'audio/ogg',
                  cacheControl: '3600',
                });
              
              if (uploadError) {
                console.error('Error uploading to storage:', uploadError);
                throw uploadError;
              }
              
              // Get public URL
              const { data: { publicUrl } } = supabase.storage
                .from('whatsapp-media')
                .getPublicUrl(fileName);
              
              mediaUrl = publicUrl;
              mediaType = mimeType || 'audio/ogg';
              messageText = '🎤 Voice message';
              
              console.log('Media uploaded:', { mediaUrl, mediaType });
            } catch (error) {
              console.error('Error processing audio:', error);
              messageText = '🎤 Voice message (failed to download)';
            }
          }
          
          const messageId = message.id;
          const timestamp = new Date(parseInt(message.timestamp) * 1000);

          console.log('Processing message:', { fromPhone, messageText, messageId, mediaUrl });

          // Get metadata from webhook
          const phoneNumberId = value.metadata?.phone_number_id;
          const displayPhoneNumber = value.metadata?.display_phone_number;

          // Check if conversation already exists (for ANY agent)
          const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('id, agent_id, unread_count, phone_number_id')
            .eq('contact_phone', fromPhone)
            .limit(1)
            .single();

          let conversationId: string;
          let agentId: string;

          if (existingConv) {
            // Conversation exists - update it
            agentId = existingConv.agent_id;
            conversationId = existingConv.id;
            console.log('Routing to existing conversation:', { conversationId, agentId });

            // Update the existing conversation, including phone_number_id if not set
            const updateData: any = {
              last_message_text: messageText,
              last_message_at: timestamp,
              unread_count: (existingConv.unread_count || 0) + 1,
            };
            
            // Set phone_number_id if not already set
            if (!existingConv.phone_number_id && phoneNumberId) {
              updateData.phone_number_id = phoneNumberId;
              updateData.display_phone_number = displayPhoneNumber;
            }

            await supabase
              .from('whatsapp_conversations')
              .update(updateData)
              .eq('id', conversationId);
          } else {
            // New conversation - determine which team/agent to assign
            const phoneNumberId = value.metadata?.phone_number_id;
            const targetManagerId = phoneNumberId === PHONE_NUMBER_ID_1 
              ? PHILIMON_MANAGER_ID 
              : phoneNumberId === PHONE_NUMBER_ID_2 
              ? OLIVIOUS_MANAGER_ID 
              : null;

            if (!targetManagerId) {
              console.error('Unknown phone_number_id:', phoneNumberId);
              continue;
            }

            console.log(`New conversation on phone ${phoneNumberId === PHONE_NUMBER_ID_1 ? '1' : '2'} - routing to team`);

            // Find agent in this team
            const { data: teamAgent } = await supabase
              .from('profiles')
              .select('id')
              .or(`id.eq.${targetManagerId},manager_id.eq.${targetManagerId}`)
              .eq('approved', true)
              .limit(1)
              .single();

            if (!teamAgent) {
              console.error('No agent found for manager:', targetManagerId);
              continue;
            }
            
            agentId = teamAgent.id;
            console.log('Assigning new conversation to agent:', agentId);

            // Create new conversation with phone_number_id
            const contactName = value.contacts?.[0]?.profile?.name || fromPhone;
            const { data: newConv, error: convError } = await supabase
              .from('whatsapp_conversations')
              .insert({
                agent_id: agentId,
                contact_phone: fromPhone,
                contact_name: contactName,
                last_message_text: messageText,
                last_message_at: timestamp,
                unread_count: 1,
                phone_number_id: phoneNumberId,
                display_phone_number: displayPhoneNumber,
              })
              .select('id')
              .single();

            if (convError || !newConv) {
              console.error('Error creating conversation:', convError);
              continue;
            }
            conversationId = newConv.id;
          }

          // Insert message
          await supabase
            .from('whatsapp_messages')
            .insert({
              conversation_id: conversationId,
              whatsapp_message_id: messageId,
              sender_type: 'user',
              content: messageText,
              media_url: mediaUrl,
              media_type: mediaType,
              timestamp: timestamp,
              status: 'delivered',
            });
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
