import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeAI, AISuggestion } from '@/utils/RealtimeAI';
import { toast } from 'sonner';

export const useRealtimeAI = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
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

  const connect = useCallback(async () => {
    if (realtimeAIRef.current?.isConnected()) {
      toast.info('AI Sidekick already connected');
      return;
    }

    setIsConnecting(true);
    
    try {
      realtimeAIRef.current = new RealtimeAI(handleSuggestion, handleConnectionChange);
      await realtimeAIRef.current.init();
      toast.success('AI Sidekick connected and listening');
    } catch (error) {
      console.error('[useRealtimeAI] Connection error:', error);
      toast.error('Failed to connect AI Sidekick');
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [handleSuggestion, handleConnectionChange]);

  const disconnect = useCallback(() => {
    if (realtimeAIRef.current) {
      realtimeAIRef.current.disconnect();
      realtimeAIRef.current = null;
      setSuggestions([]);
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

  return {
    isConnected,
    isConnecting,
    suggestions,
    connect,
    disconnect,
    clearSuggestions
  };
};
