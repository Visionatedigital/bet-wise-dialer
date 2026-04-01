import { useState, useEffect, useRef } from 'react';

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
      setSpokenWords([]);
      setFullTranscript('');
      setIsConnected(false);
      return;
    }

    console.log('[SpeechTracking] 🎤 Speech recognition stubbed (Node.js API migration in progress)...');
    setIsConnected(false);

    return () => {
      // Cleanup
    };
  }, [isCallActive]);

  const sendAudioData = (audioData: ArrayBuffer) => {
    // Stub
  };

  return {
    spokenWords,
    fullTranscript,
    isConnected,
    sendAudioData
  };
};
