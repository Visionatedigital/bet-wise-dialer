import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { NewConversationDialog } from "./NewConversationDialog";

interface ConversationListProps {
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
}

export function ConversationList({ selectedConversation, onSelectConversation }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { conversations, loading } = useWhatsAppConversations();

  const filteredConversations = conversations
    .filter(conv =>
      (conv.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      conv.contact_phone.includes(searchQuery)
    )
    .sort((a, b) => {
      // First priority: unread conversations at the top
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (a.unread_count === 0 && b.unread_count > 0) return 1;
      
      // Second priority: sort by most recent message
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime; // Newest first
    });

  if (loading) {
    return (
      <div className="w-80 border-r border-border flex items-center justify-center">
        <p className="text-muted-foreground">Loading conversations...</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border space-y-3">
        <h2 className="text-xl font-semibold">Messages</h2>
        <NewConversationDialog onConversationCreated={onSelectConversation} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No conversations yet</p>
              <p className="text-sm mt-1">Start by receiving a message</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const displayName = conversation.contact_name || conversation.contact_phone;
              const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={cn(
                    "w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left",
                    selectedConversation === conversation.id && "bg-accent"
                  )}
                >
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={cn(
                        "truncate flex-1",
                        conversation.unread_count > 0 ? "font-semibold" : "font-medium"
                      )}>
                        {displayName}
                      </span>
                      {conversation.last_message_at && (
                        <span className={cn(
                          "text-xs whitespace-nowrap flex-shrink-0",
                          conversation.unread_count > 0 ? "text-primary font-semibold" : "text-muted-foreground"
                        )}>
                          {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-sm truncate",
                        conversation.unread_count > 0 ? "text-foreground font-medium max-w-[180px]" : "text-muted-foreground flex-1"
                      )}>
                        {conversation.last_message_text || 'No messages yet'}
                      </p>
                      {conversation.unread_count > 0 && (
                        <Badge 
                          className="h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-semibold flex-shrink-0"
                        >
                          {conversation.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
