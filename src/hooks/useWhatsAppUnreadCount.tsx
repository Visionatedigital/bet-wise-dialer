import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useWhatsAppUnreadCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('unread_count')
      .eq('agent_id', user.id);

    if (error) {
      console.error('Error fetching unread count:', error);
      return;
    }

    const total = data?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0;
    setUnreadCount(total);
  };

  useEffect(() => {
    fetchUnreadCount();

    if (!user) return;

    // Subscribe to conversation changes
    const conversationChannel = supabase
      .channel('whatsapp_unread_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations',
          filter: `agent_id=eq.${user.id}`,
        },
        fetchUnreadCount
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
        },
        fetchUnreadCount
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
    };
  }, [user]);

  return unreadCount;
};
