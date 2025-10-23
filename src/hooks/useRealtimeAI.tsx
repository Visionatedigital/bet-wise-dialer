import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeAI, AISuggestion, CallSentiment } from '@/utils/RealtimeAI';
import { toast } from 'sonner';

export const useRealtimeAI = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [sentiment, setSentiment] = useState<CallSentiment>('neutral');
  const realtimeAIRef = useRef<RealtimeAI | null>(null);

  const handleSuggestion = useCallback((suggestion: AISuggestion) => {
    console.log('[useRealtimeAI] New suggestion:', suggestion);
    setSuggestions(prev => [...prev.slice(-4), suggestion]); // Keep last 5 suggestions
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    console.log('[useRealtimeAI] Connection status:', connected);
    setIsConnected(connected);
    setIsConnecting(false);
  }, []);

  const handleSentimentChange = useCallback((newSentiment: CallSentiment) => {
    console.log('[useRealtimeAI] Sentiment changed:', newSentiment);
    setSentiment(newSentiment);
  }, []);

  const connect = useCallback(async () => {
    if (realtimeAIRef.current?.isConnected()) {
      toast.info('AI Sidekick already connected');
      return;
    }

    setIsConnecting(true);
    
    try {
      realtimeAIRef.current = new RealtimeAI(
        handleSuggestion, 
        handleConnectionChange,
        handleSentimentChange
      );
      await realtimeAIRef.current.init();
      toast.success('AI Sidekick connected and listening');
    } catch (error) {
      console.error('[useRealtimeAI] Connection error:', error);
      toast.error('Failed to connect AI Sidekick');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [handleSuggestion, handleConnectionChange, handleSentimentChange]);

  const disconnect = useCallback(() => {
    if (realtimeAIRef.current) {
      realtimeAIRef.current.disconnect();
      realtimeAIRef.current = null;
      setSuggestions([]);
      setSentiment('neutral');
      toast.info('AI Sidekick disconnected');
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      realtimeAIRef.current?.disconnect();
    };
  }, []);

  const sendContext = useCallback((context: string) => {
    if (realtimeAIRef.current && realtimeAIRef.current.isConnected()) {
      realtimeAIRef.current.sendContext(context);
    }
  }, []);

  return {
    isConnected,
    isConnecting,
    suggestions,
    sentiment,
    connect,
    disconnect,
    clearSuggestions,
    sendContext
  };
};
