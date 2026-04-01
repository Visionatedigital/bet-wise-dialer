import { useEffect, useState } from 'react';

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

    setLoading(true);
    // WhatsApp feature stubbed out as backend is not implemented yet
    setMessages([]);
    setLoading(false);

  }, [conversationId]);

  const markAsRead = async () => {
    if (!conversationId) return;
    console.log('[WhatsApp] Marking conversation as read:', conversationId);
  };

  return { messages, loading, markAsRead };
};
