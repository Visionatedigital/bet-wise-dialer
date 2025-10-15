import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TranscriptSegment {
  timestamp: Date;
  text: string;
  speaker: 'agent' | 'customer';
}

export const useLiveTranscription = () => {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  const encodeAudioToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64Audio = base64String.split(',')[1];
        resolve(base64Audio);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const transcribeAudioChunk = async (audioBlob: Blob) => {
    try {
      const base64Audio = await encodeAudioToBase64(audioBlob);
      
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { 
          audio: base64Audio,
          format: 'webm'
        }
      });

      if (error) throw error;

      if (data?.text && data.text.trim()) {
        const newSegment: TranscriptSegment = {
          timestamp: new Date(),
          text: data.text,
          speaker: 'customer' // Default to customer, can be enhanced with speaker detection
        };
        
        setTranscript(prev => [...prev, newSegment]);
        return data.text;
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Failed to transcribe audio segment');
    }
    return null;
  };

  const startRecording = useCallback(async (stream: MediaStream) => {
    try {
      // Create MediaRecorder with the call audio stream
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

      // Send audio chunks every 3 seconds for transcription
      recordingIntervalRef.current = window.setInterval(async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          
          // Wait a bit for the final dataavailable event
          setTimeout(() => {
            if (audioChunksRef.current.length > 0) {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              transcribeAudioChunk(audioBlob);
              
              // Reset for next chunk
              audioChunksRef.current = [];
              
              // Restart recording
              if (mediaRecorderRef.current) {
                mediaRecorderRef.current.start();
              }
            }
          }, 100);
        }
      }, 3000); // Transcribe every 3 seconds

      console.log('Live transcription started');
    } catch (error) {
      console.error('Error starting transcription:', error);
      toast.error('Failed to start live transcription');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Transcribe final chunk
      setTimeout(() => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          transcribeAudioChunk(audioBlob);
          audioChunksRef.current = [];
        }
      }, 100);
    }

    setIsRecording(false);
    console.log('Live transcription stopped');
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  return {
    transcript,
    isRecording,
    startRecording,
    stopRecording,
    clearTranscript
  };
};
