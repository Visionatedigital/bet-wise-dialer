import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const useWhatsAppUnreadCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // WhatsApp feature stubbed out
    setUnreadCount(0);
  }, [user]);

  return unreadCount;
};
