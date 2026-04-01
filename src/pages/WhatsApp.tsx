import { useState, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ConversationList } from "@/components/whatsapp/ConversationList";
import { MessageThread } from "@/components/whatsapp/MessageThread";
import { Card } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function WhatsApp() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const phoneParam = searchParams.get('phone');

  const handleConversationDeleted = useCallback(() => {
    setSelectedConversation(null);
  }, []);

  useEffect(() => {
    const autoStartChat = async (phone: string) => {
      try {
        toast.loading("Opening WhatsApp chat...", { id: 'whatsapp-start' });

        console.log('[WhatsApp] Auto-starting conversation with:', phone);
        const { data, error } = await supabase.functions.invoke('whatsapp-start-conversation', {
          body: { phoneNumber: phone },
        });

        if (error) {
          console.error('[WhatsApp] Error starting conversation:', error);
          toast.error("Failed to start WhatsApp chat", { id: 'whatsapp-start' });
          return;
        }

        setSelectedConversation(data.conversationId);

        if (data.isNew) {
          // Send approved template to initiate conversation for new contacts
          console.log('[WhatsApp] Sending template message for new contact...');
          await supabase.functions.invoke('whatsapp-send-message', {
            body: {
              conversationId: data.conversationId,
              templateName: 'test_template_1',
              templateLanguage: 'en',
            },
          });
          toast.success("New conversation started with template", { id: 'whatsapp-start' });
        } else {
          toast.success("Conversation opened", { id: 'whatsapp-start' });
        }

        // Clear the search params so it doesn't re-trigger
        setSearchParams({}, { replace: true });
      } catch (err) {
        console.error('[WhatsApp] Unexpected error:', err);
        toast.error("An unexpected error occurred", { id: 'whatsapp-start' });
      }
    };

    if (phoneParam) {
      autoStartChat(phoneParam);
    }
  }, [phoneParam, setSearchParams]);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <Card className="h-full flex overflow-hidden">
          <ConversationList
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
          />
          <MessageThread
            conversationId={selectedConversation}
            onConversationDeleted={handleConversationDeleted}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}
