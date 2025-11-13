import { useState, useCallback, memo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ConversationList } from "@/components/whatsapp/ConversationList";
import { MessageThread } from "@/components/whatsapp/MessageThread";
import { Card } from "@/components/ui/card";

function WhatsApp() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const handleConversationDeleted = useCallback(() => {
    setSelectedConversation(null);
  }, []);

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

export default memo(WhatsApp);
