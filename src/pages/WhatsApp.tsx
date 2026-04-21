import { useState, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ConversationList } from "@/components/whatsapp/ConversationList";
import { MessageThread } from "@/components/whatsapp/MessageThread";
import { Card } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
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
      toast.error("WhatsApp integration is not available in this version");
      setSearchParams({}, { replace: true });
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
