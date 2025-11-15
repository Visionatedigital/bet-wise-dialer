import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  whatsapp_message_id: string | null;
  sender_type: 'agent' | 'user';
  content: string;
  media_url: string | null;
  media_type: string | null;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

export const useWhatsAppMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages((data || []) as WhatsAppMessage[]);
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to realtime updates for incremental changes
    const channel = supabase
      .channel('whatsapp_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[WhatsApp] New message received:', payload.new);
          setMessages((current) => {
            // Check if message already exists (prevent duplicates)
            if (current.some(m => m.id === payload.new.id)) {
              return current;
            }
            return [...current, payload.new as WhatsAppMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[WhatsApp] Message updated:', payload.new);
          setMessages((current) =>
            current.map((msg) =>
              msg.id === payload.new.id ? (payload.new as WhatsAppMessage) : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[WhatsApp] Message deleted:', payload.old);
          setMessages((current) =>
            current.filter((msg) => msg.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const markAsRead = async () => {
    if (!conversationId) return;

    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  };

  return { messages, loading, markAsRead };
};
