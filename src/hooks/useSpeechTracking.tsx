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
      return;
    }

    // Connect to speech recognition WebSocket
    const connectToSpeechRecognition = async () => {
      try {
        console.log('[SpeechTracking] Initializing speech recognition...');
        
        // Get ephemeral token for OpenAI Realtime API
        const { data, error } = await supabase.functions.invoke('get-realtime-token');
        
        if (error) throw error;
        if (!data?.client_secret?.value) {
          throw new Error('Failed to get ephemeral token');
        }

        const token = data.client_secret.value;
        const model = 'gpt-4o-realtime-preview-2024-12-17';
        
        const ws = new WebSocket(
          `wss://api.openai.com/v1/realtime?model=${model}`,
          ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1']
        );

        ws.onopen = () => {
          console.log('[SpeechTracking] WebSocket connected');
          setIsConnected(true);

          // Configure session for audio transcription only
          ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: 'Transcribe the agent speech in real-time.',
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
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle transcription events
            if (message.type === 'conversation.item.input_audio_transcription.completed') {
              const transcript = message.transcript || '';
              console.log('[SpeechTracking] Transcript:', transcript);
              
              if (transcript) {
                const words = transcript.split(' ').filter((w: string) => w.length > 0);
                setSpokenWords(prev => [...prev, ...words]);
                setFullTranscript(prev => prev ? `${prev} ${transcript}` : transcript);
                onTranscriptUpdate?.(transcript);
              }
            } else if (message.type === 'input_audio_buffer.speech_started') {
              console.log('[SpeechTracking] Speech started');
            } else if (message.type === 'input_audio_buffer.speech_stopped') {
              console.log('[SpeechTracking] Speech stopped');
            }
          } catch (err) {
            console.error('[SpeechTracking] Error parsing message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('[SpeechTracking] WebSocket error:', error);
          setIsConnected(false);
        };

        ws.onclose = () => {
          console.log('[SpeechTracking] WebSocket closed');
          setIsConnected(false);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('[SpeechTracking] Error initializing:', error);
      }
    };

    connectToSpeechRecognition();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isCallActive]); // Removed onTranscriptUpdate to prevent infinite loop

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
