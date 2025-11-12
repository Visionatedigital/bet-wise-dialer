import { useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageComposer } from "./MessageComposer";
import { format } from "date-fns";
import { Check, CheckCheck, Phone, Video, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";

interface MessageThreadProps {
  conversationId: string | null;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const { messages, loading, markAsRead } = useWhatsAppMessages(conversationId);
  const { conversations } = useWhatsAppConversations();

  const conversation = conversations.find(c => c.id === conversationId);

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markAsRead();
    }
  }, [conversationId, messages.length, markAsRead]);

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-2">Select a conversation to start messaging</p>
          <p className="text-sm">Your WhatsApp conversations will appear here</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  const displayName = conversation?.contact_name || conversation?.contact_phone || 'Unknown';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{displayName}</h3>
            <p className="text-sm text-muted-foreground">{conversation?.contact_phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.sender_type === 'agent' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg p-3",
                    message.sender_type === 'agent'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-xs opacity-70">
                      {format(new Date(message.timestamp), 'HH:mm')}
                    </span>
                    {message.sender_type === 'agent' && (
                      <>
                        {message.status === 'read' && (
                          <CheckCheck className="h-4 w-4 text-blue-400" />
                        )}
                        {message.status === 'delivered' && (
                          <CheckCheck className="h-4 w-4" />
                        )}
                        {message.status === 'sent' && (
                          <Check className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <MessageComposer conversationId={conversationId} />
    </div>
  );
}
