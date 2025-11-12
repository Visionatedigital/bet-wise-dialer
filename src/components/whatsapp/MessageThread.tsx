import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageComposer } from "./MessageComposer";
import { format } from "date-fns";
import { Check, CheckCheck, Phone, Video, MoreVertical, Image as ImageIcon, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  isFromAgent: boolean;
  status: 'sent' | 'delivered' | 'read';
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'video';
}

interface MessageThreadProps {
  conversationId: string | null;
}

// Mock data - will be replaced with real data from database
const mockMessages: Message[] = [
  {
    id: "1",
    content: "Hi John! I'm reaching out about the sports betting opportunities we discussed.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    isFromAgent: true,
    status: 'read'
  },
  {
    id: "2",
    content: "Yes, I'm interested! Can you tell me more?",
    timestamp: new Date(Date.now() - 1000 * 60 * 55),
    isFromAgent: false,
    status: 'read'
  },
  {
    id: "3",
    content: "Of course! We have special promotions this month. Let me share the details with you.",
    timestamp: new Date(Date.now() - 1000 * 60 * 50),
    isFromAgent: true,
    status: 'read'
  },
  {
    id: "4",
    content: "Thanks for the information!",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    isFromAgent: false,
    status: 'read'
  },
];

export function MessageThread({ conversationId }: MessageThreadProps) {
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

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>JM</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">John Mutua</h3>
            <p className="text-sm text-muted-foreground">+256700123456</p>
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
          {mockMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.isFromAgent ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-lg p-3",
                  message.isFromAgent
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {message.mediaUrl && (
                  <div className="mb-2 rounded overflow-hidden">
                    {message.mediaType === 'image' && (
                      <img src={message.mediaUrl} alt="Shared media" className="max-w-full" />
                    )}
                    {message.mediaType === 'document' && (
                      <div className="flex items-center gap-2 p-2 bg-background/10 rounded">
                        <FileText className="h-8 w-8" />
                        <span className="text-sm">Document.pdf</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-xs opacity-70">
                    {format(message.timestamp, 'HH:mm')}
                  </span>
                  {message.isFromAgent && (
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
          ))}
        </div>
      </ScrollArea>

      {/* Composer */}
      <MessageComposer conversationId={conversationId} />
    </div>
  );
}
