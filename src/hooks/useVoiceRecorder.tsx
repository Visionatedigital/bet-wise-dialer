import { useState, useRef, useCallback } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';

interface UseVoiceRecorderReturn {
  isRecording: boolean;
  recordingDuration: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  resetRecording: () => void;
}

export const useVoiceRecorder = (): UseVoiceRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const recorderRef = useRef<MicRecorder | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Create new MP3 recorder instance
      const recorder = new MicRecorder({ bitRate: 128 });
      recorderRef.current = recorder;
      
      await recorder.start();
      console.log('[Voice Recorder] Recording MP3 audio');
      
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (recorderRef.current && isRecording) {
      try {
        const [buffer, blob] = await recorderRef.current.stop().getMp3();
        
        // Create MP3 blob
        const mp3Blob = new Blob(buffer, { type: 'audio/mpeg' });
        setAudioBlob(mp3Blob);
        console.log('[Voice Recorder] MP3 recorded, size:', mp3Blob.size);
        
        setIsRecording(false);
        
        // Clear duration interval
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);
      setAudioBlob(null);
      setRecordingDuration(0);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    setRecordingDuration(0);
  }, []);

  return {
    isRecording,
    recordingDuration,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  };
};
