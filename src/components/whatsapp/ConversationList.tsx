import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Check, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  leadName: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  status: 'sent' | 'delivered' | 'read';
}

interface ConversationListProps {
  selectedConversation: string | null;
  onSelectConversation: (id: string) => void;
}

// Mock data - will be replaced with real data from database
const mockConversations: Conversation[] = [
  {
    id: "1",
    leadName: "John Mutua",
    phoneNumber: "+256700123456",
    lastMessage: "Thanks for the information!",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5),
    unreadCount: 2,
    status: 'delivered'
  },
  {
    id: "2",
    leadName: "Sarah Akinyi",
    phoneNumber: "+256700789012",
    lastMessage: "When can we schedule a call?",
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
    unreadCount: 0,
    status: 'read'
  },
];

export function ConversationList({ selectedConversation, onSelectConversation }: ConversationListProps) {
  return (
    <div className="w-80 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-xl font-semibold mb-3">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {mockConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={cn(
                "w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left",
                selectedConversation === conversation.id && "bg-accent"
              )}
            >
              <Avatar>
                <AvatarFallback>
                  {conversation.leadName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium truncate">{conversation.leadName}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {formatDistanceToNow(conversation.lastMessageTime, { addSuffix: true })}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate flex-1">
                    {conversation.lastMessage}
                  </p>
                  {conversation.unreadCount > 0 && (
                    <Badge variant="default" className="ml-2 h-5 min-w-5 flex items-center justify-center rounded-full">
                      {conversation.unreadCount}
                    </Badge>
                  )}
                  {conversation.status === 'read' && (
                    <CheckCheck className="h-4 w-4 text-primary ml-2 flex-shrink-0" />
                  )}
                  {conversation.status === 'delivered' && (
                    <CheckCheck className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                  )}
                  {conversation.status === 'sent' && (
                    <Check className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
