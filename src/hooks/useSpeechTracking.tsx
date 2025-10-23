import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseSpeechTrackingProps {
  isCallActive: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
}

export const useSpeechTracking = ({ isCallActive, onTranscriptUpdate }: UseSpeechTrackingProps) => {
  const [spokenWords, setSpokenWords] = useState<string[]>([]);
  const [fullTranscript, setFullTranscript] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isCallActive) {
      // Reset when call ends
      setSpokenWords([]);
      setFullTranscript('');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Connect to speech recognition WebSocket
    const connectToSpeechRecognition = async () => {
      try {
        console.log('[SpeechTracking] 🎤 Initializing speech recognition...');
        
        // Get ephemeral token for OpenAI Realtime API
        const { data, error } = await supabase.functions.invoke('get-realtime-token');
        
        if (error) {
          console.error('[SpeechTracking] ❌ Error getting token:', error);
          throw error;
        }
        
        if (!data?.client_secret?.value) {
          console.error('[SpeechTracking] ❌ No token in response:', data);
          throw new Error('Failed to get ephemeral token');
        }

        const token = data.client_secret.value;
        const model = 'gpt-4o-realtime-preview-2024-12-17';
        
        console.log('[SpeechTracking] 🔗 Connecting to WebSocket...');
        const ws = new WebSocket(
          `wss://api.openai.com/v1/realtime?model=${model}`,
          ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1']
        );

        ws.onopen = () => {
          console.log('[SpeechTracking] ✅ WebSocket connected, sending session config...');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Wait for session.created before configuring
            if (message.type === 'session.created') {
              console.log('[SpeechTracking] 📋 Session created, configuring...');
              ws.send(JSON.stringify({
                type: 'session.update',
                session: {
                  modalities: ['text', 'audio'],
                  instructions: 'You are transcribing the agent\'s speech. Provide accurate transcriptions of everything they say.',
                  voice: 'alloy',
                  input_audio_format: 'pcm16',
                  output_audio_format: 'pcm16',
                  input_audio_transcription: {
                    model: 'whisper-1'
                  },
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500
                  },
                  temperature: 0.8
                }
              }));
            }
            
            // Handle transcription events
            if (message.type === 'conversation.item.input_audio_transcription.completed') {
              const transcript = message.transcript || '';
              console.log('[SpeechTracking] 📝 Transcript received:', transcript);
              
              if (transcript.trim()) {
                const words = transcript.split(' ').filter((w: string) => w.length > 0);
                setSpokenWords(prev => [...prev, ...words]);
                setFullTranscript(prev => prev ? `${prev} ${transcript}` : transcript);
                onTranscriptUpdate?.(transcript);
              }
            } else if (message.type === 'input_audio_buffer.speech_started') {
              console.log('[SpeechTracking] 🗣️ Speech started');
            } else if (message.type === 'input_audio_buffer.speech_stopped') {
              console.log('[SpeechTracking] 🛑 Speech stopped');
            } else if (message.type === 'error') {
              console.error('[SpeechTracking] ❌ API Error:', message);
            }
          } catch (err) {
            console.error('[SpeechTracking] ❌ Error parsing message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('[SpeechTracking] ❌ WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = (event) => {
          console.log('[SpeechTracking] 🔌 WebSocket closed:', event.code, event.reason);
          setIsConnected(false);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('[SpeechTracking] ❌ Error initializing:', error);
        setIsConnected(false);
      }
    };

    connectToSpeechRecognition();

    return () => {
      if (wsRef.current) {
        console.log('[SpeechTracking] 🧹 Cleaning up WebSocket...');
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isCallActive]);

  const sendAudioData = (audioData: ArrayBuffer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Convert audio to base64
      const uint8Array = new Uint8Array(audioData);
      const binaryString = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');
      const base64Audio = btoa(binaryString);

      wsRef.current.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }));
    }
  };

  return {
    spokenWords,
    fullTranscript,
    isConnected,
    sendAudioData
  };
};
