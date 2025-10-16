import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[Realtime Stream] Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.error('[Realtime Stream] Missing OPENAI_API_KEY');
    return new Response("Server configuration error", { status: 500 });
  }

  console.log('[Realtime Stream] Upgrading to WebSocket');
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let openAISocket: WebSocket | null = null;
  let sessionId: string | null = null;

  socket.onopen = async () => {
    console.log('[Realtime Stream] Client WebSocket opened');
    
    try {
      // Connect to OpenAI Realtime API
      console.log('[Realtime Stream] Connecting to OpenAI Realtime API');
      openAISocket = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
        {
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1"
          }
        }
      );

      openAISocket.onopen = () => {
        console.log('[Realtime Stream] OpenAI WebSocket connected');
        
        // Send session configuration
        const sessionConfig = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: "You are a helpful AI assistant for a call center. Be concise and professional. Provide real-time suggestions to help agents handle customer calls effectively.",
            voice: "alloy",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "whisper-1"
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1000
            },
            temperature: 0.8,
            max_response_output_tokens: "inf"
          }
        };
        
        openAISocket?.send(JSON.stringify(sessionConfig));
        console.log('[Realtime Stream] Session config sent');
      };

      openAISocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log important events
          if (data.type === 'session.created') {
            sessionId = data.session?.id;
            console.log('[Realtime Stream] Session created:', sessionId);
          } else if (data.type === 'session.updated') {
            console.log('[Realtime Stream] Session updated');
          } else if (data.type === 'response.audio.delta') {
            // Forward audio to client
            socket.send(event.data);
          } else if (data.type === 'response.audio_transcript.delta') {
            console.log('[Realtime Stream] Transcript delta:', data.delta);
            socket.send(event.data);
          } else if (data.type === 'conversation.item.created') {
            console.log('[Realtime Stream] Item created:', data.item?.role);
            socket.send(event.data);
          } else if (data.type === 'error') {
            console.error('[Realtime Stream] OpenAI error:', data.error);
            socket.send(event.data);
          } else {
            // Forward all other events to client
            socket.send(event.data);
          }
        } catch (error) {
          console.error('[Realtime Stream] Error parsing OpenAI message:', error);
        }
      };

      openAISocket.onerror = (error) => {
        console.error('[Realtime Stream] OpenAI WebSocket error:', error);
        socket.close();
      };

      openAISocket.onclose = () => {
        console.log('[Realtime Stream] OpenAI WebSocket closed');
        socket.close();
      };

    } catch (error) {
      console.error('[Realtime Stream] Error connecting to OpenAI:', error);
      socket.close();
    }
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Forward audio and commands to OpenAI
      if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
        openAISocket.send(event.data);
        
        // Log specific event types
        if (data.type === 'input_audio_buffer.append') {
          console.log('[Realtime Stream] Audio chunk sent to OpenAI');
        } else if (data.type === 'conversation.item.create') {
          console.log('[Realtime Stream] Message sent to OpenAI:', data.item?.role);
        }
      }
    } catch (error) {
      console.error('[Realtime Stream] Error handling client message:', error);
    }
  };

  socket.onerror = (error) => {
    console.error('[Realtime Stream] Client WebSocket error:', error);
  };

  socket.onclose = () => {
    console.log('[Realtime Stream] Client WebSocket closed');
    if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
      openAISocket.close();
    }
  };

  return response;
});
