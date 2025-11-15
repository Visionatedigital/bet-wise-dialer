import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface WhatsAppConversation {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export const useWhatsAppConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      // Use Edge Function for server-side processing
      const { data, error } = await supabase.functions.invoke('whatsapp-get-conversations');

      if (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
        return;
      }

      setConversations(data?.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConversations();

    if (!user) return;

    // Subscribe to realtime updates
    const channel = supabase
      .channel('whatsapp_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
          filter: `agent_id=eq.${user.id}`,
        },
        fetchConversations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  return { conversations, loading };
};
